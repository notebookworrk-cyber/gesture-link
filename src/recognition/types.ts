import type { HandReading } from '@/vision/types'

export type HandSlot = 'left' | 'right'
export type HandTrackingStatus = 'tracking' | 'lost' | 'reacquired'
export type RecognitionPhase =
  | 'idle'
  | 'candidate'
  | 'stabilizing'
  | 'confirmed'
  | 'committed'
  | 'waiting_for_release'

/** Where a prediction came from. Raw predictions are never events. */
export type PredictionSource = 'count' | 'shape' | 'model' | 'two-hand' | 'number'

export interface RecognitionCandidate {
  /** Stable key for the predicted sign, empty when nothing is recognised. */
  key: string
  text: string
  confidence: number
  source: PredictionSource
  /** Which hands produced this prediction. */
  hands: HandSlot[]
}

export interface RecognitionEvent {
  /** Globally unique id. The speech layer dedupes on this value. */
  id: string
  key: string
  text: string
  confidence: number
  source: PredictionSource
  hands: HandSlot[]
  startedAt: number
  committedAt: number
  durationMs: number
}

export interface RecognitionSettings {
  /** Minimum candidate confidence, 0…1. */
  minConfidence: number
  /** How long a key must be stable before it can be confirmed. */
  stabilityMs: number
  /** Shortest and longest accepted sign segments. */
  minDurationMs: number
  maxDurationMs: number
  /** How long a neutral state is required before re-arming. */
  releaseMs: number
  /** How long a different key must persist to count as a new sign. */
  transitionMs: number
  /** Palm travel below this value is incidental jitter, not a new sign. */
  jitterDistance: number
  /** Grace period before a missing hand is treated as gone. */
  handLossMs: number
  /** Whether duplicate suppression is active. It should normally stay on. */
  duplicateSuppression: boolean
}

export const defaultRecognitionSettings: RecognitionSettings = {
  minConfidence: 0.45,
  stabilityMs: 260,
  minDurationMs: 320,
  maxDurationMs: 4000,
  releaseMs: 220,
  transitionMs: 200,
  jitterDistance: 0.035,
  handLossMs: 260,
  duplicateSuppression: true,
}

/** Per-hand state kept by the two-hand tracker. */
export interface HandState {
  id: string
  slot: HandSlot
  handedness: HandReading['handedness']
  reading: HandReading
  status: HandTrackingStatus
  lastSeen: number
  lostDurationMs: number
  /** Short palm trail used for jitter and transition detection. */
  palmHistory: Array<{ at: number; x: number; y: number }>
}

export interface TwoHandUpdate {
  timestamp: number
  left: HandState | null
  right: HandState | null
  /** Slots that were visible on this frame. */
  visible: HandSlot[]
  /** Slots temporarily held from the previous frame. */
  lost: HandSlot[]
}
