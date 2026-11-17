import { DuplicateSuppressor } from './DuplicateSuppressor'
import { PredictionStabilizer } from './PredictionStabilizer'
import type {
  RecognitionCandidate,
  RecognitionPhase,
  RecognitionSettings,
} from './types'

export interface SegmentUpdate {
  phase: RecognitionPhase
  key: string
  candidate: RecognitionCandidate | null
  startedAt: number
  ready: boolean
  transitioned: boolean
  neutral: boolean
  score: number
  progress: number
  /** Raw motion passed in, exposed for the debug panel. */
  motion: number
}

/**
 * Turns a stream of predictions into discrete sign events.
 *
 * The previous code committed on a three-frame streak and only re-armed when a
 * hand vanished. Here a commit is a state transition with explicit release and
 * re-arm rules, so a held sign or incidental jitter cannot create a second
 * event.
 */
export class SignSegmenter {
  private phase: RecognitionPhase = 'idle'
  private segmentKey = ''
  private startedAt = 0
  private lastCandidate: RecognitionCandidate | null = null
  private pendingKey = ''
  private pendingSince = 0
  private transitioned = false
  private neutralSince: number | null = null
  private score = 0
  private progress = 0
  private lastMotion = 0
  private readonly settings: RecognitionSettings
  private readonly stabilizer: PredictionStabilizer
  private readonly suppressor: DuplicateSuppressor

  constructor(settings: RecognitionSettings) {
    this.settings = settings
    this.stabilizer = new PredictionStabilizer(
      settings.stabilityMs,
      settings.minConfidence,
    )
    this.suppressor = new DuplicateSuppressor(
      settings.releaseMs,
      settings.duplicateSuppression,
    )
  }

  update(
    candidate: RecognitionCandidate | null,
    motion: number,
    now: number,
  ): SegmentUpdate {
    const valid =
      candidate !== null &&
      candidate.key !== '' &&
      candidate.confidence >= this.settings.minConfidence
    const active = valid ? candidate : null
    const result = this.stabilizer.push(active, now)
    this.score = result.score
    this.progress = result.progress
    this.lastMotion = motion
    this.lastCandidate = active

    if (!active) {
      this.neutralSince ??= now
      // Feeding the neutral state to the suppressor is what re-arms a held
      // sign after a real release. Small movement alone never does this.
      this.suppressor.canCommit({
        key: this.segmentKey,
        now,
        transitioned: false,
        neutral: true,
      })
      const released = now - this.neutralSince >= this.settings.releaseMs
      if (released && this.phase !== 'idle') {
        this.phase = 'idle'
        this.segmentKey = ''
        this.transitioned = false
      }
      return this.snapshot(false, false, true)
    }

    this.neutralSince = null

    if (this.phase === 'idle') {
      this.beginSegment(active, now, false)
    } else if (active.key !== this.segmentKey) {
      if (this.pendingKey !== active.key) {
        this.pendingKey = active.key
        this.pendingSince = now
      } else if (
        result.key === active.key &&
        result.stable &&
        now - this.pendingSince >= this.settings.transitionMs
      ) {
        this.beginSegment(active, this.pendingSince, true)
      }
    } else {
      this.pendingKey = ''
      this.pendingSince = 0
    }

    const duration = now - this.startedAt
    if (this.phase === 'candidate') {
      if (duration >= this.settings.minDurationMs && result.stable && result.key === this.segmentKey) {
        this.phase = 'stabilizing'
      }
    } else if (this.phase === 'stabilizing') {
      const ready = (result.stable && result.key === this.segmentKey) || duration >= this.settings.maxDurationMs
      if (ready) this.phase = 'confirmed'
    }

    let ready = false
    if (this.phase === 'confirmed') {
      ready = this.suppressor.canCommit({
        key: this.segmentKey,
        now,
        transitioned: this.transitioned,
        neutral: false,
      })
      if (ready) this.phase = 'committed'
    }
    if (this.phase === 'committed') {
      // A long hold is still one event. Only a verified new sign or a neutral
      // release may leave the committed phase.
      if (this.transitioned && active.key !== this.segmentKey) this.phase = 'idle'
    }

    return this.snapshot(ready, this.transitioned, false)
  }

  /** Marks the last ready event as consumed after the manager emits it. */
  consume(key: string, eventId: string | undefined, now: number): void {
    this.suppressor.consume(key, eventId, now)
    this.phase = 'waiting_for_release'
  }

  reset(): void {
    this.phase = 'idle'
    this.segmentKey = ''
    this.startedAt = 0
    this.lastCandidate = null
    this.pendingKey = ''
    this.pendingSince = 0
    this.transitioned = false
    this.neutralSince = null
    this.score = 0
    this.progress = 0
    this.stabilizer.reset()
    this.suppressor.reset()
  }

  get state(): RecognitionPhase {
    return this.phase
  }

  get stabilization(): number {
    return this.progress
  }

  get voteScore(): number {
    return this.score
  }

  get duplicateSuppressed(): boolean {
    return !this.suppressor.isArmed
  }

  get lastCommitted(): string {
    return this.suppressor.lastCommitted
  }

  private beginSegment(candidate: RecognitionCandidate, at: number, transitioned: boolean): void {
    this.segmentKey = candidate.key
    this.startedAt = at
    this.phase = 'candidate'
    this.transitioned = transitioned
    this.pendingKey = ''
    this.pendingSince = 0
  }

  private snapshot(ready: boolean, transitioned: boolean, neutral: boolean): SegmentUpdate {
    return {
      phase: this.phase,
      key: this.segmentKey,
      candidate: this.lastCandidate,
      startedAt: this.startedAt,
      ready,
      transitioned,
      neutral,
      score: this.score,
      progress: this.progress,
      motion: this.lastMotion,
    }
  }
}
