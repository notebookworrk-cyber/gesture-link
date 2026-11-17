/**
 * Guided calibration.
 *
 * Tracking itself does not need calibration — MediaPipe finds hands on its own.
 * What needs it is the mapping from hand position to app coordinates: two people
 * hold their hands in different places, and one person sits differently between
 * sessions. Calibration records the box the signer can comfortably reach, in the
 * same image-normalised space the palm centre is reported in, so every mapped
 * surface uses the same reach.
 */
export interface CalibrationBounds {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface CalibrationProfile {
  version: 1
  createdAt: number
  bounds: CalibrationBounds
  /** Number of landmark samples the bounds were built from. */
  samples: number
}

export const CALIBRATION_STORAGE_KEY = 'gesturelink.calibration.v1'

/** Points closer together than this are treated as a failed recording. */
const MIN_SPAN = 0.12

/**
 * Builds bounds from observed points, with a small margin so the edges are
 * reachable instead of exactly on the boundary.
 */
export function createProfile(
  points: Array<{ x: number; y: number }>,
  now = Date.now(),
): CalibrationProfile | null {
  if (points.length < 8) return null
  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    if (point.x < xMin) xMin = point.x
    if (point.x > xMax) xMax = point.x
    if (point.y < yMin) yMin = point.y
    if (point.y > yMax) yMax = point.y
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return null
  if (xMax - xMin < MIN_SPAN || yMax - yMin < MIN_SPAN) return null

  const marginX = (xMax - xMin) * 0.04
  const marginY = (yMax - yMin) * 0.04
  return {
    version: 1,
    createdAt: now,
    samples: points.length,
    bounds: {
      xMin: xMin - marginX,
      xMax: xMax + marginX,
      yMin: yMin - marginY,
      yMax: yMax + marginY,
    },
  }
}

/** Maps a recorded palm position into 0…1 inside the calibrated box. */
export function clampToProfile(
  point: { x: number; y: number },
  profile: CalibrationProfile | null,
): { x: number; y: number } {
  if (!profile) return { x: point.x, y: point.y }
  const { xMin, xMax, yMin, yMax } = profile.bounds
  const width = Math.max(xMax - xMin, 1e-6)
  const height = Math.max(yMax - yMin, 1e-6)
  return {
    x: clamp01((point.x - xMin) / width),
    y: clamp01((point.y - yMin) / height),
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function loadProfile(): CalibrationProfile | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(CALIBRATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CalibrationProfile
    if (parsed?.version !== 1 || !parsed.bounds) return null
    const { xMin, xMax, yMin, yMax } = parsed.bounds
    if (![xMin, xMax, yMin, yMax].every((value) => Number.isFinite(value))) return null
    return parsed
  } catch {
    return null
  }
}

export function saveProfile(profile: CalibrationProfile): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // A full or blocked storage must not break a running session.
  }
}

export function clearProfile(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(CALIBRATION_STORAGE_KEY)
  } catch {
    // Ignored for the same reason as saveProfile.
  }
}
