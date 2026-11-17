/**
 * Rejects a recognition event that has already produced speech, even if a
 * buggy caller delivers the same id twice or the same sign is held for
 * several seconds.
 */
export class SpeechDeduplicator {
  private readonly seen = new Set<string>()

  accept(recognitionId: string): boolean {
    if (this.seen.has(recognitionId)) return false
    this.seen.add(recognitionId)
    return true
  }

  reset(): void {
    this.seen.clear()
  }

  get size(): number {
    return this.seen.size
  }
}
