import type { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision'

/** Resolved lazily so importing the engine never requires `window`. */
export function wasmRoot(): string {
  return new URL(`${import.meta.env.BASE_URL}mediapipe/wasm`, window.location.href).href
}

export function handModelUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}models/hand_landmarker.task`, window.location.href)
    .href
}

export function faceModelUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}models/face_landmarker.task`, window.location.href).href
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

    const create = (delegate: Delegate) =>
      vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: handModelUrl(),
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: options.maxHands,
        minHandDetectionConfidence: options.detectionConfidence,
        minHandPresenceConfidence: options.trackingConfidence,
        minTrackingConfidence: options.trackingConfidence,
      })

    this.close()
    try {
      this.landmarker = await create(options.delegate)
      this.activeDelegate = options.delegate
    } catch (error) {
      if (options.delegate !== 'GPU') throw error
      // A GPU session can fail on constrained drivers. Falling back is
      // reported through `delegate`, never silently claimed as GPU.
      this.landmarker = await create('CPU')
      this.activeDelegate = 'CPU'
    }
    return this.activeDelegate
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
