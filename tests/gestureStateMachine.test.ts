import { describe, expect, it } from 'vitest'
import { GestureStateMachine } from '@/vision/gestureStateMachine'

const config = { holdMs: 200, cooldownMs: 300, lossToleranceMs: 120 }

describe('GestureStateMachine', () => {
  it('fires only after the hold time', () => {
    const machine = new GestureStateMachine(config)
    expect(machine.update('fist', 0)).toEqual({ current: 'fist', progress: 0, fired: null })
    expect(machine.update('fist', 100).fired).toBeNull()
    expect(machine.update('fist', 100).progress).toBeCloseTo(0.5, 2)
    expect(machine.update('fist', 200).fired).toBe('fist')
  })

  it('fires a held shape once, not every frame', () => {
    const machine = new GestureStateMachine(config)
    machine.update('peace', 0)
    expect(machine.update('peace', 200).fired).toBe('peace')
    expect(machine.update('peace', 900).fired).toBeNull()
    expect(machine.update('peace', 1400).fired).toBeNull()
  })

  it('requires the shape to be released before it can fire again', () => {
    const machine = new GestureStateMachine(config)
    machine.update('point', 0)
    machine.update('point', 200)
    machine.update('none', 400)
    machine.update('point', 500)
    expect(machine.update('point', 700).fired).toBe('point')
  })

  it('respects the cooldown between a release and the next firing', () => {
    const machine = new GestureStateMachine({ ...config, cooldownMs: 1000, lossToleranceMs: 0 })
    machine.update('fist', 0)
    expect(machine.update('fist', 200).fired).toBe('fist')
    machine.update('none', 300)
    machine.update('fist', 400)
    expect(machine.update('fist', 600).fired).toBeNull()
    expect(machine.update('fist', 1200).fired).toBe('fist')
  })

  it('keeps a pending shape through a short dropout', () => {
    const machine = new GestureStateMachine(config)
    machine.update('fist', 0)
    const during = machine.update(null, 100)
    expect(during.current).toBe('fist')
    expect(during.progress).toBeCloseTo(0.5, 2)
    expect(during.fired).toBeNull()
    expect(machine.update('fist', 260).fired).toBe('fist')
  })

  it('drops the pending shape after the dropout tolerance', () => {
    const machine = new GestureStateMachine(config)
    machine.update('fist', 0)
    machine.update(null, 900)
    const restarted = machine.update('fist', 1000)
    expect(restarted.current).toBe('fist')
    expect(restarted.progress).toBe(0)
  })

  it('treats "none" like a missing hand', () => {
    const machine = new GestureStateMachine(config)
    machine.update('fist', 0)
    expect(machine.update('none', 500).current).toBeNull()
  })

  it('applies new timings without a restart', () => {
    const machine = new GestureStateMachine(config)
    machine.update('pinch', 0)
    machine.configure({ holdMs: 50 })
    expect(machine.update('pinch', 60).fired).toBe('pinch')
  })

  it('resets all pending state', () => {
    const machine = new GestureStateMachine(config)
    machine.update('fist', 0)
    machine.reset()
    expect(machine.update('fist', 500).progress).toBe(0)
  })
})
