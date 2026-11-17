import {
  POSE_ELBOW_LEFT,
  POSE_ELBOW_RIGHT,
  POSE_SHOULDER_LEFT,
  POSE_SHOULDER_RIGHT,
  type CanonicalHand,
  type Landmark,
  type PoseReading,
} from './types'
import { WRIST, palmSpan } from './geometry'

/** Minimum landmark visibility before a shoulder is trusted. */
export const MIN_SHOULDER_VISIBILITY = 0.5

export interface ShoulderFrame {
  origin: { x: number; y: number }
  /** Shoulder width in image-normalised units; never 0. */
  unit: number
}

const visibility = (landmarks: Landmark[], index: number): number =>
  (landmarks[index] as Landmark & { visibility?: number }).visibility ?? 0

/**
 * Builds the signer's own frame of reference from the upper body.
 *
 * Image coordinates are useless for sign features: stepping back from the
 * camera shrinks every distance by the same factor, and turning sideways moves
 * both hands. Measuring everything from the shoulder midpoint, in units of
 * shoulder width, removes both effects.
 */
export function shoulderFrame(pose: PoseReading | null): ShoulderFrame | null {
  if (!pose) return null
  const left = pose.landmarks[POSE_SHOULDER_LEFT]
  const right = pose.landmarks[POSE_SHOULDER_RIGHT]
  if (!left || !right) return null
  const leftVisible = visibility(pose.landmarks, POSE_SHOULDER_LEFT)
  const rightVisible = visibility(pose.landmarks, POSE_SHOULDER_RIGHT)
  if (leftVisible < MIN_SHOULDER_VISIBILITY || rightVisible < MIN_SHOULDER_VISIBILITY) {
    return null
  }
  const width = Math.hypot(left.x - right.x, left.y - right.y)
  if (!Number.isFinite(width) || width < 1e-4) return null
  return {
    origin: { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 },
    unit: width,
  }
}

/**
 * Places the hand in shoulder space. When no pose frame is available the hand
 * falls back to its own wrist, which is translation invariant but not scale
 * invariant across people — `source` reports which case was used.
 */
export function normalizeHand(
  landmarks: Landmark[],
  frame: ShoulderFrame | null,
  mirror = false,
): CanonicalHand | null {
  const wrist = landmarks[WRIST]
  if (!wrist || landmarks.length < 21) return null

  const origin = frame ? frame.origin : { x: wrist.x, y: wrist.y }
  const unit = frame ? frame.unit : palmSpan(landmarks)
  if (!Number.isFinite(unit) || unit < 1e-4) return null

  const direction = mirror ? -1 : 1
  const points: Landmark[] = []
  for (const point of landmarks) {
    points.push({
      x: ((point.x - origin.x) * direction) / unit,
      y: (point.y - origin.y) / unit,
      z: point.z / unit,
    })
  }

  return { points, origin, unit, source: frame ? 'pose' : 'hand' }
}

/**
 * Arm extension, used by signs where the arm leaves the body. Values are in
 * shoulder widths, so they compare across signers.
 */
export function armExtension(
  pose: PoseReading | null,
  side: 'left' | 'right',
): number | null {
  const frame = shoulderFrame(pose)
  if (!frame || !pose) return null
  const elbowIndex = side === 'left' ? POSE_ELBOW_LEFT : POSE_ELBOW_RIGHT
  const wristIndex = side === 'left' ? 15 : 16
  const shoulderIndex = side === 'left' ? POSE_SHOULDER_LEFT : POSE_SHOULDER_RIGHT
  const shoulder = pose.landmarks[shoulderIndex]
  const elbow = pose.landmarks[elbowIndex]
  const wrist = pose.landmarks[wristIndex]
  if (!shoulder || !elbow || !wrist) return null
  const straight = Math.hypot(wrist.x - shoulder.x, wrist.y - shoulder.y)
  if (!Number.isFinite(straight)) return null
  return straight / frame.unit
}
