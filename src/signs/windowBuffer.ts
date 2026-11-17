import {
  WINDOW_MIN_FRAMES,
  WINDOW_MIN_SPAN_MS,
  WINDOW_MS,
  WINDOW_STRIDE_MS,
  windowFromFrames,
} from './features'

interface WindowFrame {
  timestamp: number
  vector: ArrayLike<number>
}

/** Hard cap so a stalled clock cannot grow the buffer without bound. */
const MAX_FRAMES = 180

/**
 * Sliding window over the tracked hand.
 *
 * Recognition used to look at one frame, which cannot represent a movement.
 * This buffer keeps the last ~1.1 s of per-frame features and emits a
 * time-normalised window every ~350 ms. It only emits while a hand is present
 * and the window actually spans enough time, so a single stray frame never
 * becomes a sign.
 *
 * Emission is a sliding window rather than an activity segmenter: that keeps
 * static signs (which have no movement energy to segment on) and moving signs
 * on the same code path.
 */
export class SignWindowBuffer {
  private frames: WindowFrame[] = []
  private lastEmitAt = 0
  private lastTimestamp = 0
  private missingFrames = 0

  /**
   * Adds the current frame. Pass `null` when no hand is tracked.
   * Returns a resampled window on the frames where one is due.
   */
  push(timestamp: number, vector: ArrayLike<number> | null): Float32Array | null {
    if (timestamp < this.lastTimestamp) return null
    this.lastTimestamp = timestamp

    if (!vector) {
      this.missingFrames += 1
      // One dropped frame is normal; two in a row means the hand left.
      if (this.missingFrames >= 2) this.clearFrames()
      return null
    }
    this.missingFrames = 0

    this.frames.push({ timestamp, vector })
    if (this.frames.length > MAX_FRAMES) this.frames.shift()

    const cutoff = timestamp - WINDOW_MS
    while (this.frames.length > 0 && this.frames[0]!.timestamp < cutoff) this.frames.shift()

    const first = this.frames[0]
    const last = this.frames[this.frames.length - 1]
    if (!first || !last) return null
    if (last.timestamp - first.timestamp < WINDOW_MIN_SPAN_MS) return null
    if (timestamp - this.lastEmitAt < WINDOW_STRIDE_MS) return null

    const window = windowFromFrames(this.frames.map((frame) => frame.vector))
    if (!window) return null
    this.lastEmitAt = timestamp
    return window
  }

  /** True when enough history exists for the next window. */
  get ready(): boolean {
    const first = this.frames[0]
    const last = this.frames[this.frames.length - 1]
    return Boolean(first && last && last.timestamp - first.timestamp >= WINDOW_MIN_SPAN_MS)
  }

  get frameCount(): number {
    return this.frames.length
  }

  reset(): void {
    this.frames = []
    this.lastEmitAt = 0
    this.lastTimestamp = 0
    this.missingFrames = 0
  }

  private clearFrames(): void {
    this.frames = []
    this.lastEmitAt = 0
  }
}

export interface TakeFrame {
  timestamp: number
  vector: ArrayLike<number>
}

/**
 * Turns one recorded take into training windows using the same window length
 * and stride as the live buffer. A take shorter than the minimum span still
 * produces one window from the whole take rather than being thrown away, so a
 * quick sign can be taught; fewer than four frames cannot describe motion and
 * produce nothing.
 */
export function windowsFromTake(frames: TakeFrame[]): Float32Array[] {
  const clean = frames.filter((frame) => Number.isFinite(frame.timestamp))
  if (clean.length < WINDOW_MIN_FRAMES) return []
  const start = clean[0]!.timestamp
  const end = clean[clean.length - 1]!.timestamp
  const span = end - start

  if (span < WINDOW_MIN_SPAN_MS) {
    const single = windowFromFrames(clean.map((frame) => frame.vector))
    return single ? [single] : []
  }

  const windows: Float32Array[] = []
  const emitAt = (timestamp: number) => {
    const inside = clean.filter(
      (frame) => frame.timestamp >= timestamp - WINDOW_MS && frame.timestamp <= timestamp,
    )
    const window = windowFromFrames(inside.map((frame) => frame.vector))
    if (!window) return
    windows.push(window)
  }

  for (
    let time = start + WINDOW_MIN_SPAN_MS;
    time < end;
    time += WINDOW_STRIDE_MS
  ) {
    emitAt(time)
  }
  // The end of a take is where a sign usually finishes, so it is always scored.
  emitAt(end)

  return windows
}
