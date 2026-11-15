import { describe, expect, it } from 'vitest'
import {
  alignObjects,
  constrainShape,
  hitTest,
  lineEndpoints,
  localBounds,
  objectBounds,
  objectsInPolygon,
  pick,
  rectCenter,
  resizeSelection,
  rotateObjectAround,
  selectionBounds,
  snapToRuler,
  translateObject,
} from '@/whiteboard/geometry'
import type { ShapeObject, StrokeObject } from '@/whiteboard/types'

const stroke = (overrides: Partial<StrokeObject> = {}): StrokeObject => ({
  id: 's1',
  type: 'stroke',
  ink: 'pen',
  points: [
    { x: 10, y: 10 },
    { x: 50, y: 30 },
  ],
  color: '#123456',
  width: 4,
  opacity: 1,
  rotation: 0,
  locked: false,
  groupId: null,
  ...overrides,
})

const shape = (overrides: Partial<ShapeObject> = {}): ShapeObject => ({
  id: 'r1',
  type: 'shape',
  shape: 'rect',
  x: 0,
  y: 0,
  w: 100,
  h: 50,
  flipX: false,
  flipY: false,
  stroke: '#111111',
  fill: null,
  fillOpacity: 0,
  strokeWidth: 2,
  radius: 0,
  opacity: 1,
  rotation: 0,
  locked: false,
  groupId: null,
  ...overrides,
})

describe('whiteboard geometry', () => {
  it('pads stroke bounds by half the stroke width', () => {
    expect(localBounds(stroke())).toEqual({ x: 8, y: 8, w: 44, h: 24 })
  })

  it('expands rotated bounds to the axis-aligned box', () => {
    const bounds = objectBounds(shape({ rotation: 90 }))
    expect(bounds.x).toBeCloseTo(25)
    expect(bounds.y).toBeCloseTo(-25)
    expect(bounds.w).toBeCloseTo(50)
    expect(bounds.h).toBeCloseTo(100)
  })

  it('unions selection bounds across object kinds', () => {
    const bounds = selectionBounds([shape(), stroke()])
    expect(bounds).toEqual({ x: 0, y: 0, w: 100, h: 50 })
  })

  it('hit tests strokes, filled shapes and outline edges', () => {
    expect(hitTest(stroke(), { x: 30, y: 20 }, 1)).toBe(true)
    expect(hitTest(stroke(), { x: 30, y: 45 }, 1)).toBe(false)

    const outline = shape()
    expect(hitTest(outline, { x: 50, y: 25 }, 2)).toBe(false)
    expect(hitTest(outline, { x: 1, y: 25 }, 2)).toBe(true)

    const filled = shape({ fill: '#ff0000', fillOpacity: 0.5 })
    expect(hitTest(filled, { x: 50, y: 25 }, 2)).toBe(true)
  })

  it('picks the topmost object under the pointer', () => {
    const bottom = shape({ id: 'bottom', fill: '#ffffff', fillOpacity: 1 })
    const top = shape({
      id: 'top',
      x: 10,
      y: 10,
      w: 20,
      h: 20,
      fill: '#ffffff',
      fillOpacity: 1,
    })
    const result = pick([bottom, top], { x: 15, y: 15 }, 1)
    expect(result?.object.id).toBe('top')
  })

  it('aligns objects to shared edges and centres', () => {
    const a = shape({ id: 'a', x: 10, y: 10, w: 20, h: 20 })
    const b = shape({ id: 'b', x: 100, y: 80, w: 40, h: 20 })
    const aligned = alignObjects([a, b], 'center')
    expect(rectCenter(objectBounds(aligned[0]!)).x).toBeCloseTo(
      rectCenter(objectBounds(aligned[1]!)).x,
    )
    const top = alignObjects([a, b], 'top')
    expect(top.every((object) => object.type !== 'shape' || object.y === 10)).toBe(true)
  })

  it('scales a selection from the opposite edge', () => {
    const bounds = { x: 0, y: 0, w: 100, h: 50 }
    const [scaled] = resizeSelection([shape()], bounds, 'e', { x: 200, y: 25 })
    expect(scaled).toMatchObject({ x: 0, y: 0, w: 200, h: 50 })
  })

  it('translates strokes by moving every point', () => {
    const moved = translateObject(stroke(), 5, -5) as StrokeObject
    expect(moved.points[0]).toEqual({ x: 15, y: 5 })
    expect(localBounds(moved).x).toBe(13)
  })

  it('rotates non-stroke objects around a shared centre', () => {
    const rotated = rotateObjectAround(
      shape({ x: 100, y: 0, w: 20, h: 20 }),
      { x: 0, y: 0 },
      180,
    ) as ShapeObject
    expect(rotated.x).toBeCloseTo(-120)
    expect(rotated.y).toBeCloseTo(-20)
    expect(rotated.rotation).toBe(180)
  })

  it('selects objects touched by a lasso polygon', () => {
    const inside = shape({ id: 'inside', x: 20, y: 20, w: 20, h: 20 })
    const outside = shape({ id: 'outside', x: 300, y: 300, w: 20, h: 20 })
    const polygon = [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 120 },
      { x: 0, y: 120 },
    ]
    expect(objectsInPolygon([inside, outside], polygon).map((object) => object.id)).toEqual([
      'inside',
    ])
  })

  it('snaps constrained lines to 45 degree steps', () => {
    const point = constrainShape({ x: 0, y: 0 }, { x: 10, y: 9 }, 'line')
    expect(point.x).toBeCloseTo(point.y)
    expect(Math.hypot(point.x, point.y)).toBeCloseTo(Math.hypot(10, 9))
  })

  it('projects points onto the ruler within the threshold', () => {
    expect(snapToRuler({ x: 50, y: 3 }, { angle: 0, x: 0, y: 0 }, 5)).toEqual({ x: 50, y: 0 })
    expect(snapToRuler({ x: 50, y: 12 }, { angle: 0, x: 0, y: 0 }, 5)).toBeNull()
  })

  it('derives line endpoints from flip flags without extra state', () => {
    const line = shape({ shape: 'line', flipX: false, flipY: false })
    expect(lineEndpoints(line)).toEqual({ from: { x: 0, y: 0 }, to: { x: 100, y: 50 } })
    const flipped = shape({ shape: 'line', flipX: true, flipY: true })
    expect(lineEndpoints(flipped)).toEqual({ from: { x: 100, y: 50 }, to: { x: 0, y: 0 } })
  })
})
