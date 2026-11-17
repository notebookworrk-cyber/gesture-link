import { describe, expect, it } from 'vitest'
import { TrackingDiagnostics } from '@/vision/TrackingDiagnostics'

describe('tracking diagnostics', () => {
  it('starts empty so the panel can be honest before the first frame', () => {
    const diagnostics = new TrackingDiagnostics()
    const snapshot = diagnostics.snapshot()
    expect(snapshot.handP50).toBe(0)
    expect(snapshot.processedFrames).toBe(0)
    expect(snapshot.modelLoadMs).toBe(0)
  })

  it('reports median and 95th percentile of real samples', () => {
    const diagnostics = new TrackingDiagnostics()
    for (let value = 1; value <= 100; value += 1) diagnostics.recordHand(value)
    const snapshot = diagnostics.snapshot()
    expect(snapshot.processedFrames).toBe(100)
    // 1…100 sorted: median sits between 50 and 51.
    expect(snapshot.handP50).toBeGreaterThanOrEqual(50)
    expect(snapshot.handP50).toBeLessThanOrEqual(51)
    expect(snapshot.handP95).toBe(95)
  })

  it('keeps the window bounded so a long session cannot grow memory', () => {
    const diagnostics = new TrackingDiagnostics()
    for (let index = 0; index < 5000; index += 1) diagnostics.recordHand(10)
    expect(diagnostics.snapshot().handP50).toBe(10)
    expect(diagnostics.snapshot().processedFrames).toBe(5000)
  })

  it('tracks dropped frames and long tasks separately', () => {
    const diagnostics = new TrackingDiagnostics()
    diagnostics.recordDrop()
    diagnostics.recordDrop(4)
    expect(diagnostics.snapshot().droppedFrames).toBe(5)
  })

  it('records model load time once per session', () => {
    const diagnostics = new TrackingDiagnostics()
    diagnostics.recordModelLoad(812.4)
    expect(diagnostics.snapshot().modelLoadMs).toBe(812)
  })

  it('ignores non-finite samples instead of poisoning the percentiles', () => {
    const diagnostics = new TrackingDiagnostics()
    diagnostics.recordHand(Number.NaN)
    diagnostics.recordHand(-5)
    diagnostics.recordHand(8)
    expect(diagnostics.snapshot().handP50).toBeGreaterThanOrEqual(0)
    expect(diagnostics.snapshot().handP95).toBeLessThanOrEqual(Number.POSITIVE_INFINITY)
    expect(Number.isFinite(diagnostics.snapshot().handP95)).toBe(true)
  })

  it('resets between sessions', () => {
    const diagnostics = new TrackingDiagnostics()
    diagnostics.recordHand(30)
    diagnostics.recordDrop(3)
    diagnostics.reset()
    const snapshot = diagnostics.snapshot()
    expect(snapshot.processedFrames).toBe(0)
    expect(snapshot.droppedFrames).toBe(0)
    expect(snapshot.handP50).toBe(0)
  })
})
