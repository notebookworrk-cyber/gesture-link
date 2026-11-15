import { extractFeatures, extractShapeFeatures } from '@/vision/featureExtractor'
import type { HandReading, Landmark } from '@/vision/types'

/** Length of the feature vector: 63 landmark values plus 6 shape values. */
export const FEATURE_LENGTH = 69

/**
 * Builds the feature vector for one hand reading. The landmark part is
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
