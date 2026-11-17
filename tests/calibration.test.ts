import { beforeEach, describe, expect, it } from 'vitest'
import {
  CALIBRATION_STORAGE_KEY,
  clampToProfile,
  clearProfile,
  createProfile,
  loadProfile,
  saveProfile,
} from '@/vision/calibration'

const points = (count = 20) =>
  Array.from({ length: count }, (_, index) => ({
    x: 0.1 + (index % 5) * 0.15,
    y: 0.15 + Math.floor(index / 5) * 0.15,
  }))

describe('calibration profile', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('needs enough samples', () => {
    expect(createProfile(points(4))).toBeNull()
  })

  it('rejects a recording that barely moved', () => {
    const still = Array.from({ length: 20 }, () => ({ x: 0.5, y: 0.5 }))
    expect(createProfile(still)).toBeNull()
  })

  it('covers the observed area with a small margin', () => {
    const profile = createProfile(points(), 1234)
    expect(profile).not.toBeNull()
    expect(profile!.samples).toBe(20)
    expect(profile!.bounds.xMin).toBeLessThan(0.1)
    expect(profile!.bounds.xMax).toBeGreaterThan(0.7)
    expect(profile!.bounds.yMin).toBeLessThan(0.15)
    expect(profile!.bounds.yMax).toBeGreaterThan(0.6)
    expect(profile!.createdAt).toBe(1234)
  })

  it('maps a point into 0…1 inside the calibrated box', () => {
    const profile = createProfile(points(), 1)!
    const { xMin, xMax, yMin, yMax } = profile.bounds
    const middle = clampToProfile({ x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 }, profile)
    expect(middle.x).toBeCloseTo(0.5)
    expect(middle.y).toBeCloseTo(0.5)

    const outside = clampToProfile({ x: xMax + 5, y: yMin - 5 }, profile)
    expect(outside).toEqual({ x: 1, y: 0 })
  })

  it('passes the point through when there is no profile', () => {
    expect(clampToProfile({ x: 0.25, y: 0.75 }, null)).toEqual({ x: 0.25, y: 0.75 })
  })

  it('saves, loads and clears', () => {
    const profile = createProfile(points(), 99)!
    saveProfile(profile)
    expect(loadProfile()?.createdAt).toBe(99)
    clearProfile()
    expect(loadProfile()).toBeNull()
  })

  it('ignores corrupted storage', () => {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, '{not json')
    expect(loadProfile()).toBeNull()
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify({ version: 2 }))
    expect(loadProfile()).toBeNull()
  })
})
