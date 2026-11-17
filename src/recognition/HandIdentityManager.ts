import type { Handedness } from '@/vision/types'
import type { HandSlot } from './types'

interface Identity {
  slot: HandSlot
  lastSeen: number
}

const ENTRY_TTL_MS = 1200

/**
 * Maps MediaPipe's stable hand id to a physical slot.
 *
 * The first detected hand is never assumed to be the left hand: a known id
 * keeps its slot, an unknown id uses the handedness label (inverted when the
 * preview is mirrored), and only the remaining slot is used as a fallback.
 */
export class HandIdentityManager {
  private identities = new Map<string, Identity>()

  private readonly options: { mirrorLabels?: boolean; preferred?: HandSlot }

  constructor(options: { mirrorLabels?: boolean; preferred?: HandSlot } = {}) {
    this.options = options
  }

  assign(id: string, handedness: Handedness, now: number): HandSlot {
    this.expire(now)
    const known = this.identities.get(id)
    if (known) {
      known.lastSeen = now
      return known.slot
    }

    // MediaPipe labels assume a mirrored image. When the preview is not
    // mirrored, the label refers to the opposite physical hand.
    const label = this.options.mirrorLabels === false ? invert(handedness) : handedness
    const wanted: HandSlot = label === 'Left' ? 'left' : 'right'
    const taken = new Set(
      [...this.identities.entries()]
        .filter(([key, entry]) => key !== id && now - entry.lastSeen < ENTRY_TTL_MS)
        .map(([, entry]) => entry.slot),
    )
    let slot = wanted
    if (taken.has(slot)) {
      const fallback = this.options.preferred ?? 'right'
      slot = taken.has(fallback) ? (fallback === 'left' ? 'right' : 'left') : fallback
    }
    this.identities.set(id, { slot, lastSeen: now })
    return slot
  }

  /** Temporarily mark an id as seen without changing its slot. */
  touch(id: string, now: number): void {
    const entry = this.identities.get(id)
    if (entry) entry.lastSeen = now
  }

  forget(id: string): void {
    this.identities.delete(id)
  }

  reset(): void {
    this.identities.clear()
  }

  private expire(now: number): void {
    for (const [id, entry] of this.identities) {
      if (now - entry.lastSeen > ENTRY_TTL_MS) this.identities.delete(id)
    }
  }
}

function invert(handedness: Handedness): Handedness {
  return handedness === 'Left' ? 'Right' : 'Left'
}
