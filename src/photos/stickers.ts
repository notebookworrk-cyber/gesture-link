import type { FaceReading } from '@/vision/types'
import type { StickerDefinition, StickerId } from './types'

/** Landmarks used to anchor the stickers. */
const LEFT_EYE_OUTER = 263
const RIGHT_EYE_OUTER = 33
const FOREHEAD = 10
const NOSE_TIP = 1
const MOUTH_LEFT = 61
const MOUTH_RIGHT = 291
const LEFT_CHEEK = 454
const RIGHT_CHEEK = 234

export const STICKERS: StickerDefinition[] = [
  { id: 'glasses', labelKey: 'cam.stickerGlasses' },
  { id: 'hat', labelKey: 'cam.stickerHat' },
  { id: 'crown', labelKey: 'cam.stickerCrown' },
  { id: 'ears', labelKey: 'cam.stickerEars' },
  { id: 'mustache', labelKey: 'cam.stickerMustache' },
  { id: 'sparkles', labelKey: 'cam.stickerSparkles' },
]

export interface FaceAnchor {
  /** Face centre in normalised image space. */
  cx: number
  cy: number
  /** Face width in normalised image space; the unit for every sticker. */
  size: number
  /** Eye-line rotation in radians. */
  roll: number
  leftEye: { x: number; y: number }
  rightEye: { x: number; y: number }
  forehead: { x: number; y: number }
  nose: { x: number; y: number }
  mouth: { x: number; y: number }
  leftCheek: { x: number; y: number }
  rightCheek: { x: number; y: number }
}

/**
 * Converts a face reading into the anchors the stickers need. Returns null when
 * the reading has too few landmarks to place anything safely.
 */
export function anchorFromFace(face: FaceReading | null): FaceAnchor | null {
  if (!face) return null
  const points = face.landmarks
  if (!points || points.length < 300) return null
  const leftEye = points[LEFT_EYE_OUTER]
  const rightEye = points[RIGHT_EYE_OUTER]
  const forehead = points[FOREHEAD]
  const nose = points[NOSE_TIP]
  const mouthLeft = points[MOUTH_LEFT]
  const mouthRight = points[MOUTH_RIGHT]
  const leftCheek = points[LEFT_CHEEK]
  const rightCheek = points[RIGHT_CHEEK]
  if (!leftEye || !rightEye || !forehead || !nose || !mouthLeft || !mouthRight) return null

  const mouth = {
    x: (mouthLeft.x + mouthRight.x) / 2,
    y: (mouthLeft.y + mouthRight.y) / 2,
  }

  return {
    cx: nose.x,
    cy: nose.y,
    size: Math.max(face.box.width, Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y)),
    roll: face.roll,
    leftEye,
    rightEye,
    forehead,
    nose,
    mouth,
    leftCheek: leftCheek ?? mouth,
    rightCheek: rightCheek ?? mouth,
  }
}

export interface StickerContext {
  ctx: CanvasRenderingContext2D
  /** Canvas width in pixels. */
  width: number
  /** Canvas height in pixels. */
  height: number
  /** Mirrors the anchor x coordinates, matching the mirrored preview. */
  mirror: boolean
  anchor: FaceAnchor
}

/**
 * Draws one sticker on the face anchor. Stickers are vector shapes drawn in a
 * face-local coordinate system: x is a fraction of the face width, y likewise,
 * so they scale with the face instead of the screen.
 */
export function drawSticker(id: StickerId, context: StickerContext): void {
  const { ctx, width, height, mirror, anchor } = context
  const px = (x: number) => (mirror ? 1 - x : x) * width
  const py = (y: number) => y * height
  const unit = Math.max(anchor.size * width, 1)

  ctx.save()
  ctx.translate(px(anchor.cx), py(anchor.cy))
  ctx.rotate(mirror ? -anchor.roll : anchor.roll)
  ctx.scale(unit, unit)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  switch (id) {
    case 'glasses':
      drawGlasses(ctx, anchor)
      break
    case 'hat':
      drawHat(ctx, anchor)
      break
    case 'crown':
      drawCrown(ctx, anchor)
      break
    case 'ears':
      drawEars(ctx, anchor)
      break
    case 'mustache':
      drawMustache(ctx, anchor)
      break
    case 'sparkles':
      drawSparkles(ctx)
      break
  }
  ctx.restore()
}

function drawGlasses(ctx: CanvasRenderingContext2D, anchor: FaceAnchor): void {
  const eyeGap = Math.hypot(
    anchor.rightEye.x - anchor.leftEye.x,
    anchor.rightEye.y - anchor.leftEye.y,
  ) / Math.max(anchor.size, 0.0001)
  const eyeHeight = Math.abs(anchor.rightEye.y - anchor.leftEye.y) / Math.max(anchor.size, 0.0001)
  const midX = (anchor.leftEye.x + anchor.rightEye.x) / 2 - anchor.cx
  const midY = (anchor.leftEye.y + anchor.rightEye.y) / 2 - anchor.cy
  const radius = Math.max(eyeGap * 0.32, 0.08)
  const vertical = Math.max(eyeHeight * 0.6, 0.08)

  ctx.strokeStyle = 'rgba(18, 22, 26, 0.92)'
  ctx.lineWidth = 0.035
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.roundRect(
      midX + side * eyeGap * 0.5 - radius,
      midY - vertical,
      radius * 2,
      vertical * 2,
      radius * 0.6,
    )
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(midX - eyeGap * 0.5 + radius, midY)
  ctx.lineTo(midX + eyeGap * 0.5 - radius, midY)
  ctx.stroke()
}

function drawHat(ctx: CanvasRenderingContext2D, anchor: FaceAnchor): void {
  const top = anchor.forehead.y - anchor.cy - 0.34
  const brim = anchor.forehead.y - anchor.cy - 0.16
  const half = 0.42

  ctx.fillStyle = 'rgba(24, 28, 34, 0.95)'
  ctx.beginPath()
  ctx.moveTo(-half, brim)
  ctx.lineTo(-half * 0.72, top)
  ctx.quadraticCurveTo(0, top - 0.12, half * 0.72, top)
  ctx.lineTo(half, brim)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(62, 220, 155, 0.9)'
  ctx.beginPath()
  ctx.roundRect(-half, brim - 0.05, half * 2, 0.09, 0.04)
  ctx.fill()
}

function drawCrown(ctx: CanvasRenderingContext2D, anchor: FaceAnchor): void {
  const base = anchor.forehead.y - anchor.cy - 0.2
  const height = 0.32
  const half = 0.3

  ctx.fillStyle = 'rgba(246, 199, 92, 0.96)'
  ctx.beginPath()
  ctx.moveTo(-half, base)
  ctx.lineTo(-half, base - height * 0.55)
  ctx.lineTo(-half * 0.5, base - height * 0.2)
  ctx.lineTo(0, base - height)
  ctx.lineTo(half * 0.5, base - height * 0.2)
  ctx.lineTo(half, base - height * 0.55)
  ctx.lineTo(half, base)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(255, 92, 120, 0.95)'
  ctx.beginPath()
  ctx.arc(0, base - height * 0.32, 0.05, 0, Math.PI * 2)
  ctx.fill()
}

function drawEars(ctx: CanvasRenderingContext2D, anchor: FaceAnchor): void {
  const left = anchor.leftCheek.x - anchor.cx
  const right = anchor.rightCheek.x - anchor.cx
  const top = anchor.leftCheek.y - anchor.cy

  ctx.fillStyle = 'rgba(244, 174, 138, 0.95)'
  for (const side of [left, right]) {
    ctx.beginPath()
    ctx.moveTo(side - 0.1 * Math.sign(side || 1), top)
    ctx.quadraticCurveTo(side - 0.22 * Math.sign(side || 1), top - 0.34, side, top - 0.42)
    ctx.quadraticCurveTo(side + 0.16 * Math.sign(side || 1), top - 0.28, side + 0.1 * Math.sign(side || 1), top)
    ctx.closePath()
    ctx.fill()
  }
}

function drawMustache(ctx: CanvasRenderingContext2D, anchor: FaceAnchor): void {
  const y = anchor.mouth.y - anchor.cy - 0.08

  ctx.fillStyle = 'rgba(38, 30, 26, 0.95)'
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.quadraticCurveTo(-0.18, y - 0.14, -0.3, y + 0.02)
  ctx.quadraticCurveTo(-0.14, y + 0.12, 0, y + 0.03)
  ctx.quadraticCurveTo(0.14, y + 0.12, 0.3, y + 0.02)
  ctx.quadraticCurveTo(0.18, y - 0.14, 0, y)
  ctx.closePath()
  ctx.fill()
}

function drawSparkles(ctx: CanvasRenderingContext2D): void {
  const points = [
    { x: -0.62, y: -0.34, r: 0.09 },
    { x: 0.6, y: -0.22, r: 0.07 },
    { x: -0.5, y: 0.42, r: 0.06 },
    { x: 0.55, y: 0.38, r: 0.085 },
  ]
  ctx.fillStyle = 'rgba(255, 236, 170, 0.95)'
  for (const point of points) {
    star(ctx, point.x, point.y, point.r)
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  ctx.beginPath()
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI / 4) * index - Math.PI / 2
    const length = index % 2 === 0 ? radius : radius * 0.42
    const px = x + Math.cos(angle) * length
    const py = y + Math.sin(angle) * length
    if (index === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}
