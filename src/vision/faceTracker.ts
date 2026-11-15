import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { faceModelCandidates, wasmRoot, type Delegate } from './handTracker'
import type { FaceReading, Landmark } from './types'

/**
 * Frame where the face detector runs. The hand landmarker already owns the
 * per-frame budget on this hardware, and stickers only need face anchors a few
 * times a second, so the face pass runs on alternate frames.
 */
export const FACE_FRAME_STRIDE = 2

/** Landmark indices used for anchoring stickers. */
export const FACE_POINTS = {
  leftEyeOuter: 263,
  rightEyeOuter: 33,
  leftEyeInner: 362,
  rightEyeInner: 133,
  noseTip: 1,
  forehead: 10,
  chin: 152,
  leftCheek: 454,
  rightCheek: 234,
  mouthLeft: 61,
  mouthRight: 291,
} as const

export interface FaceTrackerOptions {
  delegate: Delegate
  maxFaces: number
}

/**
 * Thin wrapper around MediaPipe's face landmarker. Imported lazily so the rest
 * of the app never pays for the runtime until a workspace asks for faces.
 */
export class FaceTracker {
  private landmarker: FaceLandmarker | null = null
  private activeDelegate: Delegate = 'CPU'
  private readonly smoothers = new Map<number, FaceSmoother>()

  get delegate(): Delegate {
    return this.activeDelegate
  }

  get loaded(): boolean {
    return this.landmarker !== null
  }

  async load(options: FaceTrackerOptions): Promise<Delegate> {
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot())
    const create = (modelAssetPath: string, delegate: Delegate) =>
      vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numFaces: options.maxFaces,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      })

    this.close()
    let lastError: unknown = null
    for (const modelAssetPath of faceModelCandidates()) {
      try {
        this.landmarker = await create(modelAssetPath, options.delegate)
        this.activeDelegate = options.delegate
        return this.activeDelegate
      } catch (error) {
        lastError = error
        if (options.delegate === 'GPU') {
          try {
            // Falling back to CPU is reported through `delegate`, never claimed as GPU.
            this.landmarker = await create(modelAssetPath, 'CPU')
            this.activeDelegate = 'CPU'
            return this.activeDelegate
          } catch (cpuError) {
            lastError = cpuError
          }
        }
      }
    }
    throw lastError
  }

  /** Detects faces and returns smoothed readings in normalised image space. */
  detect(source: HTMLCanvasElement, timestampMs: number): FaceReading[] {
    if (!this.landmarker) return []
    let result: FaceLandmarkerResult
    try {
      result = this.landmarker.detectForVideo(source, timestampMs)
    } catch {
      // One bad frame must not tear down a running session.
      return []
    }
    const faces = result.faceLandmarks ?? []
    const readings: FaceReading[] = []
    for (let index = 0; index < faces.length; index += 1) {
      const raw = faces[index]
      if (!raw || raw.length === 0) continue
      const landmarks = this.smootherFor(index, raw.length).smooth(raw)
      readings.push(toReading(landmarks))
    }
    if (readings.length === 0) this.smoothers.clear()
    return readings
  }

  close(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.smoothers.clear()
  }

  private smootherFor(index: number, length: number): FaceSmoother {
    const smoother = this.smoothers.get(index)
    if (smoother && smoother.length === length) return smoother
    const created = new FaceSmoother(length)
    this.smoothers.set(index, created)
    return created
  }
}

/** Light exponential smoothing: face landmarks jitter less than hands. */
class FaceSmoother {
  private readonly values: Landmark[]
  private primed = false
  readonly length: number

  constructor(length: number) {
    this.length = length
    this.values = Array.from({ length }, () => ({ x: 0, y: 0, z: 0 }))
  }

  smooth(points: Landmark[]): Landmark[] {
    const alpha = this.primed ? 0.45 : 1
    for (let index = 0; index < this.values.length; index += 1) {
      const point = points[index] ?? { x: 0, y: 0, z: 0 }
      const target = this.values[index]!
      target.x += (point.x - target.x) * alpha
      target.y += (point.y - target.y) * alpha
      target.z += (point.z - target.z) * alpha
    }
    this.primed = true
    return this.values
  }
}

export function toReading(landmarks: Landmark[]): FaceReading {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }
  const right = landmarks[FACE_POINTS.rightEyeOuter]
  const left = landmarks[FACE_POINTS.leftEyeOuter]
  const roll =
    right && left ? Math.atan2(left.y - right.y, left.x - right.x) : 0
  return {
    landmarks,
    box: { x: minX, y: minY, width: Math.max(maxX - minX, 0.0001), height: Math.max(maxY - minY, 0.0001) },
    roll,
  }
}
