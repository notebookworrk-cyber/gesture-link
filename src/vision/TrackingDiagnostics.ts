/**
 * Real measurements for the diagnostics panel.
 *
 * Every number the UI shows has to come from the running loop, so the engine
 * records each pass here and the panel reads a snapshot. Nothing is estimated.
 */
export interface DiagnosticsSnapshot {
  handP50: number
  handP95: number
  poseP50: number
  poseP95: number
  faceP50: number
  faceP95: number
  processedFrames: number
  droppedFrames: number
  longTasks: number
  longestTaskMs: number
  modelLoadMs: number
  /** Mean camera-to-result latency in ms, when the source exposes it. */
  pipelineMs: number
}

const WINDOW = 120

class Rolling {
  private readonly values: number[] = []
  private index = 0

  push(value: number): void {
    if (!Number.isFinite(value) || value < 0) return
    if (this.values.length < WINDOW) this.values.push(value)
    else {
      this.values[this.index] = value
      this.index = (this.index + 1) % WINDOW
    }
  }

  percentile(p: number): number {
    if (this.values.length === 0) return 0
    const sorted = [...this.values].sort((a, b) => a - b)
    const position = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
    return Math.round(sorted[position]! * 10) / 10
  }

  get count(): number {
    return this.values.length
  }

  clear(): void {
    this.values.length = 0
    this.index = 0
  }
}

export class TrackingDiagnostics {
  private readonly hand = new Rolling()
  private readonly pose = new Rolling()
  private readonly face = new Rolling()
  private processed = 0
  private dropped = 0
  private longTasks = 0
  private longestTask = 0
  private modelLoad = 0
  private pipeline = new Rolling()
  private observer: PerformanceObserver | null = null

  recordHand(ms: number): void {
    this.hand.push(ms)
    this.processed += 1
  }

  recordPose(ms: number): void {
    this.pose.push(ms)
  }

  recordFace(ms: number): void {
    this.face.push(ms)
  }

  recordPipeline(ms: number): void {
    this.pipeline.push(ms)
  }

  recordDrop(count = 1): void {
    this.dropped += Math.max(0, count)
  }

  recordModelLoad(ms: number): void {
    this.modelLoad = Math.max(0, ms)
  }

  /**
   * Counts long tasks, which is the only signal that the main thread is being
   * blocked for the user. Silently does nothing where the API is missing.
   */
  observeLongTasks(): () => void {
    if (this.observer || typeof PerformanceObserver === 'undefined') return () => undefined
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTasks += 1
          if (entry.duration > this.longestTask) this.longestTask = entry.duration
        }
      })
      observer.observe({ entryTypes: ['longtask'] })
      this.observer = observer
    } catch {
      this.observer = null
    }
    return () => {
      this.observer?.disconnect()
      this.observer = null
    }
  }

  snapshot(): DiagnosticsSnapshot {
    return {
      handP50: this.hand.percentile(50),
      handP95: this.hand.percentile(95),
      poseP50: this.pose.percentile(50),
      poseP95: this.pose.percentile(95),
      faceP50: this.face.percentile(50),
      faceP95: this.face.percentile(95),
      processedFrames: this.processed,
      droppedFrames: this.dropped,
      longTasks: this.longTasks,
      longestTaskMs: Math.round(this.longestTask * 10) / 10,
      modelLoadMs: Math.round(this.modelLoad),
      pipelineMs: this.pipeline.percentile(50),
    }
  }

  reset(): void {
    this.hand.clear()
    this.pose.clear()
    this.face.clear()
    this.pipeline.clear()
    this.processed = 0
    this.dropped = 0
    this.longTasks = 0
    this.longestTask = 0
    this.modelLoad = 0
  }
}
