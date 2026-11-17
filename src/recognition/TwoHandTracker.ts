import type { FrameReading, HandReading } from '@/vision/types'
import { HandIdentityManager } from './HandIdentityManager'
import type { HandSlot, HandState, TwoHandUpdate } from './types'

export interface TwoHandTrackerOptions {
  /** True when the preview mirrors the camera (the default in this app). */
  mirrorLabels: boolean
  /** Grace period before a missing hand is treated as gone. */
  handLossMs: number
  preferred?: HandSlot
}

/**
 * Keeps one independent state object per physical hand.
 *
 * A missing hand is not a new sign: its last state is held and marked `lost`
 * for a configurable grace period. When the same id reappears the state becomes
 * `reacquired`, so consumers can distinguish a dropout from a release.
 */
export class TwoHandTracker {
  private left: HandState | null = null
  private right: HandState | null = null
  private options: TwoHandTrackerOptions
  private identities: HandIdentityManager

  constructor(options: TwoHandTrackerOptions) {
    this.options = options
    this.identities = new HandIdentityManager({
      mirrorLabels: options.mirrorLabels,
      preferred: options.preferred,
    })
  }

  /** Reconfigures tracking without replacing the subscribed instance. */
  configure(options: TwoHandTrackerOptions): void {
    this.options = options
    this.identities = new HandIdentityManager({
      mirrorLabels: options.mirrorLabels,
      preferred: options.preferred,
    })
    this.reset()
  }

  update(frame: FrameReading): TwoHandUpdate {
    const now = frame.timestamp
    const states: Record<HandSlot, HandState | null> = { left: null, right: null }
    const seen = new Set<HandSlot>()
    const lost: HandSlot[] = []

    for (const reading of frame.hands) {
      const slot = this.identities.assign(reading.id, reading.handedness, now)
      const previous = this.stateFor(slot)
      const state: HandState = {
        id: reading.id,
        slot,
        handedness: reading.handedness,
        reading,
        status: previous?.id === reading.id ? 'tracking' : 'reacquired',
        lastSeen: now,
        lostDurationMs: 0,
        palmHistory: appendHistory(previous?.palmHistory ?? [], now, reading),
      }
      states[slot] = state
      seen.add(slot)
    }

    for (const slot of ['left', 'right'] as HandSlot[]) {
      const current = states[slot]
      if (current) {
        this.setState(slot, current)
        continue
      }
      const previous = this.stateFor(slot)
      if (!previous) continue
      const lostDurationMs = now - previous.lastSeen
      if (lostDurationMs <= this.options.handLossMs) {
        const held: HandState = {
          ...previous,
          status: 'lost',
          lostDurationMs,
          palmHistory: previous.palmHistory,
        }
        this.setState(slot, held)
        lost.push(slot)
      } else {
        this.identities.forget(previous.id)
        this.setState(slot, null)
      }
    }

    return {
      timestamp: now,
      left: this.left,
      right: this.right,
      visible: [...seen],
      lost,
    }
  }

  getState(slot: HandSlot): HandState | null {
    return this.stateFor(slot)
  }

  reset(): void {
    this.left = null
    this.right = null
    this.identities.reset()
  }

  private stateFor(slot: HandSlot): HandState | null {
    return slot === 'left' ? this.left : this.right
  }

  private setState(slot: HandSlot, state: HandState | null): void {
    if (slot === 'left') this.left = state
    else this.right = state
  }
}

function appendHistory(
  history: HandState['palmHistory'],
  at: number,
  reading: HandReading,
): HandState['palmHistory'] {
  const { x, y } = reading.palmCenter
  const next = [...history, { at, x, y }]
  while (next.length > 2 && at - next[0]!.at > 1200) next.shift()
  return next.slice(-60)
}
