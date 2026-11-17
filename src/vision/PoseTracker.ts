import type { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import { poseModelCandidates, wasmRoot, type Delegate } from './handTracker'
import {
  POSE_SHOULDER_LEFT,
  POSE_SHOULDER_RIGHT,
  type Landmark,
  type PoseReading,
} from './types'

export interface PoseTrackerOptions {
  delegate: Delegate
  detectionConfidence?: number
  trackingConfidence?: number
}

/** Landmarks used for the shoulder frame and for arm features. */
const UPPER_BODY = [0, 11, 12, 13, 14, 15, 16, 23, 24]

/**
 * Upper-body pose from MediaPipe's lite bundle.
 *
 * Pose is only used to build the signer's frame of reference, so it runs at a
 * few hertz while the hands run at video rate. The wrapper mirrors the hand
 * tracker: lazy import, CDN model first, CPU fallback reported honestly.
 */
export class PoseTracker {
  private landmarker: PoseLandmarker | null = null
  private activeDelegate: Delegate = 'CPU'

  get delegate(): Delegate {
    return this.activeDelegate
  }

  get loaded(): boolean {
    return this.landmarker !== null
  }

  async load(options: PoseTrackerOptions): Promise<Delegate> {
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot())

    const create = (modelAssetPath: string, delegate: Delegate) =>
      vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: options.detectionConfidence ?? 0.5,
        minPosePresenceConfidence: options.trackingConfidence ?? 0.5,
        minTrackingConfidence: options.trackingConfidence ?? 0.5,
        outputSegmentationMasks: false,
      })

    this.close()
    let lastError: unknown = null
    for (const modelAssetPath of poseModelCandidates()) {
      try {
        this.landmarker = await create(modelAssetPath, options.delegate)
        this.activeDelegate = options.delegate
        return this.activeDelegate
      } catch (error) {
        lastError = error
        if (options.delegate === 'GPU') {
          try {
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

  detect(source: HTMLCanvasElement, timestampMs: number): PoseReading | null {
    if (!this.landmarker) return null
    let result: PoseLandmarkerResult
    try {
      result = this.landmarker.detectForVideo(source, timestampMs)
    } catch {
      // One failed frame must not tear down a running session.
      return null
    }
    const raw = result.landmarks?.[0]
    if (!raw || raw.length <= POSE_SHOULDER_RIGHT) return null
    return toReading(raw, result.worldLandmarks?.[0] ?? [])
  }

  close(): void {
    this.landmarker?.close()
    this.landmarker = null
  }
}

export function toReading(landmarks: Landmark[], worldLandmarks: Landmark[]): PoseReading {
  const left = landmarks[POSE_SHOULDER_LEFT]!
  const right = landmarks[POSE_SHOULDER_RIGHT]!
  let confidence = 0
  for (const index of UPPER_BODY) {
    const point = landmarks[index] as (Landmark & { visibility?: number }) | undefined
    const value = point?.visibility ?? 0
    if (value > confidence) confidence = value
  }
  return {
    landmarks,
    worldLandmarks,
    confidence,
    shoulderCenter: { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 },
    shoulderWidth: Math.hypot(left.x - right.x, left.y - right.y),
  }
}
