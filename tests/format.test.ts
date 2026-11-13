import { describe, expect, it } from 'vitest'
import { clamp, formatBytes, percent } from '@/utils/format'

describe('formatBytes', () => {
  it('formats byte sizes with sensible precision', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(950)).toBe('950 B')
    expect(formatBytes(12_500_000)).toBe('12.5 MB')
    expect(formatBytes(2_000_000_000)).toBe('2 GB')
  })

  it('returns a dash for invalid input', () => {
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(-1)).toBe('—')
  })
})

describe('numeric helpers', () => {
  it('clamps values into range', () => {
    expect(clamp(-4, 0, 10)).toBe(0)
    expect(clamp(4, 0, 10)).toBe(4)
    expect(clamp(40, 0, 10)).toBe(10)
  })

  it('normalises to a 0..1 ratio and survives an empty range', () => {
    expect(percent(5, 0, 10)).toBe(0.5)
    expect(percent(5, 5, 5)).toBe(0)
  })
})
