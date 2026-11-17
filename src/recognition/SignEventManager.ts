import { SignSegmenter } from './SignSegmenter'
import type {
  HandSlot,
  RecognitionCandidate,
  RecognitionEvent,
  RecognitionSettings,
} from './types'

type Listener = (event: RecognitionEvent) => void

/**
 * The only component allowed to create recognition events.
 *
 * Consumers (sentence builder, captions, speech) subscribe to these events;
 * they never see raw frame predictions. Every event carries a unique id that
 * the speech layer deduplicates on.
 */
export class SignEventManager {
  private settings: RecognitionSettings
  private segmenter: SignSegmenter
  private readonly listeners = new Set<Listener>()
  private counter = 0
  private lastLatencyMs = 0
  private lostSlots: HandSlot[] = []
  private eventCount = 0

  constructor(settings: RecognitionSettings) {
    this.settings = settings
    this.segmenter = new SignSegmenter(settings)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Reconfigures the pipeline without replacing the subscribed instance. */
  configure(settings: RecognitionSettings): void {
    this.settings = settings
    this.segmenter = new SignSegmenter(settings)
    this.lostSlots = []
    this.lastLatencyMs = 0
  }

  update(
    candidate: RecognitionCandidate | null,
    motion: number,
    now: number,
    context: { lost?: HandSlot[]; latencyMs?: number } = {},
  ): RecognitionEvent | null {
    this.lostSlots = context.lost ?? []
    this.lastLatencyMs = context.latencyMs ?? 0
    const update = this.segmenter.update(candidate, motion, now)
    if (!update.ready || !update.candidate) return null

    const id = `evt_${now.toString(36)}_${(this.counter += 1).toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 7)}`
    const event: RecognitionEvent = {
      id,
      key: update.candidate.key,
      text: update.candidate.text,
      confidence: update.candidate.confidence,
      source: update.candidate.source,
      hands: update.candidate.hands,
      startedAt: update.startedAt,
      committedAt: now,
      durationMs: now - update.startedAt,
    }
    this.segmenter.consume(event.key, event.id, now)
    this.eventCount += 1
    for (const listener of this.listeners) listener(event)
    return event
  }

  reset(): void {
    this.segmenter.reset()
    this.lostSlots = []
    this.lastLatencyMs = 0
  }

  get debug() {
    return {
      phase: this.segmenter.state,
      candidate: this.segmenter.lastCommitted,
      stabilization: this.segmenter.stabilization,
      score: this.segmenter.voteScore,
      lastCommitted: this.segmenter.lastCommitted,
      duplicateSuppressed: this.segmenter.duplicateSuppressed,
      trackingLoss: [...this.lostSlots],
      latencyMs: this.lastLatencyMs,
      eventCount: this.eventCount,
      settings: this.settings,
    }
  }
}
