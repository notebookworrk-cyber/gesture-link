import { describe, expect, it } from 'vitest'
import { TemporalBuffer } from '@/vision/TemporalBuffer'

interface Sample {
  timestamp: number
  value: number
}

const make = (timestamp: number, value = timestamp): Sample => ({ timestamp, value })

describe('TemporalBuffer', () => {
  it('rejects a non-positive capacity', () => {
    expect(() => new TemporalBuffer<Sample>(0)).toThrow()
    expect(() => new TemporalBuffer<Sample>(-3)).toThrow()
  })

  it('keeps the newest entries when it overflows', () => {
    const buffer = new TemporalBuffer<Sample>(3)
    for (let index = 1; index <= 5; index += 1) buffer.push(make(index))
    expect(buffer.size).toBe(3)
    expect(buffer.full).toBe(true)
    expect(buffer.entries().map((entry) => entry.value)).toEqual([3, 4, 5])
    expect(buffer.latest()?.value).toBe(5)
  })

  it('returns entries oldest first and reports the covered span', () => {
    const buffer = new TemporalBuffer<Sample>(10)
    buffer.push(make(1000))
    buffer.push(make(1040))
    buffer.push(make(1080))
    expect(buffer.entries().map((entry) => entry.timestamp)).toEqual([1000, 1040, 1080])
    expect(buffer.span()).toBe(80)
    expect(buffer.since(1050).map((entry) => entry.timestamp)).toEqual([1080])
  })

  it('drops an out-of-order frame instead of corrupting the window', () => {
    const buffer = new TemporalBuffer<Sample>(4)
    buffer.push(make(100))
    buffer.push(make(140))
    buffer.push(make(120))
    expect(buffer.entries().map((entry) => entry.timestamp)).toEqual([100, 140])
  })

  it('clears back to empty', () => {
    const buffer = new TemporalBuffer<Sample>(2)
    buffer.push(make(1))
    buffer.clear()
    expect(buffer.size).toBe(0)
    expect(buffer.latest()).toBeNull()
    expect(buffer.span()).toBe(0)
  })
})
