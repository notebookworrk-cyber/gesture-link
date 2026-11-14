import type { Landmark } from '@/vision/types'

type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky'

interface Point {
  x: number
  y: number
}

const MCP: Record<Exclude<FingerName, 'thumb'>, Point> = {
  index: { x: 0.43, y: 0.62 },
  middle: { x: 0.5, y: 0.6 },
  ring: { x: 0.57, y: 0.62 },
  pinky: { x: 0.63, y: 0.66 },
}

/** Straight chain above each MCP. */
const EXTENDED: Record<Exclude<FingerName, 'thumb'>, [Point, Point, Point]> = {
  index: [
    { x: 0.41, y: 0.52 },
    { x: 0.4, y: 0.46 },
    { x: 0.39, y: 0.4 },
  ],
  middle: [
    { x: 0.5, y: 0.49 },
    { x: 0.5, y: 0.42 },
    { x: 0.5, y: 0.36 },
  ],
  ring: [
    { x: 0.58, y: 0.52 },
    { x: 0.59, y: 0.46 },
    { x: 0.6, y: 0.4 },
  ],
  pinky: [
    { x: 0.64, y: 0.57 },
    { x: 0.65, y: 0.52 },
    { x: 0.66, y: 0.47 },
  ],
}

/** Curled chain folded back toward the palm. */
const CURLED: Record<Exclude<FingerName, 'thumb'>, [Point, Point, Point]> = {
  index: [
    { x: 0.43, y: 0.66 },
    { x: 0.42, y: 0.64 },
    { x: 0.41, y: 0.61 },
  ],
  middle: [
    { x: 0.5, y: 0.64 },
    { x: 0.5, y: 0.62 },
    { x: 0.5, y: 0.59 },
  ],
  ring: [
    { x: 0.57, y: 0.66 },
    { x: 0.57, y: 0.64 },
    { x: 0.57, y: 0.61 },
  ],
  pinky: [
    { x: 0.63, y: 0.7 },
    { x: 0.63, y: 0.68 },
    { x: 0.63, y: 0.65 },
  ],
}

function point(value: Point): Landmark {
  return { x: value.x, y: value.y, z: 0 }
}

/**
 * Builds a synthetic but geometrically plausible 21-point hand. Extension is
 * expressed the way the classifier measures it: a straight PIP joint and a tip
 * that reaches beyond the PIP joint.
 */
export function makeHand(extended: FingerName[]): Landmark[] {
  const landmarks: Landmark[] = new Array(21)
  landmarks[0] = point({ x: 0.5, y: 0.9 })

  if (extended.includes('thumb')) {
    landmarks[1] = point({ x: 0.38, y: 0.8 })
    landmarks[2] = point({ x: 0.34, y: 0.75 })
    landmarks[3] = point({ x: 0.3, y: 0.69 })
    landmarks[4] = point({ x: 0.25, y: 0.62 })
  } else {
    landmarks[1] = point({ x: 0.38, y: 0.8 })
    landmarks[2] = point({ x: 0.39, y: 0.75 })
    landmarks[3] = point({ x: 0.4, y: 0.7 })
    landmarks[4] = point({ x: 0.44, y: 0.64 })
  }

  const layout: Array<[Exclude<FingerName, 'thumb'>, number]> = [
    ['index', 5],
    ['middle', 9],
    ['ring', 13],
    ['pinky', 17],
  ]
  for (const [name, base] of layout) {
    landmarks[base] = point(MCP[name])
    const chain = extended.includes(name) ? EXTENDED[name] : CURLED[name]
    landmarks[base + 1] = point(chain[0])
    landmarks[base + 2] = point(chain[1])
    landmarks[base + 3] = point(chain[2])
  }
  return landmarks
}
