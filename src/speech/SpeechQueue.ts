import type { SpeechEvent } from './types'

/** Ordered, id-deduplicated queue. A queued phrase can be cancelled by id. */
export class SpeechQueue {
  private entries: SpeechEvent[] = []
  private active: SpeechEvent | null = null
  private readonly seen = new Set<string>()

  enqueue(event: SpeechEvent): boolean {
    if (this.seen.has(event.id)) return false
    this.seen.add(event.id)
    this.entries.push(event)
    return true
  }

  next(): SpeechEvent | null {
    if (this.active) return null
    const event = this.entries.shift() ?? null
    this.active = event
    return event
  }

  complete(): void {
    this.active = null
  }

  cancel(id: string): boolean {
    const before = this.entries.length
    this.entries = this.entries.filter((event) => event.id !== id)
    if (this.active?.id === id) this.active = null
    return this.entries.length !== before
  }

  clear(): void {
    this.entries = []
    this.active = null
  }

  get pending(): number {
    return this.entries.length
  }

  get current(): SpeechEvent | null {
    return this.active
  }

  get pendingEvents(): SpeechEvent[] {
    return [...this.entries]
  }
}
