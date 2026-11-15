import { describe, expect, it } from 'vitest'
import {
  exportPage,
  pageToSvg,
  sanitizeFilename,
} from '@/whiteboard/export'
import { contentBounds } from '@/whiteboard/render'
import { newPage } from '@/whiteboard/defaults'
import type { Page, ShapeObject, StrokeObject } from '@/whiteboard/types'

const shape: ShapeObject = {
  id: 'shape-1',
  type: 'shape',
  shape: 'rect',
  x: 10,
  y: 20,
  w: 120,
  h: 80,
  flipX: false,
  flipY: false,
  stroke: '#1b2124',
  fill: '#3f6df0',
  fillOpacity: 0.3,
  strokeWidth: 3,
  radius: 6,
  opacity: 1,
  rotation: 0,
  locked: false,
  groupId: null,
}

const stroke: StrokeObject = {
  id: 'stroke-1',
  type: 'stroke',
  ink: 'pen',
  points: [
    { x: 200, y: 200 },
    { x: 260, y: 240 },
  ],
  color: '#e2483f',
  width: 5,
  opacity: 0.9,
  rotation: 0,
  locked: false,
  groupId: null,
}

const pageWith = (objects: Page['objects'], paper = '#f7f7f4'): Page => ({
  ...newPage('Board'),
  paper,
  background: 'grid',
  objects,
})

describe('whiteboard export', () => {
  it('sanitizes filenames for every platform', () => {
    expect(sanitizeFilename('A/B:C*?"<>|')).toBe('A B C')
    expect(sanitizeFilename('   ')).toBe('whiteboard')
    expect(sanitizeFilename(`tab\u0000name`)).toBe('tabname')
    expect(sanitizeFilename('a'.repeat(120))).toHaveLength(80)
  })

  it('falls back to a 1280x720 content box for an empty page', () => {
    expect(contentBounds(pageWith([]))).toEqual({ x: 0, y: 0, w: 1280, h: 720 })
  })

  it('uses the drawing bounds with a margin for the SVG viewport', () => {
    const result = pageToSvg(pageWith([shape]), { margin: 32 })
    expect(result.width).toBe(120 + 64)
    expect(result.height).toBe(80 + 64)
    expect(result.svg).toContain('<svg')
    expect(result.svg).toContain('viewBox="0 0 184 144"')
    expect(result.svg).toContain('<rect')
    expect(result.svg).toContain('fill="#3f6df0"')
  })

  it('omits the paper fill when transparency is requested', () => {
    const page = pageWith([stroke])
    const opaque = pageToSvg(page).svg
    const transparent = pageToSvg(page, { transparent: true }).svg
    expect(opaque).toContain('fill="#f7f7f4"')
    expect(transparent).not.toContain('fill="#f7f7f4"')
    expect(transparent).toContain('<path')
    expect(transparent).not.toContain('wb-grid')
  })

  it('returns a downloadable SVG blob with a safe name', async () => {
    const result = await exportPage(pageWith([shape]), {
      format: 'svg',
      name: 'My/Board',
    })
    expect(result.filename).toBe('My Board.svg')
    expect(result.blob.type).toContain('image/svg+xml')
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.format).toBe('svg')
  })
})
