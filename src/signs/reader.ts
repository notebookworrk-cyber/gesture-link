import type { StaticGestureId } from '@/vision/types'
import type { HandReading } from '@/vision/types'

/** The reader keeps the recognition categories strictly separate. */
export type ReaderMode = 'count' | 'shape' | 'model'

export interface ReaderReading {
  /** Stable identity of the reading, used by the temporal stabiliser. */
  key: string
  /** Text shown for the reading. */
  text: string
  /** 0…1 estimate. Geometric modes report a fixed, honest value. */
  confidence: number
  /** True when nothing could be read. */
  unknown: boolean
}

/** Number of fingers shown in the count mode, including the thumb. */
export function countFingers(reading: HandReading): number {
  const { thumb, index, middle, ring, pinky } = reading.fingers
  return Number(thumb) + Number(index) + Number(middle) + Number(ring) + Number(pinky)
}

/**
 * The control-shape mode reports the geometric hand shapes the engine already
 * classifies. They are hand positions for controlling the app, not sign
 * language words, and the interface says so wherever they appear.
 */
export const CONTROL_SHAPES: StaticGestureId[] = [
  'open-palm',
  'fist',
  'point',
  'peace',
  'thumbs-up',
  'pinch',
  'three',
]

export function isControlShape(gesture: StaticGestureId): boolean {
  return CONTROL_SHAPES.includes(gesture)
}

/**
 * Builds the reading for a frame in the given mode. `modelResult` is only used
 * by the custom-model mode; the geometric modes never pretend to be a trained
 * classifier.
 */
export function readFrame(
  mode: ReaderMode,
  hand: HandReading | null,
  modelResult: { labelId: string; name: string; confidence: number; unknown: boolean } | null,
): ReaderReading {
  if (!hand) {
    return { key: 'none', text: '', confidence: 0, unknown: true }
  }

  if (mode === 'count') {
    const count = countFingers(hand)
    return {
      key: `count:${count}`,
      text: String(count),
      confidence: 1,
      unknown: false,
    }
  }

  if (mode === 'shape') {
    const gesture = hand.gesture
    if (!isControlShape(gesture)) {
      return { key: 'shape:none', text: '', confidence: 0, unknown: true }
    }
    return {
      key: `shape:${gesture}`,
      text: gesture,
      confidence: 1,
      unknown: false,
    }
  }

  if (!modelResult || modelResult.unknown || !modelResult.labelId) {
    return { key: 'model:none', text: '', confidence: 0, unknown: true }
  }
  return {
    key: `model:${modelResult.labelId}`,
    text: modelResult.name,
    confidence: modelResult.confidence,
    unknown: false,
  }
}

/**
 * Temporal stabilisation. A reading is only committed when the same key has
 * been seen for the configured number of frames, so a single noisy frame never
 * becomes a word.
 */
export class SignStabilizer {
  private lastKey = ''
  private streak = 0
  private required: number

  constructor(required = 3) {
    this.required = Math.max(1, required)
  }

  /** Feeds one reading. Returns true on the frame the reading is committed. */
  push(key: string): boolean {
    if (key === this.lastKey) {
      this.streak += 1
    } else {
      this.lastKey = key
      this.streak = 1
    }
    return this.streak >= this.required
  }

  /** The key that is currently being held. */
  get current(): string {
    return this.lastKey
  }

  /** Progress toward the commit threshold, 0…1. */
  get progress(): number {
    return Math.min(1, this.streak / this.required)
  }

  reset(): void {
    this.lastKey = ''
    this.streak = 0
  }
}

export type SentenceTokenKind = 'word' | 'space'

export interface SentenceToken {
  kind: SentenceTokenKind
  text: string
}

/** Appends a word to the sentence, keeping a single space between words. */
export function appendWord(tokens: SentenceToken[], text: string): SentenceToken[] {
  const value = text.trim()
  if (!value) return tokens
  const next = [...tokens]
  if (next.length > 0 && next[next.length - 1]!.kind === 'space') next.pop()
  next.push({ kind: 'word', text: value })
  return next
}

/** Adds a space between two words. */
export function addSpace(tokens: SentenceToken[]): SentenceToken[] {
  if (tokens.length === 0) return tokens
  const last = tokens[tokens.length - 1]!
  if (last.kind === 'space') return tokens
  return [...tokens, { kind: 'space', text: ' ' }]
}

/** Removes the last word or space. */
export function deleteLast(tokens: SentenceToken[]): SentenceToken[] {
  if (tokens.length === 0) return tokens
  return tokens.slice(0, -1)
}

/** Renders the sentence as plain text. */
export function sentenceText(tokens: SentenceToken[]): string {
  return tokens
    .map((token) => (token.kind === 'space' ? ' ' : token.text))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
