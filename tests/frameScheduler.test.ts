import { describe, expect, it } from 'vitest'
import { FrameScheduler, type FrameRequestSource } from '@/vision/FrameScheduler'

/** Deterministic source: frames fire only when the test says so. */
function manualSource() {
  let next = 1
  const pending = new Map<number, () => void>()
  const source: FrameRequestSource = {
    request: (callback) => {
      const handle = next++
      pending.set(handle, callback)
      return handle
    },
    cancel: (handle) => {
      pending.delete(handle)
    },
  }
  return {
    source,
    fire(): boolean {
      const entry = pending.entries().next()
      if (entry.done) return false
      const [handle, callback] = entry.value
      pending.delete(handle)
      callback()
      return true
    },
    get pendingCount(): number {
      return pending.size
    },
  }
}

describe('FrameScheduler', () => {
  it('processes a frame per callback and keeps one request in flight', () => {
    const manual = manualSource()
    let processed = 0
    const scheduler = new FrameScheduler(manual.source, {
      onFrame: () => {
        processed += 1
      },
      clock: { now: () => 0 },
    })
    scheduler.start()

    expect(manual.pendingCount).toBe(1)
    manual.fire()
    expect(processed).toBe(1)
    // The next request is made before the frame is processed, so the chain
    // survives even when a pass is slow.
    expect(manual.pendingCount).toBe(1)
    manual.fire()
    expect(processed).toBe(2)
  })

  it('drops a callback that arrives while a frame is still being processed', () => {
    const manual = manualSource()
    let processed = 0
    const scheduler = new FrameScheduler(manual.source, {
      onFrame: () => {
        processed += 1
        // A second callback lands mid-frame, as a queued video frame would.
        manual.fire()
      },
      clock: { now: () => 0 },
    })
    scheduler.start()
    manual.fire()

    expect(processed).toBe(1)
    expect(scheduler.droppedFrames).toBe(1)
  })

  it('enforces the minimum interval for low-power mode', () => {
    const manual = manualSource()
    let now = 0
    let processed = 0
    const scheduler = new FrameScheduler(manual.source, {
      onFrame: () => {
        processed += 1
      },
      minIntervalMs: 66,
      clock: { now: () => now },
    })
    scheduler.start()

    manual.fire()
    expect(processed).toBe(1)

    now = 20
    manual.fire()
    expect(processed).toBe(1)
    expect(scheduler.droppedFrames).toBe(1)

    now = 80
    manual.fire()
    expect(processed).toBe(2)
  })

  it('stops cleanly and leaves nothing scheduled', () => {
    const manual = manualSource()
    const scheduler = new FrameScheduler(manual.source, { onFrame: () => undefined })
    scheduler.start()
    expect(manual.pendingCount).toBe(1)
    scheduler.stop()
    expect(manual.pendingCount).toBe(0)
    expect(scheduler.running).toBe(false)
    expect(manual.fire()).toBe(false)
  })

  it('ignores a second start', () => {
    const manual = manualSource()
    const scheduler = new FrameScheduler(manual.source, { onFrame: () => undefined })
    scheduler.start()
    scheduler.start()
    expect(manual.pendingCount).toBe(1)
  })

  it('keeps counting rather than throwing when a frame handler throws', () => {
    const manual = manualSource()
    let calls = 0
    const scheduler = new FrameScheduler(manual.source, {
      onFrame: () => {
        calls += 1
        if (calls === 1) throw new Error('frame failed')
      },
    })
    scheduler.start()
    expect(() => manual.fire()).toThrow('frame failed')
    // The chain still requested the next frame and the busy flag was cleared,
    // so the following frame is processed normally.
    expect(manual.pendingCount).toBe(1)
    manual.fire()
    expect(calls).toBe(2)
    expect(scheduler.processedFrames).toBe(1)
  })
})
