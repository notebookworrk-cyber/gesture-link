import type { StaticGestureId } from './types'

export interface GestureStateConfig {
  /** How long a shape must be held before it fires. */
  holdMs: number
  /** Minimum gap between two fired events. */
  cooldownMs: number
  /** A short tracking dropout keeps the pending shape instead of restarting it. */
  lossToleranceMs: number
}

export interface GestureUpdate {
  /** Shape currently being tracked, including during the hold. */
  current: StaticGestureId | null
  /** 0..1 progress toward the hold threshold. */
  progress: number
  /** Set on the frame where the hold completes. */
  fired: StaticGestureId | null
}

/**
 * Turns a per-frame shape into discrete gestures. Without this, a wave of the
 * hand fires a dozen events and every workspace has to re-implement debouncing.
 *
 * A held shape fires once. Repeating it requires releasing the shape (or losing
 * the hand) and holding it again, so a long pinch does not toggle a tool twice.
 */
export class GestureStateMachine {
  private config: GestureStateConfig
  private pending: StaticGestureId | null = null
  private pendingSince = 0
  private lastSeen = 0
  private lastFiredAt = Number.NEGATIVE_INFINITY
  private firedForPending = false

  constructor(config: GestureStateConfig) {
    this.config = { ...config }
  }

  configure(config: Partial<GestureStateConfig>): void {
    this.config = { ...this.config, ...config }
  }

  update(gesture: StaticGestureId | null, now: number): GestureUpdate {
    if (gesture === null || gesture === 'none') {
      if (this.pending && now - this.lastSeen <= this.config.lossToleranceMs) {
        return {
          current: this.pending,
          progress: this.progress(now),
          fired: null,
        }
      }
      this.pending = null
      this.firedForPending = false
      return { current: null, progress: 0, fired: null }
    }

    if (gesture !== this.pending) {
      this.pending = gesture
      this.pendingSince = now
      this.firedForPending = false
    }
    this.lastSeen = now

    if (
      now - this.pendingSince >= this.config.holdMs &&
      !this.firedForPending &&
      now - this.lastFiredAt >= this.config.cooldownMs
    ) {
      this.lastFiredAt = now
      this.firedForPending = true
      return { current: gesture, progress: 1, fired: gesture }
    }

    return { current: gesture, progress: this.progress(now), fired: null }
  }

  reset(): void {
    this.pending = null
    this.pendingSince = 0
    this.lastSeen = 0
    this.lastFiredAt = Number.NEGATIVE_INFINITY
    this.firedForPending = false
  }

  private progress(now: number): number {
    if (!this.pending) return 0
    if (this.config.holdMs <= 0) return 1
    return Math.min(1, Math.max(0, (now - this.pendingSince) / this.config.holdMs))
  }
}
