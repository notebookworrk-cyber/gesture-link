import { describe, expect, it } from 'vitest'
import { normalizeHand, shoulderFrame } from '@/vision/LandmarkNormalizer'
import type { Landmark, PoseReading } from '@/vision/types'
import { makeHand } from './helpers/hand'

interface Visible extends Landmark {
  visibility?: number
}

function pose(shoulderLeft: Landmark, shoulderRight: Landmark, visibility = 0.9): PoseReading {
  const landmarks: Visible[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
  landmarks[11] = { ...shoulderLeft, visibility }
  landmarks[12] = { ...shoulderRight, visibility }
  return {
    landmarks,
    worldLandmarks: [],
    confidence: visibility,
    shoulderCenter: {
      x: (shoulderLeft.x + shoulderRight.x) / 2,
      y: (shoulderLeft.y + shoulderRight.y) / 2,
    },
    shoulderWidth: Math.hypot(
      shoulderLeft.x - shoulderRight.x,
      shoulderLeft.y - shoulderRight.y,
    ),
  }
}

const shift = (points: Landmark[], dx: number, dy: number): Landmark[] =>
  points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy }))

const scale = (points: Landmark[], factor: number): Landmark[] =>
  points.map((point) => ({ ...point, x: point.x * factor, y: point.y * factor, z: point.z * factor }))

const close = (a: Landmark[], b: Landmark[], tolerance = 1e-6): boolean =>
  a.every(
    (point, index) =>
      Math.abs(point.x - b[index]!.x) < tolerance &&
      Math.abs(point.y - b[index]!.y) < tolerance,
  )

describe('shoulder frame', () => {
  it('needs a pose', () => {
    expect(shoulderFrame(null)).toBeNull()
  })

  it('needs both shoulders visible', () => {
    const hidden = pose({ x: 0.3, y: 0.4, z: 0 }, { x: 0.7, y: 0.4, z: 0 }, 0.2)
    expect(shoulderFrame(hidden)).toBeNull()
  })

  it('reports the midpoint and width', () => {
    const frame = shoulderFrame(pose({ x: 0.3, y: 0.4, z: 0 }, { x: 0.7, y: 0.4, z: 0 }))
    expect(frame).not.toBeNull()
    expect(frame!.origin.x).toBeCloseTo(0.5)
    expect(frame!.origin.y).toBeCloseTo(0.4)
    expect(frame!.unit).toBeCloseTo(0.4)
  })

  it('rejects degenerate shoulders', () => {
    expect(shoulderFrame(pose({ x: 0.5, y: 0.4, z: 0 }, { x: 0.5, y: 0.4, z: 0 }))).toBeNull()
  })
})

describe('hand normalisation', () => {
  it('is translation invariant', () => {
    const frame = shoulderFrame(pose({ x: 0.3, y: 0.4, z: 0 }, { x: 0.7, y: 0.4, z: 0 }))!
    const hand = makeHand(['index'])
    const movedFrame = { origin: { x: frame.origin.x + 0.1, y: frame.origin.y - 0.05 }, unit: frame.unit }

    const a = normalizeHand(hand, frame)!
    const b = normalizeHand(shift(hand, 0.1, -0.05), movedFrame)!
    expect(close(a.points, b.points)).toBe(true)
  })

  it('is scale invariant across signers and distances', () => {
    const frame = shoulderFrame(pose({ x: 0.3, y: 0.4, z: 0 }, { x: 0.7, y: 0.4, z: 0 }))!
    const hand = makeHand(['index', 'middle'])
    // Stepping back scales the whole image: hand, shoulders and origin together.
    const factor = 1.8
    const scaledFrame = {
      origin: { x: frame.origin.x * factor, y: frame.origin.y * factor },
      unit: frame.unit * factor,
    }

    const a = normalizeHand(hand, frame)!
    const b = normalizeHand(scale(hand, factor), scaledFrame)!
    expect(close(a.points, b.points, 1e-6)).toBe(true)
  })

  it('falls back to the hand itself without a pose frame', () => {
    const hand = makeHand(['open-palm' as never])
    const canonical = normalizeHand(hand, null)
    expect(canonical).not.toBeNull()
    expect(canonical!.source).toBe('hand')
    expect(canonical!.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
  })

  it('mirrors the x axis for a mirrored camera', () => {
    const frame = shoulderFrame(pose({ x: 0.3, y: 0.4, z: 0 }, { x: 0.7, y: 0.4, z: 0 }))!
    const hand = makeHand(['index'])
    const straight = normalizeHand(hand, frame)!
    const mirrored = normalizeHand(hand, frame, true)!
    expect(mirrored.points[0]!.x).toBeCloseTo(-straight.points[0]!.x)
    expect(mirrored.points[0]!.y).toBeCloseTo(straight.points[0]!.y)
  })

  it('refuses a hand with missing landmarks', () => {
    expect(normalizeHand([], null)).toBeNull()
  })

  it('hand-relative scaling does not depend on where the hand is', () => {
    const hand = makeHand(['fist' as never])
    const a = normalizeHand(hand, null)!
    const b = normalizeHand(shift(hand, 0.2, 0.1), null)!
    expect(close(a.points, b.points)).toBe(true)
  })
})
