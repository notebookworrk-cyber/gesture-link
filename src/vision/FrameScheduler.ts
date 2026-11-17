/**
 * Frame scheduling for the vision loop.
 *
 * The browser hands us video frames faster than the pipeline can consume them.
 * This scheduler enforces the two rules that keep a slow machine responsive:
 *
 * 1. Latest frame wins — a callback that arrives while a frame is still being
 *    processed is dropped, never queued. There is no backlog, ever.
 * 2. One request in flight — the next frame is requested before the current one
 *    is processed, so a slow pass never stalls the callback chain.
 *
 * `minIntervalMs` provides a cheap rate limit for low-power mode.
 */
export interface FrameSchedulerClock {
  now: () => number
}

export interface FrameSchedulerOptions {
  /** Called for every frame that survives the drop rules. */
  onFrame: (now: number) => void
  /** Minimum time between processed frames. 0 processes every frame. */
  minIntervalMs?: number
  clock?: FrameSchedulerClock
}

export interface FrameRequestSource {
  request(callback: () => void): number
  cancel(handle: number): void
}

export class FrameScheduler {
  private handle: number | null = null
  private active = false
  private busy = false
  private lastProcessedAt = 0
  private hasProcessed = false
  private skipped = 0
  private processed = 0
  private readonly source: FrameRequestSource
  private readonly options: FrameSchedulerOptions
  private readonly clock: FrameSchedulerClock

  constructor(source: FrameRequestSource, options: FrameSchedulerOptions) {
    this.source = source
    this.options = options
    this.clock = options.clock ?? { now: () => performance.now() }
  }

  get running(): boolean {
    return this.active
  }

  get droppedFrames(): number {
    return this.skipped
  }

  get processedFrames(): number {
    return this.processed
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.busy = false
    this.lastProcessedAt = 0
    this.hasProcessed = false
    this.requestNext()
  }

  stop(): void {
    this.active = false
    this.busy = false
    if (this.handle !== null) {
      this.source.cancel(this.handle)
      this.handle = null
    }
  }

  /** Lets a caller clear the rate-limit window, e.g. after a settings change. */
  resetClock(): void {
    this.lastProcessedAt = 0
    this.hasProcessed = false
  }

  private requestNext(): void {
    if (!this.active) return
    this.handle = this.source.request(() => {
      this.handle = null
      this.tick()
    })
  }

  private tick(): void {
    if (!this.active) return
    // Request first: the callback chain must survive a slow frame.
    this.requestNext()

    if (this.busy) {
      this.skipped += 1
      return
    }
    const now = this.clock.now()
    const interval = this.options.minIntervalMs ?? 0
    // The first frame of a session is always processed: the clock may start at
    // any value, so a 0 baseline would rate-limit frame one away.
    if (interval > 0 && this.hasProcessed && now - this.lastProcessedAt < interval) {
      this.skipped += 1
      return
    }

    this.busy = true
    this.lastProcessedAt = now
    this.hasProcessed = true
    try {
      this.options.onFrame(now)
      this.processed += 1
    } finally {
      this.busy = false
    }
  }
}

/**
 * Prefers `requestVideoFrameCallback`, which fires once per decoded video frame,
 * and falls back to `requestAnimationFrame`. Both are cancelled through the
 * matching API so a stopped session leaves nothing scheduled.
 */
export function videoFrameSource(video: HTMLVideoElement): FrameRequestSource {
  const useVideo = typeof video.requestVideoFrameCallback === 'function'
  if (useVideo) {
    return {
      request: (callback) => video.requestVideoFrameCallback(callback),
      cancel: (handle) => video.cancelVideoFrameCallback?.(handle),
    }
  }
  return {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  }
}
