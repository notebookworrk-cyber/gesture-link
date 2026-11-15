import {
  lineEndpoints,
  localBounds,
  objectBounds,
  rectCenter,
  selectionBounds,
} from './geometry'
import type {
  LaserSettings,
  Page,
  Point,
  Rect,
  RulerState,
  ShapeObject,
  StrokeObject,
  WhiteboardObject,
} from './types'

export const FONT_STACK =
  "'Inter Variable', 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, 'Nirmala UI', 'Yu Gothic UI', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Noto Sans Devanagari', sans-serif"

export interface ThemeColors {
  accent: string
  text1: string
  text2: string
  text3: string
  stroke1: string
  surface1: string
  surface2: string
  danger: string
  paperDark: boolean
}

const fallbackTheme: ThemeColors = {
  accent: '#3edc9b',
  text1: '#e6e9e8',
  text2: '#a7aeac',
  text3: '#727a78',
  stroke1: '#2a3134',
  surface1: '#1a1f21',
  surface2: '#22282b',
  danger: '#e5675c',
  paperDark: false,
}

export function readThemeColors(): ThemeColors {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallbackTheme
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    accent: read('--accent', fallbackTheme.accent),
    text1: read('--text-1', fallbackTheme.text1),
    text2: read('--text-2', fallbackTheme.text2),
    text3: read('--text-3', fallbackTheme.text3),
    stroke1: read('--stroke-1', fallbackTheme.stroke1),
    surface1: read('--surface-1', fallbackTheme.surface1),
    surface2: read('--surface-2', fallbackTheme.surface2),
    danger: read('--danger', fallbackTheme.danger),
    paperDark: false,
  }
}

export function colorLuminance(color: string): number {
  const value = color.trim()
  const hex = value.replace('#', '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const r = parseInt(hex[0]! + hex[0]!, 16)
    const g = parseInt(hex[1]! + hex[1]!, 16)
    const b = parseInt(hex[2]! + hex[2]!, 16)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (match) {
    const [r = 255, g = 255, b = 255] = match[1]!.split(',').map((part) => Number(part))
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  }
  return 1
}

export const isDarkPaper = (paper: string): boolean => colorLuminance(paper) < 0.42

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function traceStroke(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return
  const first = points[0]!
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  if (points.length === 1) return
  if (points.length === 2) {
    ctx.lineTo(points[1]!.x, points[1]!.y)
    return
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!
    const next = points[index + 1]!
    const midX = (point.x + next.x) / 2
    const midY = (point.y + next.y) / 2
    ctx.quadraticCurveTo(point.x, point.y, midX, midY)
  }
  const last = points[points.length - 1]!
  ctx.lineTo(last.x, last.y)
}

function drawStroke(ctx: CanvasRenderingContext2D, object: StrokeObject, darkPaper: boolean): void {
  if (object.points.length === 0) return
  ctx.save()
  ctx.globalAlpha *= object.opacity
  ctx.strokeStyle = object.color
  ctx.fillStyle = object.color
  ctx.lineJoin = 'round'

  if (object.ink === 'highlighter') {
    ctx.lineCap = 'butt'
    // Multiply keeps light paper readable and prevents the same stroke from
    // darkening itself; dark paper needs normal compositing to stay visible.
    ctx.globalCompositeOperation = darkPaper ? 'source-over' : 'multiply'
    ctx.globalAlpha *= 0.42
  } else {
    ctx.lineCap = 'round'
  }

  if (object.ink === 'pencil') ctx.globalAlpha *= 0.84

  if (object.points.length === 1) {
    const point = object.points[0]!
    ctx.beginPath()
    ctx.arc(point.x, point.y, Math.max(object.width / 2, 0.5), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  const hasPressure =
    object.ink === 'pen' && object.points.some((point) => point.p !== undefined)

  if (hasPressure) {
    for (let index = 1; index < object.points.length; index += 1) {
      const from = object.points[index - 1]!
      const to = object.points[index]!
      const pressure = to.p ?? from.p ?? 0.5
      ctx.lineWidth = Math.max(0.4, object.width * (0.45 + pressure * 1.05))
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
  } else {
    traceStroke(ctx, object.points)
    ctx.lineWidth = object.width
    ctx.stroke()
  }

  if (object.ink === 'pencil') {
    ctx.globalAlpha *= 0.3
    ctx.lineWidth = Math.max(0.5, object.width * 0.75)
    ctx.save()
    ctx.translate(0.55, 0.7)
    traceStroke(ctx, object.points)
    ctx.stroke()
    ctx.restore()
  }

  ctx.restore()
}

function arrowHead(ctx: CanvasRenderingContext2D, tip: Point, angle: number, size: number): void {
  const spread = Math.PI / 7
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(tip.x - Math.cos(angle - spread) * size, tip.y - Math.sin(angle - spread) * size)
  ctx.lineTo(tip.x - Math.cos(angle + spread) * size, tip.y - Math.sin(angle + spread) * size)
  ctx.closePath()
  ctx.fill()
}

function drawShape(ctx: CanvasRenderingContext2D, object: ShapeObject): void {
  ctx.save()
  ctx.globalAlpha *= object.opacity
  ctx.strokeStyle = object.stroke
  ctx.fillStyle = object.stroke
  ctx.lineWidth = object.strokeWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  const center = rectCenter(localBounds(object))
  if (object.rotation) {
    ctx.translate(center.x, center.y)
    ctx.rotate((object.rotation * Math.PI) / 180)
    ctx.translate(-center.x, -center.y)
  }

  const { x, y, w, h } = object
  const lineLike = object.shape === 'line' || object.shape === 'arrow' || object.shape === 'double-arrow'

  if (lineLike) {
    const { from, to } = lineEndpoints(object)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    const angle = Math.atan2(to.y - from.y, to.x - from.x)
    const size = 7 + object.strokeWidth * 2
    if (object.shape === 'arrow' || object.shape === 'double-arrow') {
      arrowHead(ctx, to, angle, size)
    }
    if (object.shape === 'double-arrow') {
      arrowHead(ctx, from, angle + Math.PI, size)
    }
    ctx.restore()
    return
  }

  if (object.shape === 'rect' || object.shape === 'round-rect') {
    roundRectPath(ctx, x, y, w, h, object.shape === 'round-rect' ? object.radius : 0)
  } else if (object.shape === 'circle' || object.shape === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 0.5), Math.max(h / 2, 0.5), 0, 0, Math.PI * 2)
  } else if (object.shape === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(x + w / 2, y)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.closePath()
  } else {
    ctx.beginPath()
    ctx.moveTo(x + w * 0.5, y)
    ctx.lineTo(x + w, y + h * 0.38)
    ctx.lineTo(x + w * 0.82, y + h)
    ctx.lineTo(x + w * 0.18, y + h)
    ctx.lineTo(x, y + h * 0.38)
    ctx.closePath()
  }

  if (object.fill && object.fillOpacity > 0.01) {
    ctx.save()
    ctx.globalAlpha *= object.fillOpacity
    ctx.fillStyle = object.fill
    ctx.fill()
    ctx.restore()
  }
  ctx.stroke()
  ctx.restore()
}

export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
): string[] {
  ctx.font = font
  const lines: string[] = []
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }
    const words = paragraph.split(' ')
    let current = ''
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate
        continue
      }
      if (current) lines.push(current)
      if (ctx.measureText(word).width <= maxWidth) {
        current = word
        continue
      }
      let chunk = ''
      for (const character of word) {
        if (chunk && ctx.measureText(chunk + character).width > maxWidth) {
          lines.push(chunk)
          chunk = character
        } else {
          chunk += character
        }
      }
      current = chunk
    }
    if (current) lines.push(current)
  }
  return lines
}

function drawText(ctx: CanvasRenderingContext2D, object: Extract<WhiteboardObject, { type: 'text' }>): void {
  ctx.save()
  ctx.globalAlpha *= object.opacity
  const center = rectCenter(localBounds(object))
  if (object.rotation) {
    ctx.translate(center.x, center.y)
    ctx.rotate((object.rotation * Math.PI) / 180)
    ctx.translate(-center.x, -center.y)
  }
  const pad = 8
  if (object.background) {
    ctx.fillStyle = object.background
    roundRectPath(ctx, object.x, object.y, object.w, object.h, 6)
    ctx.fill()
  }
  const font = `${object.fontWeight} ${object.fontSize}px ${FONT_STACK}`
  const lines = wrapTextLines(ctx, object.text, Math.max(12, object.w - pad * 2), font)
  ctx.font = font
  ctx.fillStyle = object.color
  ctx.textBaseline = 'top'
  ctx.textAlign = object.align === 'center' ? 'center' : object.align === 'right' ? 'right' : 'left'
  const anchorX =
    object.align === 'center'
      ? object.x + object.w / 2
      : object.align === 'right'
        ? object.x + object.w - pad
        : object.x + pad
  const lineHeight = object.fontSize * 1.34
  lines.forEach((line, index) => {
    ctx.fillText(line, anchorX, object.y + pad + index * lineHeight)
  })
  ctx.restore()
}

function drawNote(ctx: CanvasRenderingContext2D, object: Extract<WhiteboardObject, { type: 'note' }>): void {
  ctx.save()
  ctx.globalAlpha *= object.opacity
  const center = rectCenter(localBounds(object))
  if (object.rotation) {
    ctx.translate(center.x, center.y)
    ctx.rotate((object.rotation * Math.PI) / 180)
    ctx.translate(-center.x, -center.y)
  }
  const dark = isDarkPaper(object.color)
  ctx.save()
  ctx.shadowColor = dark ? 'rgba(0,0,0,0.5)' : 'rgba(20,26,28,0.2)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  ctx.fillStyle = object.color
  roundRectPath(ctx, object.x, object.y, object.w, object.h, 4)
  ctx.fill()
  ctx.restore()

  const scale = Math.min(object.w / 184, object.h / 152)
  const fontSize = Math.max(10, Math.min(24, 14 * scale))
  const pad = Math.max(10, 13 * scale)
  const font = `500 ${fontSize}px ${FONT_STACK}`
  const lines = wrapTextLines(ctx, object.text, Math.max(10, object.w - pad * 2), font)
  ctx.font = font
  ctx.fillStyle = dark ? '#f2f4f3' : '#26302f'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const lineHeight = fontSize * 1.4
  const maxLines = Math.max(1, Math.floor((object.h - pad * 2) / lineHeight))
  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, object.x + pad, object.y + pad + index * lineHeight)
  })
  ctx.restore()
}

interface CachedImage {
  image: HTMLImageElement | null
  status: 'loading' | 'ready' | 'failed'
}

const imageCache = new Map<string, CachedImage>()

export function ensureImage(src: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(src)
  if (cached) {
    if (cached.status === 'ready') return Promise.resolve(cached.image)
    if (cached.status === 'failed') return Promise.resolve(null)
    return new Promise((resolve) => {
      const image = cached.image
      if (!image) {
        resolve(null)
        return
      }
      const done = () => resolve(cached.status === 'ready' ? cached.image : null)
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
    })
  }
  if (typeof Image === 'undefined') return Promise.resolve(null)
  const image = new Image()
  const entry: CachedImage = { image, status: 'loading' }
  imageCache.set(src, entry)
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    image.onload = () => {
      entry.status = 'ready'
      resolve(image)
    }
    image.onerror = () => {
      entry.status = 'failed'
      resolve(null)
    }
  })
  image.src = src
  return promise
}

export async function preloadImages(page: Page): Promise<void> {
  const sources = page.objects
    .filter((object): object is Extract<WhiteboardObject, { type: 'image' }> => object.type === 'image')
    .map((object) => object.src)
  await Promise.all(sources.map((src) => ensureImage(src)))
}

function drawImageObject(
  ctx: CanvasRenderingContext2D,
  object: Extract<WhiteboardObject, { type: 'image' }>,
  theme: ThemeColors,
): void {
  ctx.save()
  ctx.globalAlpha *= object.opacity
  const center = rectCenter(localBounds(object))
  if (object.rotation) {
    ctx.translate(center.x, center.y)
    ctx.rotate((object.rotation * Math.PI) / 180)
    ctx.translate(-center.x, -center.y)
  }
  const cached = imageCache.get(object.src)
  if (cached?.status === 'ready' && cached.image) {
    ctx.drawImage(cached.image, object.x, object.y, object.w, object.h)
  } else {
    ctx.fillStyle = theme.surface2
    ctx.strokeStyle = theme.stroke1
    ctx.lineWidth = 1
    roundRectPath(ctx, object.x, object.y, object.w, object.h, 4)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(object.x, object.y)
    ctx.lineTo(object.x + object.w, object.y + object.h)
    ctx.moveTo(object.x + object.w, object.y)
    ctx.lineTo(object.x, object.y + object.h)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawObject(
  ctx: CanvasRenderingContext2D,
  object: WhiteboardObject,
  theme: ThemeColors,
  paper: string,
): void {
  const dark = isDarkPaper(paper)
  switch (object.type) {
    case 'stroke':
      drawStroke(ctx, object, dark)
      break
    case 'shape':
      drawShape(ctx, object)
      break
    case 'text':
      drawText(ctx, object)
      break
    case 'note':
      drawNote(ctx, object)
      break
    case 'image':
      drawImageObject(ctx, object, theme)
      break
  }
}

export interface SceneOptions {
  page: Page
  view: { x: number; y: number; zoom: number }
  width: number
  height: number
  dpr: number
  /** Omit paper and pattern, keeping only the drawings. */
  transparent?: boolean
  theme?: ThemeColors
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  page: Page,
  view: SceneOptions['view'],
  width: number,
  height: number,
): void {
  if (page.background === 'blank') return
  const dark = isDarkPaper(page.paper)
  const rgb = dark ? '255,255,255' : '22,30,32'
  let spacing = 28 * view.zoom
  while (spacing > 0 && spacing < 11) spacing *= 2
  if (spacing <= 0) return
  const offsetX = ((view.x % spacing) + spacing) % spacing
  const offsetY = ((view.y % spacing) + spacing) % spacing

  if (page.background === 'dots') {
    ctx.fillStyle = `rgba(${rgb},${dark ? 0.24 : 0.2})`
    for (let x = offsetX; x < width; x += spacing) {
      for (let y = offsetY; y < height; y += spacing) {
        ctx.beginPath()
        ctx.arc(x, y, 1.15, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return
  }

  const minorAlpha = dark ? 0.075 : 0.055
  ctx.lineWidth = 1
  ctx.strokeStyle = `rgba(${rgb},${minorAlpha})`
  ctx.beginPath()
  for (let x = offsetX; x < width; x += spacing) {
    ctx.moveTo(Math.round(x) + 0.5, 0)
    ctx.lineTo(Math.round(x) + 0.5, height)
  }
  for (let y = offsetY; y < height; y += spacing) {
    ctx.moveTo(0, Math.round(y) + 0.5)
    ctx.lineTo(width, Math.round(y) + 0.5)
  }
  ctx.stroke()

  if (page.background === 'graph') {
    const major = spacing * 5
    const majorX = ((view.x % major) + major) % major
    const majorY = ((view.y % major) + major) % major
    ctx.strokeStyle = `rgba(${rgb},${dark ? 0.16 : 0.12})`
    ctx.beginPath()
    for (let x = majorX; x < width; x += major) {
      ctx.moveTo(Math.round(x) + 0.5, 0)
      ctx.lineTo(Math.round(x) + 0.5, height)
    }
    for (let y = majorY; y < height; y += major) {
      ctx.moveTo(0, Math.round(y) + 0.5)
      ctx.lineTo(width, Math.round(y) + 0.5)
    }
    ctx.stroke()
  }
}

export function drawScene(ctx: CanvasRenderingContext2D, options: SceneOptions): void {
  const { page, view, width, height, dpr } = options
  const theme = options.theme ?? readThemeColors()
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!options.transparent) {
    ctx.fillStyle = page.paper
    ctx.fillRect(0, 0, width, height)
    drawPattern(ctx, page, view, width, height)
  }
  ctx.translate(view.x, view.y)
  ctx.scale(view.zoom, view.zoom)
  for (const object of page.objects) {
    drawObject(ctx, object, theme, page.paper)
  }
  ctx.restore()
}

export interface LaserPoint extends Point {
  at: number
}

export interface GestureCursor {
  x: number
  y: number
  pinching: boolean
  paused: boolean
  fist: boolean
}

export interface OverlayOptions {
  view: SceneOptions['view']
  width: number
  height: number
  dpr: number
  theme: ThemeColors
  selection: WhiteboardObject[]
  showHandles: boolean
  lasso: Point[] | null
  marquee: Rect | null
  ruler: RulerState
  laser: LaserPoint[]
  laserSettings: LaserSettings
  now: number
  gesture: GestureCursor | null
  labels?: { locked: string }
}

const HANDLE_POSITIONS: Array<['nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w', number, number]> = [
  ['nw', 0, 0],
  ['n', 0.5, 0],
  ['ne', 1, 0],
  ['e', 1, 0.5],
  ['se', 1, 1],
  ['s', 0.5, 1],
  ['sw', 0, 1],
  ['w', 0, 0.5],
]

export function handleScreenPoints(
  bounds: Rect,
  view: SceneOptions['view'],
): Array<{ handle: (typeof HANDLE_POSITIONS)[number][0]; x: number; y: number }> {
  return HANDLE_POSITIONS.map(([handle, fx, fy]) => ({
    handle,
    x: (bounds.x + bounds.w * fx) * view.zoom + view.x,
    y: (bounds.y + bounds.h * fy) * view.zoom + view.y,
  }))
}

function drawSelection(ctx: CanvasRenderingContext2D, options: OverlayOptions): void {
  if (options.selection.length === 0) return
  const bounds = selectionBounds(options.selection)
  if (!bounds) return
  const { view, theme } = options
  const x = bounds.x * view.zoom + view.x
  const y = bounds.y * view.zoom + view.y
  const w = bounds.w * view.zoom
  const h = bounds.h * view.zoom
  const locked = options.selection.every((object) => object.locked)
  const color = locked ? theme.text3 : theme.accent

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.strokeRect(x + 0.5, y + 0.5, w, h)
  ctx.setLineDash([])

  if (options.showHandles && !locked) {
    const points = handleScreenPoints(bounds, view)
    ctx.fillStyle = theme.surface1
    ctx.strokeStyle = color
    for (const point of points) {
      ctx.beginPath()
      ctx.rect(point.x - 3.5, point.y - 3.5, 7, 7)
      ctx.fill()
      ctx.stroke()
    }
    const rotateX = x + w / 2
    const rotateY = y - 26
    ctx.beginPath()
    ctx.moveTo(rotateX, y)
    ctx.lineTo(rotateX, rotateY)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(rotateX, rotateY, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (locked) {
    const label = options.labels?.locked
    if (!label) {
      ctx.restore()
      return
    }
    ctx.fillStyle = theme.text3
    ctx.font = `500 10px ${FONT_STACK}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText(label, x, y - 6)
  }
  ctx.restore()
}

function drawLaser(ctx: CanvasRenderingContext2D, options: OverlayOptions): void {
  if (options.laser.length === 0) return
  const { view, laser, now } = options
  const duration = options.laserSettings.duration
  ctx.save()
  for (let index = 1; index < laser.length; index += 1) {
    const from = laser[index - 1]!
    const to = laser[index]!
    const age = now - to.at
    if (age > duration) continue
    const fade = Math.max(0, 1 - age / duration)
    ctx.strokeStyle = `rgba(255,86,86,${fade * 0.85})`
    ctx.lineWidth = 3 * fade + 1
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(255,86,86,0.75)'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(from.x * view.zoom + view.x, from.y * view.zoom + view.y)
    ctx.lineTo(to.x * view.zoom + view.x, to.y * view.zoom + view.y)
    ctx.stroke()
  }
  const tip = laser[laser.length - 1]
  if (tip) {
    const age = now - tip.at
    const fade = Math.max(0, 1 - age / duration)
    if (fade > 0) {
      ctx.fillStyle = `rgba(255,120,110,${fade})`
      ctx.shadowBlur = 16
      ctx.beginPath()
      ctx.arc(tip.x * view.zoom + view.x, tip.y * view.zoom + view.y, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawRuler(ctx: CanvasRenderingContext2D, options: OverlayOptions): void {
  if (!options.ruler.visible) return
  const { theme, ruler, width, height } = options
  const length = Math.max(width, height) * 0.86
  ctx.save()
  ctx.translate(ruler.x, ruler.y)
  ctx.rotate((ruler.angle * Math.PI) / 180)
  ctx.globalAlpha = 0.94
  ctx.fillStyle = theme.surface2
  ctx.strokeStyle = theme.stroke1
  ctx.lineWidth = 1
  roundRectPath(ctx, -length / 2, -7, length, 14, 7)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = theme.text3
  ctx.beginPath()
  for (let offset = -length / 2 + 16; offset < length / 2 - 16; offset += 24) {
    const major = Math.round(offset / 120) === offset / 120
    ctx.moveTo(offset, -6)
    ctx.lineTo(offset, major ? 4 : 0)
  }
  ctx.stroke()
  ctx.fillStyle = theme.accent
  ctx.strokeStyle = theme.accent
  ctx.beginPath()
  ctx.arc(length / 2, 0, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawGestureCursor(ctx: CanvasRenderingContext2D, options: OverlayOptions): void {
  const cursor = options.gesture
  if (!cursor) return
  const { theme } = options
  const color = cursor.paused ? theme.danger : theme.accent
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cursor.x, cursor.y, cursor.pinching ? 9 : 15, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cursor.x, cursor.y, 3.5, 0, Math.PI * 2)
  ctx.fill()
  if (cursor.pinching) {
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(cursor.x, cursor.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  if (cursor.fist) {
    ctx.globalAlpha = 0.9
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(cursor.x, cursor.y, 21, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawOverlay(ctx: CanvasRenderingContext2D, options: OverlayOptions): void {
  ctx.save()
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0)
  ctx.clearRect(0, 0, options.width, options.height)

  if (options.marquee) {
    const { view, theme } = options
    const x = options.marquee.x * view.zoom + view.x
    const y = options.marquee.y * view.zoom + view.y
    const w = options.marquee.w * view.zoom
    const h = options.marquee.h * view.zoom
    ctx.fillStyle = theme.accent
    ctx.globalAlpha = 0.08
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 1
    ctx.strokeStyle = theme.accent
    ctx.setLineDash([4, 3])
    ctx.strokeRect(x + 0.5, y + 0.5, w, h)
    ctx.setLineDash([])
  }

  if (options.lasso && options.lasso.length > 1) {
    const { view, theme } = options
    ctx.beginPath()
    options.lasso.forEach((point, index) => {
      const x = point.x * view.zoom + view.x
      const y = point.y * view.zoom + view.y
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fillStyle = theme.accent
    ctx.globalAlpha = 0.07
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = theme.accent
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])
  }

  drawRuler(ctx, options)
  drawLaser(ctx, options)
  drawSelection(ctx, options)
  drawGestureCursor(ctx, options)
  ctx.restore()
}

/** Bounds used for exports and "fit to content". */
export function contentBounds(page: Page): Rect {
  const bounds = selectionBounds(page.objects)
  if (bounds) return bounds
  return { x: 0, y: 0, w: 1280, h: 720 }
}

export { objectBounds }
