import { extractFeatures, extractShapeFeatures } from '@/vision/featureExtractor'
import type { HandReading, Landmark } from '@/vision/types'

/** Length of the static feature vector: 63 landmark values plus 6 shape values. */
export const FEATURE_LENGTH = 69

/**
 * Window features add the hand's place in the body and, when a second hand is
 * present, its offset: three values for the primary wrist, three for the offset
 * and one presence flag. Hand-relative landmarks alone cannot tell a hand
 * moving through space from a hand held still, so these values are what makes a
 * window motion-aware.
 */
export const WINDOW_POSITION_LENGTH = 3
export const WINDOW_OFFSET_LENGTH = 3
export const WINDOW_FRAME_LENGTH =
  FEATURE_LENGTH + WINDOW_POSITION_LENGTH + WINDOW_OFFSET_LENGTH + 1

/**
 * Position is weighted up when the vector is built so a trajectory is not
 * drowned by 69 shape values. The same weight applies at training and at
 * inference, so thresholds stay comparable.
 */
export const WINDOW_POSITION_WEIGHT = 3

/** Frames a window is resampled to. Time-normalised, not a frame count at run time. */
export const WINDOW_FRAMES = 12

/** Full length of a resampled window vector. */
export const WINDOW_LENGTH = WINDOW_FRAME_LENGTH * WINDOW_FRAMES

/** Windows shorter than this cannot describe a movement, so they are rejected. */
export const WINDOW_MIN_FRAMES = 4

/** Time covered by one sliding window and the interval between two windows. */
export const WINDOW_MS = 1100
export const WINDOW_MIN_SPAN_MS = 600
export const WINDOW_STRIDE_MS = 350

const clampUnit = (value: number, limit = 3): number =>
  Number.isFinite(value) ? Math.max(-limit, Math.min(limit, value)) : 0

/**
 * Builds the static feature vector for one hand reading. The landmark part is
 * translation and scale invariant, the shape part adds the extension flags and
 * the pinch ratio, which separate signs that share a pose.
 */
export function featuresFromReading(reading: HandReading): Float32Array {
  return featuresFromLandmarks(reading.landmarks, reading.fingers, reading.pinchRatio)
}

export function featuresFromLandmarks(
  landmarks: Landmark[],
  fingers: HandReading['fingers'],
  pinchRatio: number,
): Float32Array {
  const pose = extractFeatures(landmarks)
  const shape = extractShapeFeatures(fingers, pinchRatio)
  const out = new Float32Array(FEATURE_LENGTH)
  out.set(pose, 0)
  out.set(shape, pose.length)
  return out
}

/**
 * One frame of a sign window: the static features plus where the hand is in
 * shoulder space. Without a pose frame the position block stays zero, which
 * makes the window shape-only rather than inventing a body position.
 */
export function windowFrameFromReading(
  hand: HandReading,
  secondHand: HandReading | null = null,
): Float32Array {
  const out = new Float32Array(WINDOW_FRAME_LENGTH)
  out.set(featuresFromReading(hand), 0)

  const primary = hand.canonical?.source === 'pose' ? hand.canonical.points[0] : undefined
  if (primary) {
    out[FEATURE_LENGTH] = clampUnit(primary.x * WINDOW_POSITION_WEIGHT)
    out[FEATURE_LENGTH + 1] = clampUnit(primary.y * WINDOW_POSITION_WEIGHT)
    out[FEATURE_LENGTH + 2] = clampUnit(primary.z * WINDOW_POSITION_WEIGHT)
  }

  const second = secondHand?.canonical?.source === 'pose' ? secondHand.canonical.points[0] : undefined
  if (primary && second) {
    const offset = FEATURE_LENGTH + WINDOW_POSITION_LENGTH
    out[offset] = clampUnit((second.x - primary.x) * WINDOW_POSITION_WEIGHT)
    out[offset + 1] = clampUnit((second.y - primary.y) * WINDOW_POSITION_WEIGHT)
    out[offset + 2] = clampUnit((second.z - primary.z) * WINDOW_POSITION_WEIGHT)
    out[offset + 3] = 1
  }

  return out
}

/**
 * Resamples a sequence of frames to a fixed length by linear interpolation, so
 * the same sign at two speeds produces comparable vectors. Returns null when
 * there is too little to resample.
 */
export function windowFromFrames(frames: ArrayLike<number>[]): Float32Array | null {
  if (frames.length < WINDOW_MIN_FRAMES) return null
  const width = frames[0]!.length
  const out = new Float32Array(width * WINDOW_FRAMES)
  const last = frames.length - 1

  for (let slot = 0; slot < WINDOW_FRAMES; slot += 1) {
    const position = (slot / (WINDOW_FRAMES - 1)) * last
    const before = Math.floor(position)
    const after = Math.min(last, before + 1)
    const mix = position - before
    const a = frames[before]!
    const b = frames[after]!
    for (let index = 0; index < width; index += 1) {
      const value = (a[index] ?? 0) * (1 - mix) + (b[index] ?? 0) * mix
      out[slot * width + index] = Math.fround(value)
    }
  }
  return out
}

/** Root-mean-square distance between two window vectors. */
export function windowDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const length = Math.min(a.length, b.length)
  if (length === 0) return Infinity
  let sum = 0
  for (let index = 0; index < length; index += 1) {
    const delta = a[index]! - b[index]!
    sum += delta * delta
  }
  return Math.sqrt(sum / length)
}

/** Plain array form, used for storage and for the model file. */
export function toArray(vector: Float32Array): number[] {
  return Array.from(vector, (value) => Number(value.toFixed(4)))
}

/** Euclidean distance between two feature vectors. */
export function distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0
  const length = Math.min(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const delta = a[index]! - b[index]!
    sum += delta * delta
  }
  return Math.sqrt(sum)
}
