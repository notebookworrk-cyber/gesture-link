export interface ReleaseInput {
  /** Key of the candidate that is asking to be committed. */
  key: string
  now: number
  /** True when the segmenter saw a genuinely different, stable sign. */
  transitioned: boolean
  /** True when no sign has been present long enough to count as a release. */
  neutral: boolean
  /** Optional id check: an event already seen is always rejected. */
  eventId?: string
}

/**
 * The permanent duplicate guard.
 *
 * Once an event is consumed the suppressor stays disarmed. Neither elapsed
 * time nor small landmark movement can re-arm it: only a neutral state or a
 * genuinely different sign segment can. This is the architectural fix for a
 * held sign producing repeated words and repeated speech.
 */
export class DuplicateSuppressor {
  private armed = true
  private lastKey = ''
  private lastCommittedAt = 0
  private neutralSince: number | null = null
  private readonly seen = new Set<string>()

  private readonly releaseMs: number
  private readonly enabled: boolean

  constructor(releaseMs: number, enabled = true) {
    this.releaseMs = releaseMs
    this.enabled = enabled
  }

  canCommit(input: ReleaseInput): boolean {
    if (input.eventId && this.seen.has(input.eventId)) return false
    if (!this.enabled) return true
    if (this.armed) return true

    if (input.neutral) {
      if (this.neutralSince === null) this.neutralSince = input.now
      if (input.now - this.neutralSince >= this.releaseMs) this.rearm()
      return false
    }
    this.neutralSince = null

    // A different key alone is not enough: the segmenter must have verified a
    // real boundary, otherwise a jitter misread would re-arm the same sign.
    if (input.transitioned && input.key !== this.lastKey) {
      this.rearm()
      return true
    }
    return false
  }

  consume(key: string, eventId: string | undefined, now: number): void {
    this.armed = false
    this.lastKey = key
    this.lastCommittedAt = now
    this.neutralSince = null
    if (eventId) this.seen.add(eventId)
  }

  rearm(): void {
    this.armed = true
    this.neutralSince = null
  }

  reset(): void {
    this.armed = true
    this.lastKey = ''
    this.lastCommittedAt = 0
    this.neutralSince = null
    this.seen.clear()
  }

  get isArmed(): boolean {
    return this.armed
  }

  get lastCommitted(): string {
    return this.lastKey
  }

  get committedAt(): number {
    return this.lastCommittedAt
  }
}
