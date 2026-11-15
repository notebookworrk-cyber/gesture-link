/** Structured whiteboard document model. Every object is serialisable so it can
 * be autosaved to IndexedDB and re-rendered exactly after a reload. */

export type ToolId =
  | 'select'
  | 'pan'
  | 'lasso'
  | 'pen'
  | 'pencil'
  | 'marker'
  | 'highlighter'
  | 'laser'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'double-arrow'
  | 'rect'
  | 'round-rect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'text'
  | 'note'
  | 'image'
  | 'ruler'

export type InkKind = 'pen' | 'pencil' | 'marker' | 'highlighter'

export type ShapeKind =
  | 'line'
  | 'arrow'
  | 'double-arrow'
  | 'rect'
  | 'round-rect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'

export type BackgroundStyle = 'blank' | 'grid' | 'dots' | 'graph'

export type TextAlign = 'left' | 'center' | 'right'

export type FontWeight = 400 | 500 | 600 | 700

export interface Point {
  x: number
  y: number
  /** Pointer pressure 0..1 when the device reports it. */
  p?: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface ObjectBase {
  id: string
  /** Degrees clockwise around the object's bounds centre. Strokes bake theirs. */
  rotation: number
  locked: boolean
  groupId: string | null
}

export interface StrokeObject extends ObjectBase {
  type: 'stroke'
  ink: InkKind
  points: Point[]
  color: string
  width: number
  opacity: number
}

export interface ShapeObject extends ObjectBase {
  type: 'shape'
  shape: ShapeKind
  x: number
  y: number
  w: number
  h: number
  /** Direction of line-like shapes inside their bounds. */
  flipX: boolean
  flipY: boolean
  stroke: string
  fill: string | null
  fillOpacity: number
  strokeWidth: number
  radius: number
  opacity: number
}

export interface TextObject extends ObjectBase {
  type: 'text'
  x: number
  y: number
  w: number
  h: number
  text: string
  fontSize: number
  fontWeight: FontWeight
  align: TextAlign
  color: string
  background: string | null
  opacity: number
}

export interface NoteObject extends ObjectBase {
  type: 'note'
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  opacity: number
}

export interface ImageObject extends ObjectBase {
  type: 'image'
  x: number
  y: number
  w: number
  h: number
  src: string
  name: string
  opacity: number
}

export type WhiteboardObject =
  | StrokeObject
  | ShapeObject
  | TextObject
  | NoteObject
  | ImageObject

export interface Page {
  id: string
  name: string
  background: BackgroundStyle
  /** Page paper colour; patterns and exports use it as the base. */
  paper: string
  objects: WhiteboardObject[]
}

export interface Board {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  pages: Page[]
  activePageId: string
}

export interface ViewTransform {
  x: number
  y: number
  zoom: number
}

export interface BrushSettings {
  color: string
  width: number
  opacity: number
  fill: string | null
  fillOpacity: number
  radius: number
  fontSize: number
  fontWeight: FontWeight
  align: TextAlign
  textBackground: string | null
  noteColor: string
}

export type PeaceAction = 'none' | 'undo' | 'next-page' | 'previous-page'

export interface GestureSettings {
  enabled: boolean
  peaceAction: PeaceAction
  fistEraser: boolean
  twoFingerPan: boolean
  /** Fraction of the camera frame kept as the active area, 0.5..1. */
  reach: number
  showCursor: boolean
}

export interface EraserSettings {
  mode: 'stroke' | 'object'
  size: number
}

export interface LaserSettings {
  /** Milliseconds a laser trail remains visible. */
  duration: number
}

export interface RulerState {
  visible: boolean
  /** Angle in degrees. */
  angle: number
  /** Screen offset of the ruler centre, in CSS pixels. */
  x: number
  y: number
}

export interface HistoryEntry {
  boardId: string
  pageId: string
  objects: WhiteboardObject[]
  background: BackgroundStyle
  paper: string
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface WhiteboardSnapshot {
  pageObjects: WhiteboardObject[]
  selection: string[]
}
