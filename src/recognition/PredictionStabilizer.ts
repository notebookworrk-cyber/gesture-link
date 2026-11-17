import type { RecognitionCandidate } from './types'

export interface StabilizerResult {
  key: string
  stable: boolean
  /** Share of recent voting weight held by the winning key, 0…1. */
  score: number
  /** Progress toward a stable decision, 0…1. */
  progress: number
}

interface Vote {
  key: string
  confidence: number
  at: number
}

/**
 * Weighted temporal voting over a sliding window.
 *
 * This replaces the old "three identical frames" rule: noisy frames cannot
 * flip the decision, and a brief dip in confidence cannot undo a stable one
 * (hysteresis). Scores and progress are exposed for the debug UI.
 */
export class PredictionStabilizer {
  private votes: Vote[] = []
  private currentKey = ''
  private currentConfidence = 0

  private readonly stabilityMs: number
  private readonly minConfidence: number

  constructor(stabilityMs: number, minConfidence: number) {
    this.stabilityMs = stabilityMs
    this.minConfidence = minConfidence
  }

  push(candidate: RecognitionCandidate | null, now: number): StabilizerResult {
    this.votes = this.votes.filter((vote) => now - vote.at <= this.stabilityMs)
    if (candidate && candidate.key && candidate.confidence > 0) {
      this.votes.push({
        key: candidate.key,
        confidence: Math.max(0, Math.min(1, candidate.confidence)),
        at: now,
      })
    }
    if (this.votes.length === 0) {
      this.currentKey = ''
      this.currentConfidence = 0
      return { key: '', stable: false, score: 0, progress: 0 }
    }

    const tally = new Map<string, { weight: number; count: number; confidence: number; first: number; last: number }>()
    let total = 0
    for (const vote of this.votes) {
      const entry = tally.get(vote.key) ?? {
        weight: 0,
        count: 0,
        confidence: 0,
        first: vote.at,
        last: vote.at,
      }
      entry.weight += vote.confidence
      entry.count += 1
      entry.confidence = Math.max(entry.confidence, vote.confidence)
      entry.last = vote.at
      total += vote.confidence
      tally.set(vote.key, entry)
    }

    let winner = [...tally.entries()].sort((a, b) => b[1].weight - a[1].weight)[0]!
    // Hysteresis: a challenger must clearly beat the incumbent to take over.
    if (this.currentKey && winner[0] !== this.currentKey) {
      const incumbent = tally.get(this.currentKey)
      if (incumbent && incumbent.weight >= winner[1].weight * 0.8) {
        winner = [this.currentKey, incumbent]
      }
    }

    const [key, entry] = winner
    const score = total > 0 ? entry.weight / total : 0
    const span = entry.last - entry.first
    const confident =
      entry.confidence >=
      (key === this.currentKey ? this.minConfidence * 0.75 : this.minConfidence)
    const stable =
      entry.count >= 2 &&
      span >= Math.min(this.stabilityMs * 0.5, 180) &&
      score >= 0.62 &&
      confident

    this.currentKey = key
    this.currentConfidence = entry.confidence
    return {
      key,
      stable,
      score,
      progress: Math.min(1, (span / Math.max(1, this.stabilityMs)) * score),
    }
  }

  get current(): string {
    return this.currentKey
  }

  get confidence(): number {
    return this.currentConfidence
  }

  reset(): void {
    this.votes = []
    this.currentKey = ''
    this.currentConfidence = 0
  }
}
