import { MIDDLE_MCP, WRIST, palmSpan } from './geometry'
import type { FingerStates, Landmark } from './types'

/**
 * Translation and scale invariant feature vector for the trainable classifier.
 * Coordinates are relative to the wrist and divided by palm span, so a hand at
 * arm's length produces the same vector as a hand near the camera.
 */
export function extractFeatures(landmarks: Landmark[]): Float32Array {
  const wrist = landmarks[WRIST]
  const middle = landmarks[MIDDLE_MCP]
  const span = palmSpan(landmarks) || 1
  const features = new Float32Array(63)
  if (!wrist || !middle) return features

  for (let index = 0; index < 21; index += 1) {
    const point = landmarks[index]
    if (!point) continue
    const offset = index * 3
    features[offset] = (point.x - wrist.x) / span
    features[offset + 1] = (point.y - wrist.y) / span
    // MediaPipe's z is already roughly in palm-span units but noisy; clamping
    // keeps an outlier from dominating a distance metric.
    features[offset + 2] = Math.max(-1, Math.min(1, (point.z - wrist.z) / span))
  }
  return features
}

/**
 * Small supplementary vector: five extension flags plus the ratios that
 * distinguish similar open shapes. Kept separate so the classifier can be
 * retrained on raw landmarks alone.
 */
export function extractShapeFeatures(fingers: FingerStates, pinchRatio: number): Float32Array {
  return new Float32Array([
    fingers.thumb ? 1 : 0,
    fingers.index ? 1 : 0,
    fingers.middle ? 1 : 0,
    fingers.ring ? 1 : 0,
    fingers.pinky ? 1 : 0,
    pinchRatio,
  ])
}
