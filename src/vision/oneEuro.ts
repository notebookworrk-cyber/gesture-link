/**
 * One Euro filter (Casiez, Roussel & Vogel, CHI 2012).
 *
 * Landmark jitter is high when the hand is still and lag is visible when it
 * moves. A fixed low-pass cannot satisfy both, so the cutoff rises with speed.
 */
export interface OneEuroOptions {
  /** Minimum cutoff in Hz. Lower = steadier at rest, more lag when moving. */
  minCutoff?: number
  /** Speed coefficient. Higher = less lag during fast movement. */
  beta?: number
  /** Cutoff for the derivative estimate. */
  dCutoff?: number
}

class LowPass {
  private value: number | null = null

  filter(input: number, alpha: number): number {
    if (this.value === null) {
      this.value = input
      return input
    }
    this.value = alpha * input + (1 - alpha) * this.value
    return this.value
  }

  get last(): number | null {
    return this.value
  }

  reset(): void {
    this.value = null
  }
}

function smoothingFactor(deltaSeconds: number, cutoff: number): number {
  if (deltaSeconds <= 0) return 1
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / deltaSeconds)
}

export class OneEuroFilter {
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number
  private x = new LowPass()
  private dx = new LowPass()
  private lastTime: number | null = null
  private lastRaw: number | null = null

  constructor({ minCutoff = 1.2, beta = 0.02, dCutoff = 1 }: OneEuroOptions = {}) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  /** `timestampMs` must be monotonic; equal timestamps reuse the last output. */
  filter(value: number, timestampMs: number): number {
    if (this.lastTime === null || this.lastRaw === null) {
      this.lastTime = timestampMs
      this.lastRaw = value
      return this.x.filter(value, 1)
    }

    const dt = Math.max((timestampMs - this.lastTime) / 1000, 1 / 240)
    const derivative = (value - this.lastRaw) / dt
    const edx = this.dx.filter(derivative, smoothingFactor(dt, this.dCutoff))
    const cutoff = this.minCutoff + this.beta * Math.abs(edx)
    const output = this.x.filter(value, smoothingFactor(dt, cutoff))

    this.lastTime = timestampMs
    this.lastRaw = value
    tolerateLongPause(this, dt)
    return output
  }

  reset(): void {
    this.x.reset()
    this.dx.reset()
    this.lastTime = null
    this.lastRaw = null
  }
}

/**
 * A tab that was backgrounded for seconds must not carry a stale derivative
 * into the next frame; resetting keeps the first frame after resume stable.
 */
function tolerateLongPause(filter: OneEuroFilter, dt: number): void {
  if (dt > 0.5) filter.reset()
}

/**
 * Filters a 21-point hand in place-safe fashion. Each coordinate gets its own
 * filter instance, keyed by landmark index and axis.
 */
export class LandmarkSmoother {
  private readonly filters: OneEuroFilter[]

  constructor(options: OneEuroOptions = {}) {
    this.filters = Array.from({ length: 21 * 3 }, () => new OneEuroFilter(options))
  }

  smooth(landmarks: Array<{ x: number; y: number; z: number }>, timestampMs: number) {
    return landmarks.map((point, index) => ({
      x: this.filters[index * 3]!.filter(point.x, timestampMs),
      y: this.filters[index * 3 + 1]!.filter(point.y, timestampMs),
      z: this.filters[index * 3 + 2]!.filter(point.z, timestampMs),
    }))
  }

  reset(): void {
    for (const filter of this.filters) filter.reset()
  }
}
