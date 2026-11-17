import type { RecognitionSettingsState } from '@/settings/settingsStore'
import type { TwoHandTrackerOptions } from './TwoHandTracker'
import type { HandSlot, RecognitionSettings, TwoHandUpdate } from './types'

export function recognitionSettingsFrom(
  settings: RecognitionSettingsState,
): RecognitionSettings {
  return {
    minConfidence: settings.minConfidence,
    stabilityMs: settings.stabilityMs,
    minDurationMs: settings.minDurationMs,
    maxDurationMs: settings.maxDurationMs,
    releaseMs: settings.releaseMs,
    transitionMs: settings.transitionMs,
    jitterDistance: settings.jitterDistance,
    handLossMs: settings.handLossMs,
    duplicateSuppression: settings.duplicateSuppression,
  }
}

export function trackerOptionsFrom(
  settings: RecognitionSettingsState,
  mirrorLabels: boolean,
): TwoHandTrackerOptions {
  return { mirrorLabels, handLossMs: settings.handLossMs }
}

export type PalmPoint = { x: number; y: number }

/**
 * Largest palm travel between two consecutive updates, in normalised image
 * units. Static signs and incidental jitter stay near zero; a real movement
 * boundary is clearly above the configured jitter distance.
 */
export function palmMotion(
  update: TwoHandUpdate,
  previous: Partial<Record<HandSlot, PalmPoint>>,
): number {
  let largest = 0
  const current: Partial<Record<HandSlot, PalmPoint>> = {}
  for (const slot of update.visible as HandSlot[]) {
    const state = slot === 'left' ? update.left : update.right
    if (!state || state.status === 'lost') continue
    const point = state.reading.palmCenter
    current[slot] = { ...point }
    const before = previous[slot]
    if (!before) continue
    largest = Math.max(largest, Math.hypot(point.x - before.x, point.y - before.y))
  }
  return largest
}

export function palmPoints(update: TwoHandUpdate): Partial<Record<HandSlot, PalmPoint>> {
  const result: Partial<Record<HandSlot, PalmPoint>> = {}
  for (const slot of update.visible as HandSlot[]) {
    const state = slot === 'left' ? update.left : update.right
    if (state && state.status !== 'lost') result[slot] = { ...state.reading.palmCenter }
  }
  return result
}
