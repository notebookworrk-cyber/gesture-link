import { SpeechQueue } from './SpeechQueue'
import type {
  SpeechEvent,
  SpeechState,
  SpeechSynthLike,
  SpeechUtteranceLike,
} from './types'

type Listener = (state: SpeechState) => void

/**
 * Owns speech playback. It only accepts `SpeechEvent`s, which are created by
 * SpeechEventManager from committed recognition events. No classifier output
 * can reach a speaker directly.
 */
export class SpeechEngine {
  private readonly synth: SpeechSynthLike
  private readonly makeUtterance: (event: SpeechEvent) => SpeechUtteranceLike
  private readonly gapMs: number
  private readonly queue = new SpeechQueue()
  private readonly listeners = new Set<Listener>()
  private generation = 0
  private paused = false
  private lastText = ''
  private lastEvent: SpeechEvent | null = null

  constructor(
    synth: SpeechSynthLike,
    makeUtterance: (event: SpeechEvent) => SpeechUtteranceLike,
    gapMs = 140,
  ) {
    this.synth = synth
    this.makeUtterance = makeUtterance
    this.gapMs = gapMs
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  enqueue(event: SpeechEvent): boolean {
    if (!this.queue.enqueue(event)) return false
    this.playNext()
    this.notify()
    return true
  }

  /** Cancels a queued phrase by its speech id. */
  cancel(id: string): boolean {
    const removed = this.queue.cancel(id)
    if (this.queue.current?.id === id) {
      this.generation += 1
      this.synth.cancel()
      this.queue.complete()
      this.playNext()
    }
    this.notify()
    return removed
  }

  pause(): void {
    this.paused = true
    this.synth.pause()
    this.notify()
  }

  resume(): void {
    this.paused = false
    this.synth.resume()
    this.notify()
  }

  stop(): void {
    this.generation += 1
    this.queue.clear()
    this.paused = false
    this.synth.cancel()
    this.notify()
  }

  /** Repeats the last spoken phrase with a fresh id. */
  replay(): boolean {
    if (!this.lastEvent) return false
    const repeat: SpeechEvent = {
      ...this.lastEvent,
      id: `replay_${this.lastEvent.id}_${Date.now().toString(36)}`,
      at: Date.now(),
    }
    return this.enqueue(repeat)
  }

  get state(): SpeechState {
    return {
      speaking: this.queue.current !== null,
      paused: this.paused,
      pending: this.queue.pending,
      lastText: this.lastText,
    }
  }

  get pendingEvents(): SpeechEvent[] {
    return this.queue.pendingEvents
  }

  private playNext(): void {
    if (this.queue.current || this.paused) return
    const event = this.queue.next()
    if (!event) return
    const utterance = this.makeUtterance(event)
    const generation = this.generation
    const finish = () => {
      if (generation !== this.generation) return
      this.queue.complete()
      this.lastText = event.text
      this.lastEvent = event
      this.notify()
      const advance = () => {
        if (generation !== this.generation) return
        this.playNext()
        this.notify()
      }
      if (this.gapMs > 0 && typeof window !== 'undefined') {
        window.setTimeout(advance, this.gapMs)
      } else {
        advance()
      }
    }
    utterance.onend = finish
    utterance.onerror = finish
    this.synth.speak(utterance)
    this.notify()
  }

  private notify(): void {
    const state = this.state
    for (const listener of this.listeners) listener(state)
  }
}
