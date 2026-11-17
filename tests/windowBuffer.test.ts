import { describe, expect, it } from 'vitest'
import { WINDOW_FRAME_LENGTH, WINDOW_FRAMES, WINDOW_LENGTH, WINDOW_STRIDE_MS } from '@/signs/features'
import { SignWindowBuffer, windowsFromTake } from '@/signs/windowBuffer'

const vector = (value: number) =>
  Array.from({ length: WINDOW_FRAME_LENGTH }, (_, index) => (index === 0 ? value : 0))

describe('sliding sign window', () => {
  it('does not emit before the minimum span', () => {
    const buffer = new SignWindowBuffer()
    for (let index = 0; index < 5; index += 1) {
      expect(buffer.push(index * 33, vector(0.1))).toBeNull()
    }
    expect(buffer.frameCount).toBe(5)
    expect(buffer.ready).toBe(false)
  })

  it('emits a full window once enough time has passed', () => {
    const buffer = new SignWindowBuffer()
    let emitted: Float32Array | null = null
    for (let time = 0; time <= 800; time += 33) {
      emitted = buffer.push(time, vector(0.1)) ?? emitted
    }
    expect(emitted).not.toBeNull()
    expect(emitted!).toHaveLength(WINDOW_LENGTH)
    expect(buffer.ready).toBe(true)
  })

  it('respects the stride between emissions', () => {
    const buffer = new SignWindowBuffer()
    let emissions = 0
    for (let time = 0; time <= 2000; time += 33) {
      if (buffer.push(time, vector(0.1))) emissions += 1
    }
    // 2 s at one window per ~350 ms cannot exceed six emissions.
    expect(emissions).toBeGreaterThanOrEqual(3)
    expect(emissions).toBeLessThanOrEqual(Math.ceil(2000 / WINDOW_STRIDE_MS) + 1)
  })

  it('clears the window when the hand leaves', () => {
    const buffer = new SignWindowBuffer()
    for (let time = 0; time <= 800; time += 33) buffer.push(time, vector(0.1))
    expect(buffer.frameCount).toBeGreaterThan(0)

    buffer.push(833, null)
    expect(buffer.frameCount).toBeGreaterThan(0)
    buffer.push(866, null)
    expect(buffer.frameCount).toBe(0)
    expect(buffer.ready).toBe(false)
  })

  it('ignores an out-of-order frame', () => {
    const buffer = new SignWindowBuffer()
    buffer.push(500, vector(0.2))
    expect(buffer.push(400, vector(0.8))).toBeNull()
    expect(buffer.frameCount).toBe(1)
  })

  it('drops frames older than the window and stays bounded', () => {
    const buffer = new SignWindowBuffer()
    for (let time = 0; time <= 5000; time += 20) buffer.push(time, vector(0.1))
    expect(buffer.frameCount).toBeLessThanOrEqual(60)
  })

  it('resets completely', () => {
    const buffer = new SignWindowBuffer()
    for (let time = 0; time <= 800; time += 33) buffer.push(time, vector(0.1))
    buffer.reset()
    expect(buffer.frameCount).toBe(0)
    expect(buffer.ready).toBe(false)
    expect(buffer.push(0, vector(0.1))).toBeNull()
  })
})

describe('windows from a recorded take', () => {
  it('rejects a take with too few frames', () => {
    expect(windowsFromTake([{ timestamp: 0, vector: vector(0) }])).toEqual([])
  })

  it('turns a short take into one window', () => {
    const frames = Array.from({ length: 6 }, (_, index) => ({
      timestamp: index * 33,
      vector: vector(index / 10),
    }))
    const windows = windowsFromTake(frames)
    expect(windows).toHaveLength(1)
    expect(windows[0]).toHaveLength(WINDOW_LENGTH)
  })

  it('produces several overlapping windows for a longer take', () => {
    const frames = Array.from({ length: 60 }, (_, index) => ({
      timestamp: index * 33,
      vector: vector(index / 60),
    }))
    const windows = windowsFromTake(frames)
    expect(windows.length).toBeGreaterThan(1)
    for (const window of windows) expect(window).toHaveLength(WINDOW_LENGTH)
  })

  it('keeps the end of the take', () => {
    const frames = Array.from({ length: 41 }, (_, index) => ({
      timestamp: index * 50,
      vector: vector(index / 40),
    }))
    const windows = windowsFromTake(frames)
    expect(windows.length).toBeGreaterThan(0)
    // The last window must end on the last frame, whose value is 1.
    const last = windows[windows.length - 1]!
    expect(last[(WINDOW_FRAMES - 1) * WINDOW_FRAME_LENGTH]).toBeCloseTo(1, 5)
  })
})
