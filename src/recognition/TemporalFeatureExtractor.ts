import {
  FEATURE_LENGTH,
  WINDOW_FRAME_LENGTH,
  windowFrameFromReading,
  windowFromFrames,
} from '@/signs/features'
import type { HandSlot, TwoHandUpdate } from './types'

/** Extra relative features: wrist offset, orientation, presence and interaction. */
export const TWO_HAND_RELATIVE_LENGTH = 8
export const TWO_HAND_FRAME_LENGTH = WINDOW_FRAME_LENGTH * 2 + TWO_HAND_RELATIVE_LENGTH
export const TWO_HAND_FRAMES = 12
export const TWO_HAND_LENGTH = TWO_HAND_FRAME_LENGTH * TWO_HAND_FRAMES

/**
 * One combined observation for a two-hand sign. Both hands are placed in the
 * same shoulder frame and kept in fixed left/right slots; a missing hand is
 * never padded with a fake reading, the frame is rejected instead.
 */
export function twoHandFrameFromUpdate(update: TwoHandUpdate): Float32Array | null {
  const left = handFrame(update, 'left')
  const right = handFrame(update, 'right')
  if (!left || !right) return null

  const out = new Float32Array(TWO_HAND_FRAME_LENGTH)
  out.set(left, 0)
  out.set(right, WINDOW_FRAME_LENGTH)

  const relative = WINDOW_FRAME_LENGTH * 2
  const lw = wrist(left)
  const rw = wrist(right)
  out[relative] = clamp(rw.x - lw.x)
  out[relative + 1] = clamp(rw.y - lw.y)
  out[relative + 2] = clamp(rw.z - lw.z)

  const lTip = tip(left)
  const rTip = tip(right)
  const lDir = norm(sub(lTip, lw))
  const rDir = norm(sub(rTip, rw))
  out[relative + 3] = clamp(lDir.x * rDir.x + lDir.y * rDir.y + lDir.z * rDir.z)

  const leftState = update.left
  const rightState = update.right
  out[relative + 4] = leftState?.reading.canonical?.source === 'pose' ? 1 : 0
  out[relative + 5] = rightState?.reading.canonical?.source === 'pose' ? 1 : 0
  out[relative + 6] = clamp(Math.hypot(rw.x - lw.x, rw.y - lw.y))
  out[relative + 7] = clamp(Math.abs(lw.x - rw.x))
  return out
}

/** Time-normalises a two-hand sequence using the same resampler as single-hand windows. */
export function twoHandWindowFromFrames(frames: ArrayLike<number>[]): Float32Array | null {
  const window = windowFromFrames(frames)
  return window && window.length === TWO_HAND_LENGTH ? window : null
}

function handFrame(update: TwoHandUpdate, slot: HandSlot): Float32Array | null {
  const state = slot === 'left' ? update.left : update.right
  if (!state || state.status === 'lost') return null
  return windowFrameFromReading(
    state.reading,
    null, // The second hand is already encoded in the other half of the vector.
  )
}

type Point = { x: number; y: number; z: number }
const wrist = (frame: Float32Array): Point => ({
  x: frame[FEATURE_LENGTH] ?? 0,
  y: frame[FEATURE_LENGTH + 1] ?? 0,
  z: frame[FEATURE_LENGTH + 2] ?? 0,
})
const tip = (frame: Float32Array): Point => {
  // Index fingertip is landmark 8, offset 8*3 in the 63-value pose block.
  const offset = 8 * 3
  return {
    x: frame[offset] ?? 0,
    y: frame[offset + 1] ?? 0,
    z: frame[offset + 2] ?? 0,
  }
}
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const norm = (p: Point): Point => {
  const length = Math.hypot(p.x, p.y, p.z) || 1
  return { x: p.x / length, y: p.y / length, z: p.z / length }
}
const clamp = (value: number) => Math.max(-3, Math.min(3, Number.isFinite(value) ? value : 0))
