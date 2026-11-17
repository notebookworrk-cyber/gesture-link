import type { FrameReading, Handedness } from './types'
import type { HandSlot } from '@/recognition/types'

/** MediaPipe hand topology, index pairs. */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

const TIP_INDICES = new Set([4, 8, 12, 16, 20])

export interface OverlayOptions {
  mirror: boolean
  showLandmarks: boolean
  videoWidth: number
  videoHeight: number
  /** Stable hand id -> physical slot, supplied by the two-hand tracker. */
  slots?: Map<string, HandSlot>
  /** Draw left/right labels, palm markers and the recognition boundary. */
  showHandDetails?: boolean
}

let accentCache: { key: string; value: string } = { key: '', value: '#3edc9b' }

/**
 * The accent token is read from the document so the overlay follows the
 * selected accent and theme. Cached by the token key because reading computed
 * styles is too expensive to repeat for every point at 30 fps.
 */
function accentColor(): string {
  const root = document.documentElement
  const key = `${root.dataset.theme ?? ''}|${root.dataset.accent ?? ''}|${root.style.getPropertyValue('--accent')}`
  if (accentCache.key !== key) {
    const value = getComputedStyle(root).getPropertyValue('--accent').trim()
    accentCache = { key, value: value || '#3edc9b' }
  }
  return accentCache.value
}

/**
 * Draws the skeleton on a canvas that covers the preview stage. The video uses
 * `object-fit: contain`, so the overlay maps normalised landmarks into the
 * letterboxed video rectangle rather than the full stage — otherwise points
 * drift away from the hand whenever the stage aspect differs from the stream.
 */
export function drawHandOverlay(
  canvas: HTMLCanvasElement,
  frame: FrameReading,
  options: OverlayOptions,
): void {
  const context = canvas.getContext('2d')
  const rect = canvas.getBoundingClientRect()
  if (!context || rect.width === 0 || rect.height === 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.round(rect.width * dpr)
  const height = Math.round(rect.height * dpr)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, rect.width, rect.height)
  if (!options.showLandmarks || options.videoWidth === 0 || options.videoHeight === 0) return

  const scale = Math.min(
    rect.width / options.videoWidth,
    rect.height / options.videoHeight,
  )
  const drawWidth = options.videoWidth * scale
  const drawHeight = options.videoHeight * scale
  const offsetX = (rect.width - drawWidth) / 2
  const offsetY = (rect.height - drawHeight) / 2

  const mapX = (x: number) => offsetX + (options.mirror ? 1 - x : x) * drawWidth
  const mapY = (y: number) => offsetY + y * drawHeight

  const accent = accentColor()
  context.lineCap = 'round'
  context.lineJoin = 'round'

  for (const hand of frame.hands) {
    const points = hand.landmarks
    const slot = options.slots?.get(hand.id)
    const color = slot === 'left' ? '#f5b942' : slot === 'right' ? accent : '#9fb3c8'
    context.strokeStyle = color
    context.globalAlpha = 0.72
    context.lineWidth = 1.6
    context.beginPath()
    for (const [from, to] of HAND_CONNECTIONS) {
      const a = points[from]
      const b = points[to]
      if (!a || !b) continue
      context.moveTo(mapX(a.x), mapY(a.y))
      context.lineTo(mapX(b.x), mapY(b.y))
    }
    context.stroke()

    context.globalAlpha = 1
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]
      if (!point) continue
      const tip = TIP_INDICES.has(index)
      context.beginPath()
      context.arc(mapX(point.x), mapY(point.y), tip ? 2.9 : 2, 0, Math.PI * 2)
      context.fillStyle = color
      context.fill()
    }

    if (options.showHandDetails) {
      const palmX = mapX(hand.palmCenter.x)
      const palmY = mapY(hand.palmCenter.y)
      context.beginPath()
      context.arc(palmX, palmY, 6, 0, Math.PI * 2)
      context.strokeStyle = color
      context.lineWidth = 1.2
      context.stroke()
      context.font = '10px Inter, sans-serif'
      context.fillStyle = color
      context.fillText(
        slot === 'left' ? 'LEFT' : slot === 'right' ? 'RIGHT' : handednessLabel(hand.handedness),
        palmX + 8,
        palmY - 8,
      )
    }
  }
  context.globalAlpha = 1
}

function handednessLabel(handedness: Handedness): string {
  return handedness === 'Left' ? 'LEFT?' : 'RIGHT?'
}
