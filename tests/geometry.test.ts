import { describe, expect, it } from 'vitest'
import {
  INDEX_PIP,
  INDEX_TIP,
  MIDDLE_MCP,
  THUMB_TIP,
  WRIST,
  angleAt,
  classifyGesture,
  computeFingers,
  distance,
  distance2d,
  mirrorLandmarks,
  palmSpan,
} from '@/vision/geometry'
import type { FingerStates } from '@/vision/types'
import { makeHand } from './helpers/hand'

const fingers = (overrides: Partial<FingerStates> = {}): FingerStates => ({
  thumb: false,
  index: false,
  middle: false,
  ring: false,
  pinky: false,
  extendedCount: 0,
  ...overrides,
})

describe('landmark geometry', () => {
  it('measures angles at a joint in degrees', () => {
    const a = { x: 0, y: 0, z: 0 }
    const b = { x: 1, y: 0, z: 0 }
    expect(angleAt(a, b, { x: 2, y: 0, z: 0 })).toBeCloseTo(180, 4)
    expect(angleAt(a, b, { x: 1, y: 1, z: 0 })).toBeCloseTo(90, 4)
    expect(angleAt(a, b, { x: 0, y: 1, z: 0 })).toBeCloseTo(45, 4)
  })

  it('returns zero for degenerate joints instead of NaN', () => {
    const point = { x: 1, y: 1, z: 0 }
    expect(angleAt(point, point, point)).toBe(0)
  })

  it('computes 2D and 3D distances', () => {
    expect(distance2d({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5)
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 4 })).toBe(5)
  })

  it('measures the palm span from wrist to middle knuckle', () => {
    const hand = makeHand(['index'])
    const span = palmSpan(hand)
    expect(span).toBeCloseTo(
      Math.hypot(hand[MIDDLE_MCP]!.x - hand[WRIST]!.x, hand[MIDDLE_MCP]!.y - hand[WRIST]!.y),
      6,
    )
  })

  it('mirrors x while leaving y and z untouched', () => {
    const mirrored = mirrorLandmarks(makeHand(['index']))
    expect(mirrored[WRIST]!.x).toBeCloseTo(0.5, 6)
    expect(mirrored[INDEX_TIP]!.x).toBeCloseTo(1 - 0.39, 6)
    expect(mirrored[INDEX_TIP]!.y).toBeCloseTo(0.4, 6)
  })
})

describe('finger detection', () => {
  it('counts extended non-thumb fingers', () => {
    expect(computeFingers(makeHand(['index', 'middle'])).extendedCount).toBe(2)
    expect(computeFingers(makeHand([])).extendedCount).toBe(0)
    expect(
      computeFingers(makeHand(['index', 'middle', 'ring', 'pinky'])).extendedCount,
    ).toBe(4)
  })

  it('detects a thumb that is straight and away from the palm', () => {
    expect(computeFingers(makeHand(['thumb'])).thumb).toBe(true)
    expect(computeFingers(makeHand([])).thumb).toBe(false)
  })

  it('is not fooled by a straight but folded thumb', () => {
    const hand = makeHand(['thumb'])
    // Same straight thumb, folded across the palm toward the pinky.
    hand[THUMB_TIP] = { x: 0.52, y: 0.62, z: 0 }
    expect(computeFingers(hand).thumb).toBe(false)
  })

  it('accepts more fingers as sensitivity rises', () => {
    const hand = makeHand([])
    // A partly bent index finger at roughly 146 degrees at the PIP joint:
    // between the strict (160) and loose (140) extension thresholds.
    hand[INDEX_PIP] = { x: 0.43, y: 0.55, z: 0 }
    hand[INDEX_TIP] = { x: 0.47, y: 0.49, z: 0 }
    const strict = computeFingers(hand, 0.1)
    const loose = computeFingers(hand, 0.9)
    expect(loose.index).toBe(true)
    expect(strict.index).toBe(false)
  })
})

describe('shape classification', () => {
  it('classifies the documented hand shapes', () => {
    expect(classifyGesture(computeFingers(makeHand([])), 1)).toBe('fist')
    expect(classifyGesture(computeFingers(makeHand(['thumb'])), 1)).toBe('thumbs-up')
    expect(classifyGesture(computeFingers(makeHand(['index'])), 1)).toBe('point')
    expect(classifyGesture(computeFingers(makeHand(['index', 'middle'])), 1)).toBe('peace')
    expect(
      classifyGesture(computeFingers(makeHand(['index', 'middle', 'ring'])), 1),
    ).toBe('three')
    expect(
      classifyGesture(
        computeFingers(makeHand(['thumb', 'index', 'middle', 'ring', 'pinky'])),
        1,
      ),
    ).toBe('open-palm')
  })

  it('fires pinch before point when the tips are close enough', () => {
    expect(classifyGesture(fingers({ index: true, extendedCount: 1 }), 0.18)).toBe('pinch')
    expect(classifyGesture(fingers({ index: true, extendedCount: 1 }), 0.42)).toBe('point')
  })

  it('moves the pinch threshold with the sensitivity setting', () => {
    expect(classifyGesture(fingers({ index: true, extendedCount: 1 }), 0.34, 0.9)).toBe(
      'pinch',
    )
    expect(classifyGesture(fingers({ index: true, extendedCount: 1 }), 0.34, 0.1)).toBe(
      'point',
    )
  })

  it('reports an unknown shape instead of guessing', () => {
    expect(classifyGesture(fingers({ thumb: true, ring: true, extendedCount: 1 }), 1)).toBe(
      'none',
    )
  })
})
