import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision'

/**
 * Model bundles. The files are the same ones scripts/fetch-models.mjs
 * downloads from Google's MediaPipe model store, so the CDN copy is
 * byte-identical to the local copy.
 *
 * Order matters: GitHub Pages served the 7.8 MB hand model so slowly that it
 * timed out on a phone connection (measured ~60 s from Pages vs ~1 s from
 * Google storage), so the CDN is tried first and the bundled local copy is
 * the offline fallback.
 */
const MODEL_CDN_BASE = 'https://storage.googleapis.com/mediapipe-models'

/** Resolved lazily so importing the engine never requires `window`. */
export function wasmRoot(): string {
  return new URL(`${import.meta.env.BASE_URL}mediapipe/wasm`, window.location.href).href
}

function localModelUrl(file: string): string {
  return new URL(`${import.meta.env.BASE_URL}models/${file}`, window.location.href).href
}

export function handModelCandidates(): string[] {
  return [
    `${MODEL_CDN_BASE}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
    localModelUrl('hand_landmarker.task'),
  ]
}

export function faceModelCandidates(): string[] {
  return [
    `${MODEL_CDN_BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
    localModelUrl('face_landmarker.task'),
  ]
}

/**
 * Pose has no bundled copy: the lite bundle is 5.5 MB and the only consumer is
 * the shoulder frame, so it is fetched from the same model store on demand and
 * degrades to hand-relative features when the fetch fails.
 */
export function poseModelCandidates(): string[] {
  return [
    `${MODEL_CDN_BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    localModelUrl('pose_landmarker_lite.task'),
  ]
}

/** First candidate, for callers that only need one URL. */
export function handModelUrl(): string {
  return handModelCandidates()[0]!
}

export function faceModelUrl(): string {
  return faceModelCandidates()[0]!
}

export interface TrackerOptions {
  delegate: 'GPU' | 'CPU'
  maxHands: number
  detectionConfidence: number
  trackingConfidence: number
}

export type Delegate = 'GPU' | 'CPU'

/**
 * Thin wrapper around the MediaPipe hand landmarker. The package is imported
 * dynamically so the home page and settings do not pay for the runtime until a
 * camera is actually started.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Model load timed out')), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null
  private activeDelegate: Delegate = 'CPU'

  get delegate(): Delegate {
    return this.activeDelegate
  }

  get loaded(): boolean {
    return this.landmarker !== null
  }

  async load(options: TrackerOptions): Promise<Delegate> {
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(wasmRoot())

    const create = (modelAssetPath: string, delegate: Delegate) =>
      vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath,
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: options.maxHands,
        minHandDetectionConfidence: options.detectionConfidence,
        minHandPresenceConfidence: options.trackingConfidence,
        minTrackingConfidence: options.trackingConfidence,
      })

    this.close()
    let lastError: unknown = null
    for (const modelAssetPath of handModelCandidates()) {
      try {
        // The CDN copy is preferred because it is much faster on GitHub Pages,
        // but a stalled request must not block the local fallback forever.
        this.landmarker = await withTimeout(create(modelAssetPath, options.delegate), 8000)
        this.activeDelegate = options.delegate
        return this.activeDelegate
      } catch (error) {
        lastError = error
        if (options.delegate === 'GPU') {
          try {
            // A GPU session can fail on constrained drivers. Falling back is
            // reported through `delegate`, never silently claimed as GPU.
            this.landmarker = await withTimeout(create(modelAssetPath, 'CPU'), 8000)
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

  detect(source: HTMLCanvasElement, timestampMs: number): HandLandmarkerResult | null {
    if (!this.landmarker) return null
    try {
      return this.landmarker.detectForVideo(source, timestampMs)
    } catch {
      // A single failed frame should not tear down a running session; the next
      // frame retries with a fresh source and timestamp.
      return null
    }
  }

  close(): void {
    this.landmarker?.close()
    this.landmarker = null
  }
}
