import { describe, expect, it } from 'vitest'
import {
  FEATURE_LENGTH,
  WINDOW_FRAME_LENGTH,
  WINDOW_FRAMES,
  WINDOW_LENGTH,
  WINDOW_POSITION_WEIGHT,
  windowDistance,
  windowFrameFromReading,
  windowFromFrames,
} from '@/signs/features'
import { computeFingers } from '@/vision/geometry'
import type { CanonicalHand, HandReading, Landmark } from '@/vision/types'
import { makeHand } from './helpers/hand'

function canonicalAt(x: number, y: number, z = 0): CanonicalHand {
  const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  points[0] = { x, y, z }
  return { points, origin: { x: 0, y: 0 }, unit: 1, source: 'pose' }
}

function reading(
  extended: Parameters<typeof makeHand>[0],
  canonical: CanonicalHand | null = null,
): HandReading {
  const landmarks = makeHand(extended)
  return {
    landmarks,
    worldLandmarks: landmarks,
    id: 'hand-1',
    canonical,
    handedness: 'Right',
    score: 0.9,
    fingers: computeFingers(landmarks, 0.55),
    gesture: 'none',
    pinchRatio: 0.5,
    palmSpan: 0.2,
    palmCenter: { x: 0.5, y: 0.5 },
    speed: 0,
    holdProgress: 0,
    fired: null,
  }
}

const travel = (
  from: number,
  to: number,
  count: number,
  width = 4,
): number[][] =>
  Array.from({ length: count }, (_, index) => {
    const mix = count === 1 ? 0 : index / (count - 1)
    return Array.from({ length: width }, (_, slot) =>
      slot === 0 ? from + (to - from) * mix : 0,
    )
  })

describe('window features', () => {
  it('adds a weighted body position when a pose frame exists', () => {
    const frame = windowFrameFromReading(reading(['index'], canonicalAt(0.5, -0.25, 0.1)))
    expect(frame).toHaveLength(WINDOW_FRAME_LENGTH)
    expect(frame[FEATURE_LENGTH]).toBeCloseTo(0.5 * WINDOW_POSITION_WEIGHT, 6)
    expect(frame[FEATURE_LENGTH + 1]).toBeCloseTo(-0.25 * WINDOW_POSITION_WEIGHT, 6)
    expect(frame[FEATURE_LENGTH + 2]).toBeCloseTo(0.1 * WINDOW_POSITION_WEIGHT, 6)
  })

  it('leaves the position block at zero without a pose', () => {
    const frame = windowFrameFromReading(reading(['index']))
    expect(frame[FEATURE_LENGTH]).toBe(0)
    expect(frame[FEATURE_LENGTH + 1]).toBe(0)
    expect(frame[FEATURE_LENGTH + 2]).toBe(0)
    expect(frame[WINDOW_FRAME_LENGTH - 1]).toBe(0)
  })

  it('records the second hand offset and its presence', () => {
    const first = reading(['index'], canonicalAt(0.2, 0, 0))
    const second = reading([], canonicalAt(0.6, 0.3, 0))
    const frame = windowFrameFromReading(first, second)
    const offset = FEATURE_LENGTH + 3
    expect(frame[offset]).toBeCloseTo(0.4 * WINDOW_POSITION_WEIGHT, 6)
    expect(frame[offset + 1]).toBeCloseTo(0.3 * WINDOW_POSITION_WEIGHT, 6)
    expect(frame[offset + 3]).toBe(1)
  })

  it('does not fabricate a second hand when only one has a pose', () => {
    const first = reading(['index'], canonicalAt(0.2, 0, 0))
    const second = reading([])
    const frame = windowFrameFromReading(first, second)
    expect(frame[WINDOW_FRAME_LENGTH - 1]).toBe(0)
  })

  it('clamps an implausible position instead of letting it dominate', () => {
    const frame = windowFrameFromReading(reading(['index'], canonicalAt(9, -9, 9)))
    expect(Math.abs(frame[FEATURE_LENGTH]!)).toBeLessThanOrEqual(3)
    expect(Math.abs(frame[FEATURE_LENGTH + 1]!)).toBeLessThanOrEqual(3)
    expect(Math.abs(frame[FEATURE_LENGTH + 2]!)).toBeLessThanOrEqual(3)
  })

  it('resamples a sequence to a fixed length', () => {
    const short = windowFromFrames(travel(0, 1, 5, WINDOW_FRAME_LENGTH))
    const long = windowFromFrames(travel(0, 1, 50, WINDOW_FRAME_LENGTH))
    expect(short).toHaveLength(WINDOW_LENGTH)
    expect(long).toHaveLength(WINDOW_LENGTH)
    expect(WINDOW_LENGTH).toBe(WINDOW_FRAME_LENGTH * WINDOW_FRAMES)
  })

  it('is speed invariant for the same path', () => {
    const a = windowFromFrames(travel(0, 1, 8))!
    const b = windowFromFrames(travel(0, 1, 40))!
    for (let index = 0; index < a.length; index += 1) {
      expect(a[index]).toBeCloseTo(b[index]!, 4)
    }
  })

  it('keeps direction, so the same path reversed is different', () => {
    const forward = windowFromFrames(travel(0, 1, 20))!
    const backward = windowFromFrames(travel(1, 0, 20))!
    expect(windowDistance(forward, backward)).toBeGreaterThan(0.2)
  })

  it('refuses a sequence that is too short', () => {
    expect(windowFromFrames(travel(0, 1, 3))).toBeNull()
  })

  it('measures the same window as zero distance', () => {
    const window = windowFromFrames(travel(0, 1, 12))!
    expect(windowDistance(window, window)).toBe(0)
  })
})
