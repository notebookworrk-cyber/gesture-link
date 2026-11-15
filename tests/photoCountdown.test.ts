import { describe, expect, it } from 'vitest'
import {
  COUNTDOWN_SECONDS,
  isCountdownComplete,
  shouldCancelCountdown,
  startCountdown,
} from '@/photos/countdown'

describe('capture countdown', () => {
  it('counts down from three seconds', () => {
    expect(COUNTDOWN_SECONDS).toBe(3)
    expect(startCountdown(null)).toBe(3)
  })

  it('keeps a running countdown', () => {
    expect(startCountdown(2)).toBe(2)
    expect(startCountdown(0)).toBe(0)
  })

  it('completes at zero', () => {
    expect(isCountdownComplete(0)).toBe(true)
    expect(isCountdownComplete(1)).toBe(false)
    expect(isCountdownComplete(null)).toBe(false)
  })

  it('cancels when the bound shape is released', () => {
    expect(shouldCancelCountdown(3, 'none', 'peace')).toBe(true)
    expect(shouldCancelCountdown(3, 'open-palm', 'peace')).toBe(true)
  })

  it('keeps counting while the shape is held', () => {
    expect(shouldCancelCountdown(3, 'peace', 'peace')).toBe(false)
    expect(shouldCancelCountdown(1, 'peace', 'peace')).toBe(false)
  })

  it('never cancels when no shape is bound', () => {
    expect(shouldCancelCountdown(3, 'none', 'none')).toBe(false)
  })

  it('does nothing when no countdown is running', () => {
    expect(shouldCancelCountdown(null, 'none', 'peace')).toBe(false)
  })
})
