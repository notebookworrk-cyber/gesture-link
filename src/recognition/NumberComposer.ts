import type { NumberOperation } from '@/settings/settingsStore'
import type { NumberReading, TwoHandNumbers } from './NumberRecognizer'

export interface Composition {
  /** Display text; empty when the inputs are incomplete. */
  text: string
  /** Numeric or concatenated result, null for independent display. */
  result: number | string | null
  /** True when a required hand is missing or unrecognised. */
  incomplete: boolean
  operation: NumberOperation
}

/**
 * Number composition is explicit: the caller chooses addition, subtraction,
 * concatenation or independent display. Nothing is inferred from the hands.
 */
export function composeNumbers(
  numbers: TwoHandNumbers,
  operation: NumberOperation,
): Composition {
  const left = valid(numbers.left)
  const right = valid(numbers.right)
  const incomplete = left === null || right === null
  const describe = (value: number | null) => (value === null ? '—' : String(value))

  if (operation === 'independent') {
    return {
      text: `L ${describe(left)} · R ${describe(right)}`,
      result: null,
      incomplete,
      operation,
    }
  }
  if (incomplete) {
    return { text: '—', result: null, incomplete: true, operation }
  }
  if (operation === 'addition') {
    return { text: `${left} + ${right} = ${left! + right!}`, result: left! + right!, incomplete: false, operation }
  }
  if (operation === 'subtraction') {
    return { text: `${left} − ${right} = ${left! - right!}`, result: left! - right!, incomplete: false, operation }
  }
  // Concatenation is only defined for single digits.
  if (left! > 9 || right! > 9) {
    return { text: '—', result: null, incomplete: true, operation }
  }
  const joined = Number(`${left}${right}`)
  return { text: `${left} and ${right} = ${joined}`, result: joined, incomplete: false, operation }
}

function valid(reading: NumberReading): number | null {
  if (!reading.known || reading.value === null) return null
  return reading.value
}
