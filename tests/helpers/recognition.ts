import type { HandReading, Landmark } from '@/vision/types'
import { computeFingers } from '@/vision/geometry'
import { makeHand } from './hand'

/** Builds a plausible HandReading for recognition tests. */
export function makeReading(
  id: string,
  handedness: HandReading['handedness'],
  extended: Parameters<typeof makeHand>[0] = ['index'],
  palm: { x: number; y: number } = { x: 0.5, y: 0.5 },
): HandReading {
  const landmarks: Landmark[] = makeHand(extended)
  return {
    landmarks,
    worldLandmarks: landmarks,
    id,
    canonical: null,
    handedness,
    score: 0.9,
    fingers: computeFingers(landmarks, 0.55),
    gesture: 'none',
    pinchRatio: 0.5,
    palmSpan: 0.2,
    palmCenter: palm,
    speed: 0,
    holdProgress: 0,
    fired: null,
  }
}

export function frame(
  timestamp: number,
  hands: HandReading[],
  inferenceMs = 10,
) {
  return { timestamp, hands, faces: [], pose: null, inferenceMs, sourceTime: timestamp }
}
