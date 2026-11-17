import { describe, expect, it } from 'vitest'
import { frame, makeReading } from './helpers/recognition'
import { TwoHandTracker } from '@/recognition/TwoHandTracker'

const tracker = (mirror = true) =>
  new TwoHandTracker({ mirrorLabels: mirror, handLossMs: 250 })

describe('two-hand tracking', () => {
  it('assigns physical slots from handedness, not detection order', () => {
    const instance = tracker()
    const update = instance.update(
      frame(0, [makeReading('h1', 'Right'), makeReading('h2', 'Left')]),
    )
    expect(update.left?.id).toBe('h2')
    expect(update.right?.id).toBe('h1')
    expect(update.visible).toEqual(['right', 'left'])
  })

  it('keeps a slot when the handedness label flips', () => {
    const instance = tracker()
    instance.update(frame(0, [makeReading('h1', 'Right')]))
    const update = instance.update(frame(50, [makeReading('h1', 'Left')]))
    expect(update.right?.id).toBe('h1')
    expect(update.left).toBeNull()
  })

  it('inverts the label when the preview is not mirrored', () => {
    const instance = tracker(false)
    const update = instance.update(frame(0, [makeReading('h1', 'Left')]))
    expect(update.right?.id).toBe('h1')
  })

  it('holds a missing hand briefly and never fabricates a replacement', () => {
    const instance = tracker()
    instance.update(
      frame(0, [makeReading('h1', 'Right'), makeReading('h2', 'Left')]),
    )
    const dropped = instance.update(frame(50, [makeReading('h1', 'Right')]))
    expect(dropped.left?.status).toBe('lost')
    expect(dropped.left?.id).toBe('h2')
    expect(dropped.visible).toEqual(['right'])
    expect(dropped.lost).toEqual(['left'])
  })

  it('drops a hand after the loss tolerance and reacquires the same id', () => {
    const instance = tracker()
    instance.update(frame(0, [makeReading('h1', 'Right')]))
    expect(instance.update(frame(400, [])).right).toBeNull()
    const again = instance.update(frame(450, [makeReading('h1', 'Right')]))
    expect(again.right?.status).toBe('reacquired')
  })

  it('keeps independent palm histories for both hands', () => {
    const instance = tracker()
    instance.update(
      frame(0, [
        makeReading('h1', 'Right', ['index'], { x: 0.2, y: 0.3 }),
        makeReading('h2', 'Left', ['index'], { x: 0.8, y: 0.3 }),
      ]),
    )
    expect(instance.getState('right')?.palmHistory[0]?.x).toBeCloseTo(0.2)
    expect(instance.getState('left')?.palmHistory[0]?.x).toBeCloseTo(0.8)
  })
})
