import { countFingers } from '@/signs/reader'
import { PredictionStabilizer } from './PredictionStabilizer'
import type { HandSlot, TwoHandUpdate } from './types'

export interface NumberReading {
  slot: HandSlot
  value: number | null
  confidence: number
  /** True when the hand is visible and its shape is a known number. */
  known: boolean
}

export interface TwoHandNumbers {
  left: NumberReading
  right: NumberReading
  bothKnown: boolean
}

const unknown = (slot: HandSlot): NumberReading => ({
  slot,
  value: null,
  confidence: 0,
  known: false,
})

/**
 * Reads a number from each hand independently.
 *
 * A fist is only zero when it is actually classified as a fist. An
 * unrecognised or missing hand is never reported as zero. Predictions are
 * temporally stabilised so a flicker cannot change a number mid-sentence.
 */
export class NumberRecognizer {
  private readonly left: PredictionStabilizer
  private readonly right: PredictionStabilizer

  constructor() {
    this.left = new PredictionStabilizer(220, 0.5)
    this.right = new PredictionStabilizer(220, 0.5)
  }

  update(update: TwoHandUpdate, now: number): TwoHandNumbers {
    const left = this.read('left', update, now, this.left)
    const right = this.read('right', update, now, this.right)
    return { left, right, bothKnown: left.known && right.known }
  }

  reset(): void {
    this.left.reset()
    this.right.reset()
  }

  private read(
    slot: HandSlot,
    update: TwoHandUpdate,
    now: number,
    stabilizer: PredictionStabilizer,
  ): NumberReading {
    const state = slot === 'left' ? update.left : update.right
    if (!state || state.status === 'lost') {
      stabilizer.reset()
      return unknown(slot)
    }
    const reading = state.reading
    const fingers = countFingers(reading)
    // A closed fist is a legitimate zero; any other shape with no extended
    // fingers is simply unrecognised and must not be invented as a number.
    const shapeKnown = fingers > 0 || reading.gesture === 'fist'
    if (!shapeKnown) {
      stabilizer.reset()
      return unknown(slot)
    }
    const raw: NumberReading = {
      slot,
      value: fingers,
      confidence: Math.max(0, Math.min(1, reading.score)),
      known: true,
    }
    const result = stabilizer.push(
      {
        key: `number:${slot}:${fingers}`,
        text: String(fingers),
        confidence: raw.confidence,
        source: 'number',
        hands: [slot],
      },
      now,
    )
    return { ...raw, confidence: result.stable ? raw.confidence : raw.confidence * 0.8 }
  }
}
