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

/**
 * A hand placed in the signer's own frame of reference: origin at the shoulder
 * midpoint, unit = shoulder width. This is what makes features survive moving
 * closer to the camera or turning sideways.
 */
export interface CanonicalHand {
  points: Landmark[]
  origin: { x: number; y: number }
  unit: number
  /** Which reference produced the frame. */
  source: 'pose' | 'hand'
}

export interface HandReading {
  /** Normalised image-space landmarks (21 points). */
  landmarks: Landmark[]
  /** Metric landmarks from MediaPipe, used for ratios that need depth. */
  worldLandmarks: Landmark[]
  /**
   * Stable identity across frames. Handedness alone is not enough: MediaPipe
   * swaps its label when the hands cross or the palm turns over.
   */
  id: string
  /** Landmarks in shoulder space, null until a pose frame exists. */
  canonical: CanonicalHand | null
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
  /** Detected faces, empty when face tracking is off or nothing is in view. */
  faces: FaceReading[]
  /** Upper-body pose, null until the pose pass has run. */
  pose: PoseReading | null
  inferenceMs: number
  /** Timestamp of the source video frame, when the browser exposes it. */
  sourceTime: number
}

/** MediaPipe pose landmark indices we care about. */
export const POSE_SHOULDER_LEFT = 11
export const POSE_SHOULDER_RIGHT = 12
export const POSE_ELBOW_LEFT = 13
export const POSE_ELBOW_RIGHT = 14
export const POSE_WRIST_LEFT = 15
export const POSE_WRIST_RIGHT = 16
export const POSE_HIP_LEFT = 23
export const POSE_HIP_RIGHT = 24
export const POSE_NOSE = 0

export interface PoseReading {
  /** Normalised image-space landmarks (33 points). */
  landmarks: Landmark[]
  /** Metric landmarks from MediaPipe. */
  worldLandmarks: Landmark[]
  /** Highest landmark visibility in the upper body, 0…1. */
  confidence: number
  /** Shoulder midpoint in image space. */
  shoulderCenter: { x: number; y: number }
  /** Distance between the shoulders in image space; 0 when not visible. */
  shoulderWidth: number
}

export interface FaceReading {
  /** Normalised image-space landmarks (478 points). */
  landmarks: Landmark[]
  /** Normalised bounding box of the face. */
  box: { x: number; y: number; width: number; height: number }
  /** Rotation of the eye line in radians; 0 when the head is level. */
  roll: number
  /** MediaPipe blendshape scores by category name, when requested. */
  blendshapes?: Record<string, number>
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
    pose: 'off' | 'lite'
    poseRateHz: number
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
