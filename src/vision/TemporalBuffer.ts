/**
 * Fixed-capacity ring buffer of timestamped observations.
 *
 * Recognition needs a short history of landmarks, not the whole session: a
 * 2 s window at 30 Hz is 60 entries per hand. The buffer never grows, never
 * allocates during push, and drops the oldest entry instead of blocking.
 */
export interface Timed {
  timestamp: number
}

export class TemporalBuffer<T extends Timed> {
  private readonly items: Array<T | null>
  private head = 0
  private count = 0
  readonly capacity: number

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('TemporalBuffer capacity must be a positive integer')
    }
    this.capacity = capacity
    this.items = new Array<T | null>(capacity).fill(null)
  }

  get size(): number {
    return this.count
  }

  /** True when the buffer holds enough history for a full window. */
  get full(): boolean {
    return this.count === this.capacity
  }

  push(item: T): void {
    // Out-of-order frames would corrupt every derived velocity, so a stale
    // timestamp is dropped rather than inserted.
    const latest = this.latest()
    if (latest && item.timestamp < latest.timestamp) return
    this.items[this.head] = item
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count += 1
  }

  latest(): T | null {
    if (this.count === 0) return null
    const index = (this.head - 1 + this.capacity) % this.capacity
    return this.items[index] ?? null
  }

  /** Oldest first. */
  entries(): T[] {
    const out: T[] = []
    const start = (this.head - this.count + this.capacity) % this.capacity
    for (let offset = 0; offset < this.count; offset += 1) {
      const item = this.items[(start + offset) % this.capacity]
      if (item) out.push(item)
    }
    return out
  }

  /** Entries at or after `since`, oldest first. */
  since(since: number): T[] {
    return this.entries().filter((item) => item.timestamp >= since)
  }

  /** Time covered by the stored entries in milliseconds. */
  span(): number {
    const oldest = this.entries()[0]
    const newest = this.latest()
    if (!oldest || !newest) return 0
    return Math.max(0, newest.timestamp - oldest.timestamp)
  }

  clear(): void {
    this.items.fill(null)
    this.head = 0
    this.count = 0
  }
}
