import { INDEX_TIP } from '@/vision/geometry'
import type { HandReading } from '@/vision/types'
import type { GestureSettings } from './types'

export type DominantHand = 'left' | 'right' | 'any'

export function pickGestureHand(
  hands: HandReading[],
  dominant: DominantHand,
): HandReading | null {
  if (hands.length === 0) return null
  if (dominant === 'any') {
    return hands.reduce((best, hand) => (hand.score > best.score ? hand : best), hands[0]!)
  }
  const wanted = dominant === 'left' ? 'Left' : 'Right'
  return hands.find((hand) => hand.handedness === wanted) ?? hands[0]!
}

export interface StageSize {
  width: number
  height: number
}

/**
 * Maps a fingertip into stage coordinates. The active area is a centred
 * fraction of the camera frame, so `reach` makes small hand movements travel
 * further without changing the camera.
 */
export function mapHandToStage(
  hand: HandReading,
  reach: number,
  mirror: boolean,
  stage: StageSize,
): { x: number; y: number } {
  const point = hand.landmarks[INDEX_TIP]
  if (!point) return { x: stage.width / 2, y: stage.height / 2 }
  const rawX = mirror ? 1 - point.x : point.x
  const safeReach = Math.min(1, Math.max(0.5, reach))
  const x = 0.5 + (rawX - 0.5) / safeReach
  const y = 0.5 + (point.y - 0.5) / safeReach
  return {
    x: Math.min(1.01, Math.max(-0.01, x)) * stage.width,
    y: Math.min(1.01, Math.max(-0.01, y)) * stage.height,
  }
}

export interface GestureIntent {
  pinching: boolean
  paused: boolean
  fist: boolean
  pan: boolean
  peaceFired: boolean
}

export function readIntent(
  hand: HandReading,
  settings: GestureSettings,
): GestureIntent {
  const pinching = hand.gesture === 'pinch'
  const paused = hand.gesture === 'open-palm'
  const fist = hand.gesture === 'fist'
  const peace = hand.gesture === 'peace'
  return {
    pinching,
    paused,
    fist,
    pan: peace && settings.twoFingerPan && settings.peaceAction === 'none',
    peaceFired: peace && hand.fired === 'peace' && settings.peaceAction !== 'none',
  }
}

/** Exponential smoothing for the gesture cursor, in screen pixels. */
export function smoothPoint(
  previous: { x: number; y: number } | null,
  next: { x: number; y: number },
  amount: number,
): { x: number; y: number } {
  if (!previous) return next
  const t = Math.min(0.92, Math.max(0.08, amount))
  return {
    x: previous.x + (next.x - previous.x) * t,
    y: previous.y + (next.y - previous.y) * t,
  }
}
