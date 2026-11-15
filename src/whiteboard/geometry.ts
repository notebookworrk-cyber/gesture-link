import type {
  Point,
  Rect,
  ShapeObject,
  StrokeObject,
  WhiteboardObject,
} from './types'

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  }
}

export function rotatePoint(point: Point, center: Point, degrees: number): Point {
  if (!degrees) return { ...point }
  const angle = (degrees * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
    ...(point.p === undefined ? {} : { p: point.p }),
  }
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const rect of rects) {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.w)
    maxY = Math.max(maxY, rect.y + rect.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Unrotated geometry. Strokes bake rotation into their points. */
export function localBounds(obj: WhiteboardObject): Rect {
  switch (obj.type) {
    case 'stroke': {
      if (obj.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const point of obj.points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
      const pad = obj.width / 2
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
    }
    default:
      return { x: obj.x, y: obj.y, w: obj.w, h: obj.h }
  }
}

export function objectCenter(obj: WhiteboardObject): Point {
  return rectCenter(localBounds(obj))
}

/** Axis-aligned bounds after rotation, used for selection and export. */
export function objectBounds(obj: WhiteboardObject): Rect {
  const local = localBounds(obj)
  if (!obj.rotation) return local
  const center = rectCenter(local)
  const corners = [
    { x: local.x, y: local.y },
    { x: local.x + local.w, y: local.y },
    { x: local.x + local.w, y: local.y + local.h },
    { x: local.x, y: local.y + local.h },
  ].map((point) => rotatePoint(point, center, obj.rotation))
  return unionRects(
    corners.map((point) => ({ x: point.x, y: point.y, w: 0, h: 0 })),
  ) as Rect
}

export function selectionBounds(objects: WhiteboardObject[]): Rect | null {
  return unionRects(objects.map(objectBounds))
}

export function lineEndpoints(obj: ShapeObject): { from: Point; to: Point } {
  const local = localBounds(obj)
  return {
    from: { x: local.x + (obj.flipX ? local.w : 0), y: local.y + (obj.flipY ? local.h : 0) },
    to: { x: local.x + (obj.flipX ? 0 : local.w), y: local.y + (obj.flipY ? 0 : local.h) },
  }
}

const pointSegmentDistance = (point: Point, from: Point, to: Point): number => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return distance(point, from)
  const t = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq, 0, 1)
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy))
}

export function nearestPointOnSegment(point: Point, from: Point, to: Point): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return { ...from }
  const t = clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSq, 0, 1)
  return { x: from.x + t * dx, y: from.y + t * dy }
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (!a || !b) continue
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

function polygonPoints(obj: ShapeObject): Point[] {
  const { x, y, w, h } = obj
  if (obj.shape === 'triangle') {
    return [
      { x: x + w / 2, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ]
  }
  return [
    { x: x + w * 0.5, y },
    { x: x + w, y: y + h * 0.38 },
    { x: x + w * 0.82, y: y + h },
    { x: x + w * 0.18, y: y + h },
    { x, y: y + h * 0.38 },
  ]
}

/**
 * Hit test in world units. `tolerance` compensates for zoom so thin strokes
 * remain selectable when the canvas is zoomed far out.
 */
export function hitTest(obj: WhiteboardObject, point: Point, tolerance = 4): boolean {
  const local = localBounds(obj)
  const localPoint = obj.rotation
    ? rotatePoint(point, rectCenter(local), -obj.rotation)
    : point

  switch (obj.type) {
    case 'stroke':
      return strokeHit(obj, localPoint, tolerance)
    case 'text':
    case 'note':
    case 'image':
      return (
        localPoint.x >= local.x - tolerance &&
        localPoint.x <= local.x + local.w + tolerance &&
        localPoint.y >= local.y - tolerance &&
        localPoint.y <= local.y + local.h + tolerance
      )
    case 'shape': {
      const pad = Math.max(obj.strokeWidth / 2, 1) + tolerance
      const filled = Boolean(obj.fill) && obj.fillOpacity > 0.02
      if (obj.shape === 'line' || obj.shape === 'arrow' || obj.shape === 'double-arrow') {
        const { from, to } = lineEndpoints(obj)
        return pointSegmentDistance(localPoint, from, to) <= pad + 3
      }
      if (obj.shape === 'rect' || obj.shape === 'round-rect') {
        const inside =
          localPoint.x >= local.x - pad &&
          localPoint.x <= local.x + local.w + pad &&
          localPoint.y >= local.y - pad &&
          localPoint.y <= local.y + local.h + pad
        if (!inside) return false
        if (filled) return true
        const nearEdge =
          Math.abs(localPoint.x - local.x) <= pad ||
          Math.abs(localPoint.x - (local.x + local.w)) <= pad ||
          Math.abs(localPoint.y - local.y) <= pad ||
          Math.abs(localPoint.y - (local.y + local.h)) <= pad
        return nearEdge
      }
      if (obj.shape === 'circle' || obj.shape === 'ellipse') {
        const rx = Math.max(obj.w / 2, 0.5)
        const ry = Math.max(obj.h / 2, 0.5)
        const nx = (localPoint.x - (local.x + rx)) / rx
        const ny = (localPoint.y - (local.y + ry)) / ry
        const radial = Math.hypot(nx, ny)
        if (radial <= 1) return filled || radial > 1 - pad / Math.min(rx, ry)
        return Math.abs(radial - 1) * Math.min(rx, ry) <= pad
      }
      const polygon = polygonPoints(obj)
      if (pointInPolygon(localPoint, polygon)) return filled
      for (let index = 0; index < polygon.length; index += 1) {
        const a = polygon[index]!
        const b = polygon[(index + 1) % polygon.length]!
        if (pointSegmentDistance(localPoint, a, b) <= pad) return true
      }
      return false
    }
  }
}

function strokeHit(obj: StrokeObject, point: Point, tolerance: number): boolean {
  const threshold = obj.width / 2 + tolerance
  if (obj.points.length === 1) return distance(point, obj.points[0]!) <= threshold
  for (let index = 1; index < obj.points.length; index += 1) {
    const a = obj.points[index - 1]!
    const b = obj.points[index]!
    if (pointSegmentDistance(point, a, b) <= threshold) return true
  }
  return false
}

export interface ObjectHit {
  object: WhiteboardObject
  index: number
}

/** Topmost object under the point, matching paint order. */
export function pick(
  objects: WhiteboardObject[],
  point: Point,
  tolerance = 4,
): ObjectHit | null {
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index]!
    if (hitTest(object, point, tolerance)) return { object, index }
  }
  return null
}

export function objectsInPolygon(
  objects: WhiteboardObject[],
  polygon: Point[],
): WhiteboardObject[] {
  return objects.filter((object) => {
    if (object.type === 'stroke') {
      return object.points.some((point) => pointInPolygon(point, polygon))
    }
    const bounds = objectBounds(object)
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y },
      { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
      { x: bounds.x, y: bounds.y + bounds.h },
      rectCenter(bounds),
    ]
    return corners.some((point) => pointInPolygon(point, polygon))
  })
}

export function translateObject(
  obj: WhiteboardObject,
  dx: number,
  dy: number,
): WhiteboardObject {
  if (obj.type === 'stroke') {
    return {
      ...obj,
      points: obj.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
    }
  }
  return { ...obj, x: obj.x + dx, y: obj.y + dy }
}

const MIN_SIZE = 2

/** Anchored scaling used by selection handles and multi-object resize. */
export function scaleObject(
  obj: WhiteboardObject,
  anchor: Point,
  scaleX: number,
  scaleY: number,
): WhiteboardObject {
  const sx = Math.max(scaleX, 0.001)
  const sy = Math.max(scaleY, 0.001)
  const average = (sx + sy) / 2

  if (obj.type === 'stroke') {
    return {
      ...obj,
      points: obj.points.map((point) => ({
        ...point,
        x: anchor.x + (point.x - anchor.x) * sx,
        y: anchor.y + (point.y - anchor.y) * sy,
      })),
      width: Math.max(0.5, obj.width * average),
    }
  }

  const next: WhiteboardObject = {
    ...obj,
    x: anchor.x + (obj.x - anchor.x) * sx,
    y: anchor.y + (obj.y - anchor.y) * sy,
    w: Math.max(MIN_SIZE, obj.w * sx),
    h: Math.max(MIN_SIZE, obj.h * sy),
  }

  if (next.type === 'shape') {
    next.strokeWidth = Math.max(0.5, next.strokeWidth * average)
    next.radius = Math.max(0, next.radius * Math.min(sx, sy))
  }
  if (next.type === 'text') {
    next.fontSize = clamp(next.fontSize * Math.min(sx, sy), 8, 240)
  }
  return next
}

export function rotateObjectAround(
  obj: WhiteboardObject,
  center: Point,
  deltaDegrees: number,
): WhiteboardObject {
  if (obj.type === 'stroke') {
    return {
      ...obj,
      points: obj.points.map((point) => rotatePoint(point, center, deltaDegrees)),
    }
  }
  const objCenter = rectCenter(objectBounds(obj))
  const moved = rotatePoint(objCenter, center, deltaDegrees)
  const dx = moved.x - objCenter.x
  const dy = moved.y - objCenter.y
  return {
    ...obj,
    x: obj.x + dx,
    y: obj.y + dy,
    rotation: (obj.rotation + deltaDegrees) % 360,
  }
}

export function alignObjects(
  objects: WhiteboardObject[],
  edge: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
): WhiteboardObject[] {
  const bounds = selectionBounds(objects)
  if (!bounds) return objects
  return objects.map((object) => {
    const box = objectBounds(object)
    let dx = 0
    let dy = 0
    switch (edge) {
      case 'left':
        dx = bounds.x - box.x
        break
      case 'center':
        dx = bounds.x + bounds.w / 2 - (box.x + box.w / 2)
        break
      case 'right':
        dx = bounds.x + bounds.w - (box.x + box.w)
        break
      case 'top':
        dy = bounds.y - box.y
        break
      case 'middle':
        dy = bounds.y + bounds.h / 2 - (box.y + box.h / 2)
        break
      case 'bottom':
        dy = bounds.y + bounds.h - (box.y + box.h)
        break
    }
    return translateObject(object, dx, dy)
  })
}

/** Shift-constrained shapes: square boxes and 45° lines. */
export function constrainShape(
  start: Point,
  current: Point,
  kind: 'box' | 'line',
): Point {
  const dx = current.x - start.x
  const dy = current.y - start.y
  if (kind === 'line') {
    const angle = Math.atan2(dy, dx)
    const step = Math.PI / 4
    const snapped = Math.round(angle / step) * step
    const length = Math.hypot(dx, dy)
    return { x: start.x + Math.cos(snapped) * length, y: start.y + Math.sin(snapped) * length }
  }
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: start.x + Math.sign(dx || 1) * size,
    y: start.y + Math.sign(dy || 1) * size,
  }
}

/** Projects a point onto the ruler line when it is within `threshold` px. */
export function snapToRuler(
  point: Point,
  ruler: { angle: number; x: number; y: number },
  threshold: number,
): Point | null {
  const angle = (ruler.angle * Math.PI) / 180
  const dir = { x: Math.cos(angle), y: Math.sin(angle) }
  const origin = { x: ruler.x, y: ruler.y }
  const relative = { x: point.x - origin.x, y: point.y - origin.y }
  const along = relative.x * dir.x + relative.y * dir.y
  const projected = { x: origin.x + dir.x * along, y: origin.y + dir.y * along }
  return distance(point, projected) <= threshold ? projected : null
}

/** Scales a selection from one of its eight handles around the opposite edge. */
export function resizeSelection(
  objects: WhiteboardObject[],
  bounds: Rect,
  handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w',
  point: Point,
): WhiteboardObject[] {
  const right = bounds.x + bounds.w
  const bottom = bounds.y + bounds.h
  const anchorX = handle.includes('w') ? right : bounds.x
  const anchorY = handle.includes('n') ? bottom : bounds.y

  const horizontal = handle.includes('e') || handle.includes('w')
  const vertical = handle.includes('n') || handle.includes('s')
  const scaleX = horizontal && bounds.w > 1 ? Math.abs(point.x - anchorX) / bounds.w : 1
  const scaleY = vertical && bounds.h > 1 ? Math.abs(point.y - anchorY) / bounds.h : 1
  const sx = Math.max(scaleX, 0.01)
  const sy = Math.max(scaleY, 0.01)

  return objects.map((object) => scaleObject(object, { x: anchorX, y: anchorY }, sx, sy))
}

export function isLineLike(obj: ShapeObject): boolean {
  return obj.shape === 'line' || obj.shape === 'arrow' || obj.shape === 'double-arrow'
}
