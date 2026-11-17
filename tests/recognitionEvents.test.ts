import { describe, expect, it, vi } from 'vitest'
import { DuplicateSuppressor } from '@/recognition/DuplicateSuppressor'
import { PredictionStabilizer } from '@/recognition/PredictionStabilizer'
import { SignEventManager } from '@/recognition/SignEventManager'
import {
  defaultRecognitionSettings,
  type RecognitionCandidate,
} from '@/recognition/types'

const candidate = (
  key: string,
  confidence = 0.9,
  text = key,
): RecognitionCandidate => ({
  key,
  text,
  confidence,
  source: 'count',
  hands: ['right'],
})

const manager = () => new SignEventManager({ ...defaultRecognitionSettings })
const hold = (
  instance: SignEventManager,
  value: string | null,
  from: number,
  to: number,
  step = 100,
  motion = 0.01,
) => {
  const events = []
  for (let now = from; now <= to; now += step) {
    const event = instance.update(value ? candidate(value) : null, motion, now)
    if (event) events.push(event)
  }
  return events
}

describe('recognition events', () => {
  it('test 1: commits exactly one event for a sign held for five seconds', () => {
    const instance = manager()
    expect(hold(instance, '5', 0, 5000)).toHaveLength(1)
  })

  it('test 2: does not re-arm on small movement of the same sign', () => {
    const instance = manager()
    const events = hold(instance, '5', 0, 3000, 100, 0.4)
    expect(events).toHaveLength(1)
    expect(hold(instance, '5', 3100, 6000, 100, 0.4)).toHaveLength(0)
  })

  it('test 3: commits two events for two genuinely different signs', () => {
    const instance = manager()
    hold(instance, '5', 0, 1000)
    const second = hold(instance, '2', 1100, 2500)
    expect(second).toHaveLength(1)
    expect(second[0]!.key).toBe('2')
    expect(second[0]!.id).not.toBe('')
  })

  it('re-arms after a real neutral release, not after a pause in frames', () => {
    const instance = manager()
    const first = hold(instance, '5', 0, 1000)
    expect(first).toHaveLength(1)
    hold(instance, null, 1100, 1800)
    expect(hold(instance, '5', 1900, 3200)).toHaveLength(1)
  })

  it('never emits an event for unstable predictions', () => {
    const instance = manager()
    const events = hold(instance, '5', 0, 2000, 100, 0.01)
    expect(events.length).toBeLessThanOrEqual(1)
  })

  it('notifies subscribers once per event and can unsubscribe', () => {
    const instance = manager()
    const listener = vi.fn()
    const stop = instance.subscribe(listener)
    hold(instance, '5', 0, 1000)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    hold(instance, '2', 1100, 2200)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('exposes the debug state without fabricating progress', () => {
    const instance = manager()
    hold(instance, '5', 0, 1000)
    expect(instance.debug.eventCount).toBe(1)
    expect(instance.debug.lastCommitted).toBe('5')
    expect(instance.debug.duplicateSuppressed).toBe(true)
    expect(instance.debug.phase).toBe('waiting_for_release')
  })

  it('reset clears the prior event identity', () => {
    const instance = manager()
    hold(instance, '5', 0, 1000)
    instance.reset()
    expect(hold(instance, '5', 1100, 2500)).toHaveLength(1)
  })
})

describe('temporal validation', () => {
  it('votes by confidence and holds the incumbent on a close challenger', () => {
    const stabilizer = new PredictionStabilizer(260, 0.45)
    for (let now = 0; now <= 400; now += 80) stabilizer.push(candidate('A', 0.9), now)
    const stable = stabilizer.push(candidate('A', 0.9), 480)
    expect(stable.stable).toBe(true)
    const afterNoise = stabilizer.push(candidate('B', 0.6), 560)
    expect(afterNoise.key).toBe('A')
  })

  it('refuses a key below the confidence floor', () => {
    const stabilizer = new PredictionStabilizer(260, 0.45)
    for (let now = 0; now <= 400; now += 80) stabilizer.push(candidate('A', 0.2), now)
    expect(stabilizer.push(candidate('A', 0.2), 480).stable).toBe(false)
  })
})

describe('duplicate suppression', () => {
  it('blocks a repeated event id even when suppression is disabled', () => {
    const suppressor = new DuplicateSuppressor(200, false)
    expect(suppressor.canCommit({ key: 'A', now: 0, transitioned: false, neutral: false, eventId: 'e1' })).toBe(true)
    suppressor.consume('A', 'e1', 0)
    expect(suppressor.canCommit({ key: 'A', now: 500, transitioned: false, neutral: false, eventId: 'e1' })).toBe(false)
  })

  it('requires a neutral state or a verified transition to re-arm', () => {
    const suppressor = new DuplicateSuppressor(200)
    suppressor.consume('A', 'e1', 0)
    expect(suppressor.canCommit({ key: 'A', now: 1000, transitioned: false, neutral: false })).toBe(false)
    expect(suppressor.canCommit({ key: 'A', now: 1100, transitioned: false, neutral: true })).toBe(false)
    expect(suppressor.canCommit({ key: 'A', now: 1300, transitioned: false, neutral: true })).toBe(false)
    expect(suppressor.isArmed).toBe(true)
    expect(suppressor.canCommit({ key: 'A', now: 1400, transitioned: false, neutral: false })).toBe(true)
  })
})
