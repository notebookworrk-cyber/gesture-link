import type { RecognitionEvent } from '@/recognition/types'

/**
 * Accumulates committed word events into sentences. It never invents text:
 * a sentence is exactly the joined text of the events it received.
 */
export class SentenceCommitManager {
  private words: RecognitionEvent[] = []

  push(event: RecognitionEvent): boolean {
    this.words.push(event)
    return isBoundary(event.text)
  }

  flush(): { text: string; events: RecognitionEvent[] } | null {
    if (this.words.length === 0) return null
    const events = [...this.words]
    const text = events.map((event) => event.text).join(' ')
    this.words = []
    return { text, events }
  }

  get sentence(): string {
    return this.words.map((event) => event.text).join(' ')
  }

  get size(): number {
    return this.words.length
  }

  reset(): void {
    this.words = []
  }
}

function isBoundary(text: string): boolean {
  return /[.!?।]$/.test(text.trim())
}
