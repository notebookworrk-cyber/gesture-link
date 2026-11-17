import type { RecognitionEvent } from '@/recognition/types'
import type { SpeechMode } from '@/settings/settingsStore'
import { SentenceCommitManager } from './SentenceCommitManager'
import { SpeechDeduplicator } from './SpeechDeduplicator'
import { SpeechQueue } from './SpeechQueue'
import { eventToSpeech, type SpeechOptions, type SpeechSource } from './types'

/**
 * Converts committed recognition events into speech events.
 *
 * Raw classifier predictions are never accepted here: only a
 * `RecognitionEvent` from the SignEventManager can enter the speech layer.
 */
export class SpeechEventManager {
  private readonly deduplicator = new SpeechDeduplicator()
  private readonly queue = new SpeechQueue()
  private readonly sentences = new SentenceCommitManager()
  private options: SpeechOptions

  constructor(options: SpeechOptions) {
    this.options = options
  }

  consume(
    event: RecognitionEvent,
    mode: SpeechMode,
    autoAllowed: boolean,
  ): ReturnType<typeof eventToSpeech> | null {
    if (mode === 'auto' && !autoAllowed) return null
    if (!this.deduplicator.accept(event.id)) return null
    const source: SpeechSource = mode === 'sentence' || mode === 'auto' ? 'sentence' : 'word'

    if (source === 'sentence') {
      const boundary = this.sentences.push(event)
      if (mode === 'auto' || boundary) {
        return this.flush()
      }
      return null
    }
    return this.enqueue(event, 'word')
  }

  /** Manual speech also goes through the same id-based deduplication. */
  manual(event: RecognitionEvent): ReturnType<typeof eventToSpeech> | null {
    if (!this.deduplicator.accept(event.id)) return null
    const speech = eventToSpeech(event, 'manual', this.options)
    this.queue.enqueue(speech)
    return speech
  }

  flush(): ReturnType<typeof eventToSpeech> | null {
    const sentence = this.sentences.flush()
    if (!sentence) return null
    const boundary: RecognitionEvent = {
      id: `sentence_${sentence.events.map((event) => event.id).join('_')}`,
      key: 'sentence',
      text: sentence.text,
      confidence: 1,
      source: 'model',
      hands: [],
      startedAt: sentence.events[0]!.startedAt,
      committedAt: Date.now(),
      durationMs: 0,
    }
    return this.enqueue(boundary, 'sentence')
  }

  configure(options: SpeechOptions): void {
    this.options = options
  }

  get queueState(): SpeechQueue {
    return this.queue
  }

  private enqueue(
    event: RecognitionEvent,
    source: SpeechSource,
  ): ReturnType<typeof eventToSpeech> {
    const speech = eventToSpeech(event, source, this.options)
    this.queue.enqueue(speech)
    return speech
  }
}

