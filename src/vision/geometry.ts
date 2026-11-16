import type { FingerStates, Landmark, StaticGestureId } from './types'

export const WRIST = 0
export const THUMB_CMC = 1
export const THUMB_MCP = 2
export const THUMB_IP = 3
export const THUMB_TIP = 4
export const INDEX_MCP = 5
export const INDEX_PIP = 6
export const INDEX_DIP = 7
export const INDEX_TIP = 8
export const MIDDLE_MCP = 9
export const MIDDLE_PIP = 10
export const MIDDLE_DIP = 11
export const MIDDLE_TIP = 12
export const RING_MCP = 13
export const RING_PIP = 14
export const RING_DIP = 15
export const RING_TIP = 16
export const PINKY_MCP = 17
export const PINKY_PIP = 18
export const PINKY_DIP = 19
export const PINKY_TIP = 20

const FINGER_JOINTS = [
  { mcp: INDEX_MCP, pip: INDEX_PIP, tip: INDEX_TIP },
  { mcp: MIDDLE_MCP, pip: MIDDLE_PIP, tip: MIDDLE_TIP },
  { mcp: RING_MCP, pip: RING_PIP, tip: RING_TIP },
  { mcp: PINKY_MCP, pip: PINKY_PIP, tip: PINKY_TIP },
] as const

export function distance(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function distance2d(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Angle at joint `b` in degrees, between the rays b→a and b→c. */
export function angleAt(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
  const n1 = Math.hypot(v1.x, v1.y, v1.z)
  const n2 = Math.hypot(v2.x, v2.y, v2.z)
  if (n1 === 0 || n2 === 0) return 0
  const cosine = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (n1 * n2)
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI
}

export function palmSpan(landmarks: Landmark[]): number {
  const wrist = landmarks[WRIST]
  const middle = landmarks[MIDDLE_MCP]
  if (!wrist || !middle) return 0
  return distance(wrist, middle)
}

/**
 * Finger extension uses two independent signals so a bent-but-pointing finger
 * is not counted: the angle at the PIP joint and the tip moving away from the
 * wrist. The thumb does not share the same geometry, so it is measured against
 * the pinky MCP instead.
 */
export function computeFingers(landmarks: Landmark[], sensitivity = 0.5): FingerStates {
  const wrist = landmarks[WRIST]
  const pinkyMcp = landmarks[PINKY_MCP]
  const span = palmSpan(landmarks) || 1
  const bendThreshold = 150 - (sensitivity - 0.5) * 24
  const reachRatio = 0.08 + (0.5 - sensitivity) * 0.04

  const states = FINGER_JOINTS.map(({ mcp, pip, tip }) => {
    const mcpPoint = landmarks[mcp]
    const pipPoint = landmarks[pip]
    const tipPoint = landmarks[tip]
    const base = landmarks[WRIST]
    if (!mcpPoint || !pipPoint || !tipPoint || !base) return false
    const angle = angleAt(mcpPoint, pipPoint, tipPoint)
    const tipReach = distance(base, tipPoint) - distance(base, pipPoint)
    return angle > bendThreshold && tipReach > span * reachRatio
  })

  let thumb = false
  const cmc = landmarks[THUMB_CMC]
  const thumbMcp = landmarks[THUMB_MCP]
  const thumbIp = landmarks[THUMB_IP]
  const thumbTip = landmarks[THUMB_TIP]
  if (cmc && thumbMcp && thumbIp && thumbTip && pinkyMcp && wrist) {
    const straightness = angleAt(thumbMcp, thumbIp, thumbTip)
    const awayFromPalm =
      distance(thumbTip, pinkyMcp) - distance(thumbIp, pinkyMcp) > span * 0.12
    // The thumb can be straight while still folded across the palm, so both
    // signals are required.
    thumb = straightness > 145 && awayFromPalm
  }

  const [index, middle, ring, pinky] = states
  return {
    thumb,
    index: Boolean(index),
    middle: Boolean(middle),
    ring: Boolean(ring),
    pinky: Boolean(pinky),
    extendedCount: states.filter(Boolean).length,
  }
}

/**
 * Geometric gesture classification. These are hand shapes, not trained sign
 * classes: the UI labels them as such so they are never mistaken for a sign
 * language model.
 */
export function classifyGesture(
  fingers: FingerStates,
  pinchRatio: number,
  pinchSensitivity = 0.5,
): StaticGestureId {
  const { thumb, index, middle, ring, pinky, extendedCount } = fingers
  // 0.5 maps to the documented default of 0.30. Higher sensitivity accepts a
  // wider gap between the tips.
  const pinchThreshold = 0.30 + (pinchSensitivity - 0.5) * 0.16

  // Pinching normally bends the index finger, so requiring an extended index
  // missed most real pinches. Tips that are actually touching are accepted
  // even when the index is curled; the tighter ratio keeps a closed fist (whose
  // thumb rests on the curled fingers) out of the pinch class.
  if (pinchRatio < pinchThreshold && (index || pinchRatio < pinchThreshold * 0.6)) {
    return 'pinch'
  }
  if (extendedCount === 4) return 'open-palm'
  if (index && middle && !ring && !pinky) return 'peace'
  if (index && middle && ring && !pinky) return 'three'
  if (index && !middle && !ring && !pinky) return 'point'
  if (extendedCount === 0) return thumb ? 'thumbs-up' : 'fist'
  return 'none'
}

/** Moves x into mirrored space for display, so the preview matches a mirror. */
export function mirrorLandmarks(landmarks: Landmark[]): Landmark[] {
  return landmarks.map((point) => ({ x: 1 - point.x, y: point.y, z: point.z }))
}
