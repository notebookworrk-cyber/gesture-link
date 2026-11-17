import type { Handedness } from './types'

export interface HandDetection {
  handedness: Handedness
  /** Palm centre in image space. */
  center: { x: number; y: number }
  score: number
}

interface Track {
  id: string
  handedness: Handedness
  center: { x: number; y: number }
  seenAt: number
}

export interface HandIdentityOptions {
  /**
   * Largest palm movement between frames that still counts as the same hand,
   * in image-normalised units. A hand crossing the frame at 30 Hz moves well
   * under this; two different hands standing still are further apart.
   */
  gate?: number
  /** Extra cost for a handedness flip, used only as a tiebreaker. */
  handednessPenalty?: number
  /** Tracks unseen for longer than this are forgotten. */
  maxAgeMs?: number
}

/**
 * Keeps hand identities stable across frames.
 *
 * MediaPipe labels a hand "Left" or "Right" from the palm's appearance, and that
 * label flips when the hands cross or the palm turns over. Everything downstream
 * (smoothers, gesture state machines, temporal buffers) keys on this id, so a
 * flip used to reset tracking mid-sign. Matching now follows position, and
 * handedness only breaks ties.
 */
export class HandIdentityTracker {
  private readonly gate: number
  private readonly penalty: number
  private readonly maxAge: number
  private tracks: Track[] = []
  private nextId = 1

  constructor(options: HandIdentityOptions = {}) {
    this.gate = options.gate ?? 0.35
    this.penalty = options.handednessPenalty ?? 0.2
    this.maxAge = options.maxAgeMs ?? 1000
  }

  /** Drops forgettable tracks and returns the current ids in detection order. */
  assign(detections: HandDetection[], now: number): string[] {
    this.tracks = this.tracks.filter((track) => now - track.seenAt <= this.maxAge)

    const used = new Set<string>()
    const ids: Array<string | null> = detections.map(() => null)
    const costs: Array<{ detection: number; track: number; cost: number }> = []

    detections.forEach((detection, detectionIndex) => {
      this.tracks.forEach((track, trackIndex) => {
        const distance = Math.hypot(
          detection.center.x - track.center.x,
          detection.center.y - track.center.y,
        )
        if (distance > this.gate) return
        const cost =
          distance + (detection.handedness === track.handedness ? 0 : this.penalty)
        costs.push({ detection: detectionIndex, track: trackIndex, cost })
      })
    })

    costs.sort((a, b) => a.cost - b.cost)
    for (const candidate of costs) {
      if (ids[candidate.detection] !== null) continue
      const track = this.tracks[candidate.track]!
      if (used.has(track.id)) continue
      used.add(track.id)
      ids[candidate.detection] = track.id
    }

    detections.forEach((detection, index) => {
      const id = ids[index]
      if (id) {
        const track = this.tracks.find((item) => item.id === id)!
        track.center = { ...detection.center }
        track.handedness = detection.handedness
        track.seenAt = now
        return
      }
      const track: Track = {
        id: `hand-${this.nextId++}`,
        handedness: detection.handedness,
        center: { ...detection.center },
        seenAt: now,
      }
      this.tracks.push(track)
      ids[index] = track.id
    })

    return ids.map((id) => id!)
  }

  /** Number of tracks that are still fresh. */
  get size(): number {
    return this.tracks.length
  }

  reset(): void {
    this.tracks = []
    this.nextId = 1
  }
}
