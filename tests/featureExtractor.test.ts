import { describe, expect, it } from 'vitest'
import { extractFeatures, extractShapeFeatures } from '@/vision/featureExtractor'
import { WRIST } from '@/vision/geometry'
import { makeHand } from './helpers/hand'

describe('feature extraction', () => {
  it('produces a 63-value vector with the wrist at the origin', () => {
    const features = extractFeatures(makeHand(['index', 'middle']))
    expect(features).toHaveLength(63)
    expect(features[0]).toBeCloseTo(0, 6)
    expect(features[1]).toBeCloseTo(0, 6)
    expect(features[2]).toBeCloseTo(0, 6)
  })

  it('is invariant to scale around the wrist', () => {
    const hand = makeHand(['index', 'middle', 'ring'])
    const wrist = hand[WRIST]!
    const scaled = hand.map((point) => ({
      x: wrist.x + (point.x - wrist.x) * 2.4,
      y: wrist.y + (point.y - wrist.y) * 2.4,
      z: 0,
    }))
    const original = extractFeatures(hand)
    const resized = extractFeatures(scaled)
    for (let index = 0; index < original.length; index += 1) {
      expect(resized[index]).toBeCloseTo(original[index]!, 5)
    }
  })

  it('is invariant to translation', () => {
    const hand = makeHand(['index', 'middle'])
    const shifted = hand.map((point) => ({ ...point, x: point.x + 0.2, y: point.y - 0.1 }))
    const original = extractFeatures(hand)
    const moved = extractFeatures(shifted)
    for (let index = 0; index < original.length; index += 1) {
      expect(moved[index]).toBeCloseTo(original[index]!, 5)
    }
  })

  it('encodes finger states and pinch distance separately', () => {
    const shapes = extractShapeFeatures(
      {
        thumb: true,
        index: false,
        middle: true,
        ring: false,
        pinky: false,
        extendedCount: 2,
      },
      0.22,
    )
    expect(Array.from(shapes.slice(0, 5))).toEqual([1, 0, 1, 0, 0])
    expect(shapes[5]).toBeCloseTo(0.22, 5)
  })
})
