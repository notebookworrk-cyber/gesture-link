import { describe, expect, it } from 'vitest'
import { HandIdentityTracker } from '@/vision/HandIdentityTracker'

const detection = (x: number, y = 0.5, handedness: 'Left' | 'Right' = 'Right') => ({
  center: { x, y },
  handedness,
  score: 0.9,
})

describe('HandIdentityTracker', () => {
  it('gives each hand an id and keeps it across frames', () => {
    const tracker = new HandIdentityTracker()
    const first = tracker.assign([detection(0.2), detection(0.8)], 0)
    expect(new Set(first).size).toBe(2)

    const second = tracker.assign([detection(0.22), detection(0.78)], 33)
    expect(second).toEqual(first)
  })

  it('follows position when MediaPipe flips the handedness label', () => {
    const tracker = new HandIdentityTracker()
    const first = tracker.assign([detection(0.25, 0.5, 'Left'), detection(0.75, 0.5, 'Right')], 0)
    // Same positions, labels swapped: this is the crossing-hands case.
    const second = tracker.assign(
      [detection(0.27, 0.5, 'Right'), detection(0.73, 0.5, 'Left')],
      33,
    )
    expect(second).toEqual(first)
  })

  it('starts a new id for a hand that appears far from every track', () => {
    const tracker = new HandIdentityTracker()
    const first = tracker.assign([detection(0.2)], 0)
    const second = tracker.assign([detection(0.2), detection(0.9)], 33)
    expect(second[0]).toBe(first[0])
    expect(second[1]).not.toBe(first[0])
  })

  it('forgets a track that has been gone longer than the age limit', () => {
    const tracker = new HandIdentityTracker({ maxAgeMs: 200 })
    const first = tracker.assign([detection(0.2)], 0)
    const later = tracker.assign([detection(0.2)], 500)
    expect(later[0]).not.toBe(first[0])
  })

  it('drops a stale track when the hand leaves the frame', () => {
    const tracker = new HandIdentityTracker({ maxAgeMs: 100 })
    tracker.assign([detection(0.2), detection(0.8)], 0)
    tracker.assign([detection(0.2)], 50)
    expect(tracker.size).toBe(2)
    tracker.assign([detection(0.2)], 150)
    expect(tracker.size).toBe(1)
    tracker.assign([], 260)
    expect(tracker.size).toBe(0)
  })

  it('resets ids so a new session cannot inherit old ones', () => {
    const tracker = new HandIdentityTracker()
    tracker.assign([detection(0.2)], 0)
    tracker.reset()
    expect(tracker.size).toBe(0)
    expect(tracker.assign([detection(0.2)], 10)[0]).toBe('hand-1')
  })
})
