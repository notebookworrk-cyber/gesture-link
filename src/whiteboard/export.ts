import { jsPDF } from 'jspdf'
import { FONT_STACK, contentBounds, drawScene, isDarkPaper, readThemeColors, wrapTextLines } from './render'
import { lineEndpoints, localBounds, rectCenter } from './geometry'
import type { FontWeight, Page, Point, ShapeObject, StrokeObject, WhiteboardObject } from './types'

export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf'

export interface ExportOptions {
  format: ExportFormat
  /** Skip the paper fill; PNG and SVG support it. */
  transparent?: boolean
  /** Pixel multiplier for raster output. */
  scale?: number
  /** Margin in world units around the drawings. */
  margin?: number
  /** Base filename without extension. */
  name?: string
}

export interface ExportResult {
  blob: Blob
  filename: string
  width: number
  height: number
  format: ExportFormat
}

const EXTENSION: Record<ExportFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  svg: 'svg',
  pdf: 'pdf',
}

export function sanitizeFilename(name: string): string {
  const printable = Array.from(name)
    .filter((char) => char.charCodeAt(0) > 31)
    .join('')
  const cleaned = printable
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, 80) || 'whiteboard'
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('The browser could not encode this image.'))
      },
      type,
      quality,
    )
  })
}

export async function pageToCanvas(
  page: Page,
  options: { scale?: number; margin?: number; transparent?: boolean } = {},
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const margin = options.margin ?? 32
  const scale = Math.min(4, Math.max(0.5, options.scale ?? 2))
  const bounds = contentBounds(page)
  const width = Math.max(16, Math.ceil(bounds.w + margin * 2))
  const height = Math.max(16, Math.ceil(bounds.h + margin * 2))
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(8192, Math.round(width * scale))
  canvas.height = Math.min(8192, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot create a 2D canvas.')
  const theme = readThemeColors()
  theme.paperDark = isDarkPaper(page.paper)
  drawScene(context, {
    page,
    view: { x: margin - bounds.x, y: margin - bounds.y, zoom: 1 },
    width,
    height,
    dpr: canvas.width / width,
    transparent: options.transparent,
    theme,
  })
  return { canvas, width, height }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function svgNumber(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0'
}

function strokePathData(points: Point[]): string {
  if (points.length === 0) return ''
  const first = points[0]!
  let path = `M ${svgNumber(first.x)} ${svgNumber(first.y)}`
  if (points.length === 1) return `${path} L ${svgNumber(first.x + 0.1)} ${svgNumber(first.y)}`
  if (points.length === 2) {
    const last = points[1]!
    return `${path} L ${svgNumber(last.x)} ${svgNumber(last.y)}`
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!
    const next = points[index + 1]!
    path += ` Q ${svgNumber(point.x)} ${svgNumber(point.y)} ${svgNumber((point.x + next.x) / 2)} ${svgNumber((point.y + next.y) / 2)}`
  }
  const last = points[points.length - 1]!
  return `${path} L ${svgNumber(last.x)} ${svgNumber(last.y)}`
}

function arrowPolygon(tip: Point, angle: number, size: number): string {
  const spread = Math.PI / 7
  const a = { x: tip.x - Math.cos(angle - spread) * size, y: tip.y - Math.sin(angle - spread) * size }
  const b = { x: tip.x - Math.cos(angle + spread) * size, y: tip.y - Math.sin(angle + spread) * size }
  return `${svgNumber(tip.x)},${svgNumber(tip.y)} ${svgNumber(a.x)},${svgNumber(a.y)} ${svgNumber(b.x)},${svgNumber(b.y)}`
}

function objectTransform(object: WhiteboardObject): string {
  if (!object.rotation) return ''
  const center = rectCenter(localBounds(object))
  return ` transform="rotate(${svgNumber(object.rotation)} ${svgNumber(center.x)} ${svgNumber(center.y)})"`
}

function strokeToSvg(object: StrokeObject, paper: string): string {
  const dark = isDarkPaper(paper)
  const highlighter = object.ink === 'highlighter'
  const opacity = highlighter ? 0.42 : object.ink === 'pencil' ? 0.84 : 1
  const composite = highlighter && !dark ? ' style="mix-blend-mode:multiply"' : ''
  const cap = highlighter ? 'butt' : 'round'
  const attrs = `fill="none" stroke="${escapeXml(object.color)}" stroke-opacity="${svgNumber(opacity)}" stroke-linecap="${cap}" stroke-linejoin="round"`
  if (object.ink === 'pen' && object.points.some((point) => point.p !== undefined)) {
    let out = ''
    for (let index = 1; index < object.points.length; index += 1) {
      const from = object.points[index - 1]!
      const to = object.points[index]!
      const pressure = to.p ?? from.p ?? 0.5
      out += `<line x1="${svgNumber(from.x)}" y1="${svgNumber(from.y)}" x2="${svgNumber(to.x)}" y2="${svgNumber(to.y)}" ${attrs} stroke-width="${svgNumber(Math.max(0.4, object.width * (0.45 + pressure * 1.05)))}"${composite}/>`
    }
    return out
  }
  const path = `<path d="${strokePathData(object.points)}" ${attrs} stroke-width="${svgNumber(object.width)}"${composite}/>`
  if (object.ink !== 'pencil') return path
  return `${path}<g transform="translate(0.55 0.7)" opacity="0.3"><path d="${strokePathData(object.points)}" ${attrs} stroke-width="${svgNumber(Math.max(0.5, object.width * 0.75))}"${composite}/></g>`
}

function shapeToSvg(object: ShapeObject): string {
  const { x, y, w, h } = object
  const fill = object.fill ?? 'none'
  const fillOpacity = object.fill ? object.fillOpacity : 0
  const common = `fill="${escapeXml(fill)}" fill-opacity="${svgNumber(fillOpacity)}" stroke="${escapeXml(object.stroke)}" stroke-width="${svgNumber(object.strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"`
  const open = `<g opacity="${svgNumber(object.opacity)}"${objectTransform(object)}>`
  const close = '</g>'
  switch (object.shape) {
    case 'line':
    case 'arrow':
    case 'double-arrow': {
      const { from, to } = lineEndpoints(object)
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      const size = 7 + object.strokeWidth * 2
      let heads = ''
      if (object.shape !== 'line') {
        heads += `<polygon points="${arrowPolygon(to, angle, size)}" fill="${escapeXml(object.stroke)}"/>`
      }
      if (object.shape === 'double-arrow') {
        heads += `<polygon points="${arrowPolygon(from, angle + Math.PI, size)}" fill="${escapeXml(object.stroke)}"/>`
      }
      return `${open}<line x1="${svgNumber(from.x)}" y1="${svgNumber(from.y)}" x2="${svgNumber(to.x)}" y2="${svgNumber(to.y)}" fill="none" stroke="${escapeXml(object.stroke)}" stroke-width="${svgNumber(object.strokeWidth)}" stroke-linecap="round"/>${heads}${close}`
    }
    case 'rect':
    case 'round-rect':
      return `${open}<rect x="${svgNumber(x)}" y="${svgNumber(y)}" width="${svgNumber(w)}" height="${svgNumber(h)}" rx="${svgNumber(object.shape === 'round-rect' ? object.radius : 0)}" ${common}/>${close}`
    case 'circle':
    case 'ellipse':
      return `${open}<ellipse cx="${svgNumber(x + w / 2)}" cy="${svgNumber(y + h / 2)}" rx="${svgNumber(w / 2)}" ry="${svgNumber(h / 2)}" ${common}/>${close}`
    case 'triangle':
      return `${open}<polygon points="${svgNumber(x + w / 2)},${svgNumber(y)} ${svgNumber(x + w)},${svgNumber(y + h)} ${svgNumber(x)},${svgNumber(y + h)}" ${common}/>${close}`
    case 'polygon':
      return `${open}<polygon points="${svgNumber(x + w * 0.5)},${svgNumber(y)} ${svgNumber(x + w)},${svgNumber(y + h * 0.38)} ${svgNumber(x + w * 0.82)},${svgNumber(y + h)} ${svgNumber(x + w * 0.18)},${svgNumber(y + h)} ${svgNumber(x)},${svgNumber(y + h * 0.38)}" ${common}/>${close}`
  }
}

function wrapForSvg(
  text: string,
  maxWidth: number,
  font: string,
): string[] {
  if (typeof document === 'undefined') {
    return text.split('\n')
  }
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return text.split('\n')
  return wrapTextLines(context, text, maxWidth, font)
}

function textToSvg(object: Extract<WhiteboardObject, { type: 'text' }>): string {
  const pad = 8
  const font = `${object.fontWeight} ${object.fontSize}px ${FONT_STACK}`
  const lines = wrapForSvg(object.text, Math.max(12, object.w - pad * 2), font)
  const anchor = object.align === 'center' ? 'middle' : object.align === 'right' ? 'end' : 'start'
  const x = object.align === 'center' ? object.x + object.w / 2 : object.align === 'right' ? object.x + object.w - pad : object.x + pad
  const lineHeight = object.fontSize * 1.34
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${svgNumber(x)}" y="${svgNumber(object.y + pad + index * lineHeight + object.fontSize * 0.85)}">${escapeXml(line)}</tspan>`,
    )
    .join('')
  const background = object.background
    ? `<rect x="${svgNumber(object.x)}" y="${svgNumber(object.y)}" width="${svgNumber(object.w)}" height="${svgNumber(object.h)}" rx="6" fill="${escapeXml(object.background)}"/>`
    : ''
  return `<g opacity="${svgNumber(object.opacity)}"${objectTransform(object)}>${background}<text font-family="${escapeXml(FONT_STACK)}" font-size="${svgNumber(object.fontSize)}" font-weight="${object.fontWeight}" fill="${escapeXml(object.color)}" text-anchor="${anchor}">${tspans}</text></g>`
}

function noteToSvg(object: Extract<WhiteboardObject, { type: 'note' }>): string {
  const scale = Math.min(object.w / 184, object.h / 152)
  const fontSize = Math.max(10, Math.min(24, 14 * scale))
  const pad = Math.max(10, 13 * scale)
  const font = `500 ${fontSize}px ${FONT_STACK}`
  const lines = wrapForSvg(object.text, Math.max(10, object.w - pad * 2), font)
  const lineHeight = fontSize * 1.4
  const maxLines = Math.max(1, Math.floor((object.h - pad * 2) / lineHeight))
  const tspans = lines
    .slice(0, maxLines)
    .map(
      (line, index) =>
        `<tspan x="${svgNumber(object.x + pad)}" y="${svgNumber(object.y + pad + index * lineHeight + fontSize * 0.85)}">${escapeXml(line)}</tspan>`,
    )
    .join('')
  const dark = isDarkPaper(object.color)
  return `<g opacity="${svgNumber(object.opacity)}"${objectTransform(object)}><rect x="${svgNumber(object.x)}" y="${svgNumber(object.y)}" width="${svgNumber(object.w)}" height="${svgNumber(object.h)}" rx="4" fill="${escapeXml(object.color)}" filter="url(#wb-note-shadow)"/><text font-family="${escapeXml(FONT_STACK)}" font-size="${svgNumber(fontSize)}" font-weight="500" fill="${dark ? '#f2f4f3' : '#26302f'}">${tspans}</text></g>`
}

function imageToSvg(object: Extract<WhiteboardObject, { type: 'image' }>): string {
  return `<g opacity="${svgNumber(object.opacity)}"${objectTransform(object)}><image href="${escapeXml(object.src)}" x="${svgNumber(object.x)}" y="${svgNumber(object.y)}" width="${svgNumber(object.w)}" height="${svgNumber(object.h)}" preserveAspectRatio="none"/></g>`
}

function objectToSvg(object: WhiteboardObject, paper: string): string {
  switch (object.type) {
    case 'stroke':
      return `<g opacity="${svgNumber(object.opacity)}">${strokeToSvg(object, paper)}</g>`
    case 'shape':
      return shapeToSvg(object)
    case 'text':
      return textToSvg(object)
    case 'note':
      return noteToSvg(object)
    case 'image':
      return imageToSvg(object)
  }
}

export function pageToSvg(
  page: Page,
  options: { transparent?: boolean; margin?: number } = {},
): { svg: string; width: number; height: number } {
  const margin = options.margin ?? 32
  const bounds = contentBounds(page)
  const width = Math.max(16, Math.ceil(bounds.w + margin * 2))
  const height = Math.max(16, Math.ceil(bounds.h + margin * 2))
  const dark = isDarkPaper(page.paper)
  const rgb = dark ? '255,255,255' : '22,30,32'
  const offsetX = margin - bounds.x
  const offsetY = margin - bounds.y

  let defs = `<filter id="wb-note-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="${dark ? '#000000' : '#141a1c'}" flood-opacity="${dark ? 0.55 : 0.2}"/></filter>`
  let fill = ''
  if (!options.transparent) {
    fill = `<rect width="${width}" height="${height}" fill="${escapeXml(page.paper)}"/>`
    if (page.background !== 'blank') {
      if (page.background === 'dots') {
        defs += `<pattern id="wb-dots" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="translate(${svgNumber(offsetX)} ${svgNumber(offsetY)})"><circle cx="1" cy="1" r="1.15" fill="rgba(${rgb},${dark ? 0.24 : 0.2})"/></pattern>`
        fill += `<rect width="${width}" height="${height}" fill="url(#wb-dots)"/>`
      } else {
        defs += `<pattern id="wb-grid" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="translate(${svgNumber(offsetX)} ${svgNumber(offsetY)})"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(${rgb},${dark ? 0.075 : 0.055})" stroke-width="1"/></pattern>`
        fill += `<rect width="${width}" height="${height}" fill="url(#wb-grid)"/>`
        if (page.background === 'graph') {
          defs += `<pattern id="wb-graph" width="140" height="140" patternUnits="userSpaceOnUse" patternTransform="translate(${svgNumber(offsetX)} ${svgNumber(offsetY)})"><path d="M 140 0 L 0 0 0 140" fill="none" stroke="rgba(${rgb},${dark ? 0.16 : 0.12})" stroke-width="1"/></pattern>`
          fill += `<rect width="${width}" height="${height}" fill="url(#wb-graph)"/>`
        }
      }
    }
  }

  const body = page.objects.map((object) => objectToSvg(object, page.paper)).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs}</defs>${fill}<g transform="translate(${svgNumber(offsetX)} ${svgNumber(offsetY)})">${body}</g></svg>`
  return { svg, width, height }
}

export async function exportPage(page: Page, options: ExportOptions): Promise<ExportResult> {
  const format = options.format
  const name = sanitizeFilename(options.name ?? page.name ?? 'whiteboard')
  const filename = `${name}.${EXTENSION[format]}`
  const margin = options.margin ?? 32

  if (format === 'svg') {
    const result = pageToSvg(page, { transparent: options.transparent, margin })
    return {
      blob: new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' }),
      filename,
      width: result.width,
      height: result.height,
      format,
    }
  }

  const transparent = format === 'png' ? Boolean(options.transparent) : false
  const { canvas, width, height } = await pageToCanvas(page, {
    scale: options.scale ?? 2,
    margin,
    transparent,
  })

  if (format === 'pdf') {
    const image = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: width >= height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
      hotfixes: ['px_scaling'],
      compress: true,
    })
    pdf.addImage(image, 'PNG', 0, 0, width, height)
    const blob = pdf.output('blob')
    return { blob, filename, width, height, format }
  }

  const blob = await canvasToBlob(
    canvas,
    format === 'png' ? 'image/png' : 'image/jpeg',
    format === 'jpeg' ? 0.92 : undefined,
  )
  return { blob, filename, width, height, format }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export type { FontWeight }
