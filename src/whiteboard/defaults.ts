import type {
  Board,
  BrushSettings,
  EraserSettings,
  GestureSettings,
  LaserSettings,
  Page,
  RulerState,
  ShapeKind,
  ToolId,
} from './types'

export const INK_COLORS = [
  '#1b2124',
  '#3f6df0',
  '#e2483f',
  '#f08a24',
  '#1f9d63',
  '#8b5cf6',
  '#e05fa4',
  '#ffffff',
] as const

export const HIGHLIGHTER_COLORS = [
  '#ffe14d',
  '#7ce38b',
  '#ff9ec7',
  '#7cc8ff',
  '#ffb169',
] as const

export const NOTE_COLORS = [
  '#ffe6a3',
  '#ffc9dd',
  '#c7e7ff',
  '#cdf0c9',
  '#e3d4ff',
  '#ffd7bd',
] as const

export const PAPER_COLORS = ['#f7f7f4', '#ffffff', '#f2f5f1', '#141819', '#1d2326'] as const

export const defaultBrush: BrushSettings = {
  color: INK_COLORS[0],
  width: 3,
  opacity: 1,
  fill: null,
  fillOpacity: 0.16,
  radius: 14,
  fontSize: 22,
  fontWeight: 500,
  align: 'left',
  textBackground: null,
  noteColor: NOTE_COLORS[0],
}

export const defaultEraser: EraserSettings = {
  mode: 'stroke',
  size: 18,
}

export const defaultLaser: LaserSettings = {
  duration: 900,
}

export const defaultGesture: GestureSettings = {
  enabled: false,
  peaceAction: 'none',
  fistEraser: false,
  twoFingerPan: true,
  reach: 0.86,
  showCursor: true,
}

export const defaultRuler: RulerState = {
  visible: false,
  angle: 0,
  x: 0,
  y: 0,
}

/** Per-ink defaults; the inspector's width slider edits the active value. */
export const inkWidth: Record<string, number> = {
  pen: 3,
  pencil: 1.6,
  marker: 10,
  highlighter: 20,
}

export interface ToolMeta {
  id: ToolId
  group: 'navigate' | 'ink' | 'erase' | 'shapes' | 'insert' | 'assist'
  labelKey:
    | 'wb.toolSelect'
    | 'wb.toolPan'
    | 'wb.toolLasso'
    | 'wb.toolPen'
    | 'wb.toolPencil'
    | 'wb.toolMarker'
    | 'wb.toolHighlighter'
    | 'wb.toolLaser'
    | 'wb.toolEraser'
    | 'wb.toolLine'
    | 'wb.toolArrow'
    | 'wb.toolDoubleArrow'
    | 'wb.toolRect'
    | 'wb.toolRoundRect'
    | 'wb.toolCircle'
    | 'wb.toolEllipse'
    | 'wb.toolTriangle'
    | 'wb.toolPolygon'
    | 'wb.toolText'
    | 'wb.toolNote'
    | 'wb.toolImage'
    | 'wb.toolRuler'
  shortcut?: string
}

export const TOOLS: ToolMeta[] = [
  { id: 'select', group: 'navigate', labelKey: 'wb.toolSelect', shortcut: 'V' },
  { id: 'pan', group: 'navigate', labelKey: 'wb.toolPan', shortcut: 'H' },
  { id: 'lasso', group: 'navigate', labelKey: 'wb.toolLasso', shortcut: 'L' },
  { id: 'pen', group: 'ink', labelKey: 'wb.toolPen', shortcut: 'P' },
  { id: 'pencil', group: 'ink', labelKey: 'wb.toolPencil' },
  { id: 'marker', group: 'ink', labelKey: 'wb.toolMarker' },
  { id: 'highlighter', group: 'ink', labelKey: 'wb.toolHighlighter' },
  { id: 'laser', group: 'ink', labelKey: 'wb.toolLaser' },
  { id: 'eraser', group: 'erase', labelKey: 'wb.toolEraser', shortcut: 'E' },
  { id: 'line', group: 'shapes', labelKey: 'wb.toolLine' },
  { id: 'arrow', group: 'shapes', labelKey: 'wb.toolArrow' },
  { id: 'double-arrow', group: 'shapes', labelKey: 'wb.toolDoubleArrow' },
  { id: 'rect', group: 'shapes', labelKey: 'wb.toolRect' },
  { id: 'round-rect', group: 'shapes', labelKey: 'wb.toolRoundRect' },
  { id: 'circle', group: 'shapes', labelKey: 'wb.toolCircle' },
  { id: 'ellipse', group: 'shapes', labelKey: 'wb.toolEllipse' },
  { id: 'triangle', group: 'shapes', labelKey: 'wb.toolTriangle' },
  { id: 'polygon', group: 'shapes', labelKey: 'wb.toolPolygon' },
  { id: 'text', group: 'insert', labelKey: 'wb.toolText', shortcut: 'T' },
  { id: 'note', group: 'insert', labelKey: 'wb.toolNote', shortcut: 'N' },
  { id: 'image', group: 'insert', labelKey: 'wb.toolImage' },
  { id: 'ruler', group: 'assist', labelKey: 'wb.toolRuler' },
]

export const shapeFromTool: Partial<Record<ToolId, ShapeKind>> = {
  line: 'line',
  arrow: 'arrow',
  'double-arrow': 'double-arrow',
  rect: 'rect',
  'round-rect': 'round-rect',
  circle: 'circle',
  ellipse: 'ellipse',
  triangle: 'triangle',
  polygon: 'polygon',
}

export const isInkTool = (tool: ToolId): boolean =>
  tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'highlighter'

export const isShapeTool = (tool: ToolId): boolean => tool in shapeFromTool

export function uid(prefix = 'o'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}

export function newPage(name = ''): Page {
  return {
    id: uid('pg'),
    name,
    background: 'grid',
    paper: '#f7f7f4',
    objects: [],
  }
}

export function newBoard(name = ''): Board {
  const page = newPage()
  return {
    id: uid('bd'),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [page],
    activePageId: page.id,
  }
}
