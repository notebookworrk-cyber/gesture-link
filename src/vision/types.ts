export interface Landmark {
  x: number
  y: number
  z: number
}

export type Handedness = 'Left' | 'Right'

export type StaticGestureId =
  | 'open-palm'
  | 'fist'
  | 'point'
  | 'peace'
  | 'thumbs-up'
  | 'pinch'
  | 'three'
  | 'none'

export interface FingerStates {
  thumb: boolean
  index: boolean
  middle: boolean
  ring: boolean
  pinky: boolean
  /** Number of extended non-thumb fingers (0-4). */
  extendedCount: number
}

export interface HandReading {
  /** Normalised image-space landmarks (21 points). */
  landmarks: Landmark[]
  /** Metric landmarks from MediaPipe, used for ratios that need depth. */
  worldLandmarks: Landmark[]
  handedness: Handedness
  score: number
  fingers: FingerStates
  gesture: StaticGestureId
  /** Thumb tip to index tip distance divided by palm span. */
  pinchRatio: number
  /** Wrist to middle-finger MCP distance in normalised units. */
  palmSpan: number
  /** Palm centre used as the drawing anchor. */
  palmCenter: { x: number; y: number }
  /** Units per second of palm movement, measured across frames. */
  speed: number
  /** 0..1 progress toward the configured hold threshold. */
  holdProgress: number
  /** Set on the single frame where a held shape fires. */
  fired: StaticGestureId | null
}

export interface FrameReading {
  timestamp: number
  hands: HandReading[]
  inferenceMs: number
  /** Timestamp of the source video frame, when the browser exposes it. */
  sourceTime: number
}

export interface VisionConfig {
  camera: {
    deviceId: string | null
    resolution: '480p' | '720p' | '1080p'
    frameRate: 15 | 24 | 30 | 60
    mirror: boolean
    /** Stop the stream when the last workspace using it detaches. */
    autoRelease: boolean
  }
  tracking: {
    maxHands: 1 | 2
    detectionConfidence: number
    trackingConfidence: number
    smoothing: number
    sensitivity: number
    pinchSensitivity: number
    holdMs: number
    cooldownMs: number
    lossToleranceMs: number
    dominantHand: 'left' | 'right' | 'any'
  }
  performance: {
    quality: 'low' | 'balanced' | 'high'
    adaptive: boolean
    delegate: 'auto' | 'gpu' | 'cpu'
    lowPower: boolean
  }
}

/** Inference width per quality level. The camera capture size is independent. */
export const PROCESSING_WIDTH: Record<VisionConfig['performance']['quality'], number> = {
  low: 320,
  balanced: 480,
  high: 640,
}
