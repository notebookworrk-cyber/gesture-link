import type { FaceReading, HandReading } from '@/vision/types'
import { HAND_CONNECTIONS } from '@/vision/overlay'
import { filterCss } from './filters'
import { anchorFromFace, drawSticker } from './stickers'
import type { FilterDefinition, StickerId } from './types'

export interface ComposeOptions {
  mirror: boolean
  filter: FilterDefinition
  /** Filter strength from 0 to 1. */
  strength: number
  /** Sticker families that are currently enabled. */
  stickers: StickerId[]
  /** Face used to anchor the stickers. */
  face: FaceReading | null
  hands: HandReading[]
  /** Draws the hand skeleton over the image. */
  showLandmarks: boolean
  /** Colour used for the hand skeleton. */
  accent: string
}

let accentCache: { key: string; value: string } = { key: '', value: '#3edc9b' }

/** Reads the accent token from the document, cached between frames. */
export function accentColor(): string {
  const root = document.documentElement
  const key = `${root.dataset.theme ?? ''}|${root.dataset.accent ?? ''}|${root.style.getPropertyValue('--accent')}`
  if (accentCache.key !== key) {
    const value = getComputedStyle(root).getPropertyValue('--accent').trim()
    accentCache = { key, value: value || '#3edc9b' }
  }
  return accentCache.value
}

/**
 * Draws the whole studio frame: video, filter, stickers and hand overlay.
 * The preview and the saved photograph run through this exact function, so
 * what the user sees is what gets captured.
 */
export function drawComposition(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  options: ComposeOptions,
): void {
  ctx.save()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#0b0e11'
  ctx.fillRect(0, 0, width, height)

  if (options.mirror) {
    ctx.translate(width, 0)
    ctx.scale(-1, 1)
  }

  ctx.filter = filterCss(options.filter, options.strength)
  if (video.readyState >= 2 && video.videoWidth > 0) {
    ctx.drawImage(video, 0, 0, width, height)
  }
  ctx.filter = 'none'
  ctx.restore()

  // Stickers and the skeleton are drawn after the mirrored video, so their
  // coordinates have to be mirrored as well.
  if (options.stickers.length > 0) {
    const anchor = anchorFromFace(options.face)
    if (anchor) {
      for (const sticker of options.stickers) {
        drawSticker(sticker, { ctx, width, height, mirror: options.mirror, anchor })
      }
    }
  }

  if (options.showLandmarks) {
    drawHands(ctx, options.hands, width, height, options.mirror, options.accent)
  }
}

function drawHands(
  ctx: CanvasRenderingContext2D,
  hands: HandReading[],
  width: number,
  height: number,
  mirror: boolean,
  accent: string,
): void {
  const mapX = (x: number) => (mirror ? 1 - x : x) * width
  const mapY = (y: number) => y * height
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const hand of hands) {
    const points = hand.landmarks
    ctx.strokeStyle = accent
    ctx.globalAlpha = 0.7
    ctx.lineWidth = Math.max(1.4, width / 640)
    ctx.beginPath()
    for (const [from, to] of HAND_CONNECTIONS) {
      const a = points[from]
      const b = points[to]
      if (!a || !b) continue
      ctx.moveTo(mapX(a.x), mapY(a.y))
      ctx.lineTo(mapX(b.x), mapY(b.y))
    }
    ctx.stroke()
    ctx.globalAlpha = 1
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index]
      if (!point) continue
      ctx.beginPath()
      ctx.arc(mapX(point.x), mapY(point.y), index % 4 === 0 ? 3 : 2, 0, Math.PI * 2)
      ctx.fillStyle = accent
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * Renders the current camera frame into an offscreen canvas at the source
 * resolution, so a capture is not limited by the size of the preview.
 */
export function renderCapture(
  video: HTMLVideoElement,
  options: ComposeOptions,
): HTMLCanvasElement {
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  drawComposition(ctx, video, width, height, options)
  return canvas
}
