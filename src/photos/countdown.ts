import type { StaticGestureId } from '@/vision/types'
import type { GestureBinding } from '@/settings/settingsStore'

/**
 * The capture countdown rules, kept separate from the view so they can be
 * tested without a camera: a peace sign starts a three second countdown, the
 * countdown only finishes while the bound shape is still held, and releasing
 * the shape cancels it.
 */
export const COUNTDOWN_SECONDS = 3

/** Starts a countdown, or keeps the running one. */
export function startCountdown(current: number | null, seconds = COUNTDOWN_SECONDS): number {
  if (current !== null) return current
  return seconds
}

/** True when the countdown reached zero and the photograph must be taken. */
export function isCountdownComplete(remaining: number | null): boolean {
  return remaining === 0
}

/**
 * The countdown is cancelled when the bound hand shape is released, and when no
 * shape is bound to the capture action at all.
 */
export function shouldCancelCountdown(
  remaining: number | null,
  heldGesture: StaticGestureId,
  boundGesture: GestureBinding,
): boolean {
  if (remaining === null) return false
  if (boundGesture === 'none') return false
  return heldGesture !== boundGesture
}
