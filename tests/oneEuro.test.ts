import { describe, expect, it } from 'vitest'
import { LandmarkSmoother, OneEuroFilter } from '@/vision/oneEuro'
import { makeHand } from './helpers/hand'

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    const filter = new OneEuroFilter()
    expect(filter.filter(0.4, 0)).toBe(0.4)
  })

  it('approaches a step without jumping to it', () => {
    const filter = new OneEuroFilter({ minCutoff: 1 })
    filter.filter(0, 0)
    const afterOneFrame = filter.filter(1, 16)
    expect(afterOneFrame).toBeGreaterThan(0)
    expect(afterOneFrame).toBeLessThan(1)
    let value = afterOneFrame
    for (let time = 32; time <= 1000; time += 16) value = filter.filter(1, time)
    expect(value).toBeGreaterThan(0.95)
  })

  it('reduces lag during motion when beta is raised', () => {
    const slow = new OneEuroFilter({ minCutoff: 0.5, beta: 0 })
    const fast = new OneEuroFilter({ minCutoff: 0.5, beta: 1 })
    let slowOutput = 0
    let fastOutput = 0
    for (let index = 0; index <= 30; index += 1) {
      slowOutput = slow.filter(index / 30, index * 16)
      fastOutput = fast.filter(index / 30, index * 16)
    }
    expect(fastOutput).toBeGreaterThan(slowOutput)
    expect(fastOutput).toBeLessThanOrEqual(1)
  })

  it('resets cleanly', () => {
    const filter = new OneEuroFilter()
    filter.filter(0.2, 0)
    filter.reset()
    expect(filter.filter(0.9, 16)).toBe(0.9)
  })
})

describe('LandmarkSmoother', () => {
  it('smooths all 21 points and preserves the array shape', () => {
    const smoother = new LandmarkSmoother()
    const first = smoother.smooth(makeHand(['index', 'middle']), 0)
    expect(first).toHaveLength(21)
    expect(first[0]).toEqual({ x: 0.5, y: 0.9, z: 0 })
  })

  it('damps a sudden jump instead of following it exactly', () => {
    const smoother = new LandmarkSmoother({ minCutoff: 0.6, beta: 0 })
    const base = makeHand(['index'])
    smoother.smooth(base, 0)
    const moved = base.map((point) => ({ ...point, x: point.x + 0.1 }))
    const result = smoother.smooth(moved, 16)
    expect(result[0]!.x).toBeGreaterThan(base[0]!.x)
    expect(result[0]!.x).toBeLessThan(base[0]!.x + 0.1)
  })
})
