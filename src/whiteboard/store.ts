import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  HIGHLIGHTER_COLORS,
  INK_COLORS,
  defaultBrush,
  defaultEraser,
  defaultGesture,
  defaultLaser,
  defaultRuler,
  newBoard,
  newPage,
  uid,
} from './defaults'
import { alignObjects, resizeSelection, selectionBounds, translateObject } from './geometry'
import { loadBoards, saveBoard, deleteBoard as deleteBoardRecord } from './db'
import type {
  BackgroundStyle,
  Board,
  BrushSettings,
  EraserSettings,
  FontWeight,
  GestureSettings,
  HistoryEntry,
  ImageObject,
  LaserSettings,
  NoteObject,
  Page,
  PeaceAction,
  Point,
  RulerState,
  SaveState,
  ShapeObject,
  ShapeKind,
  StrokeObject,
  TextAlign,
  TextObject,
  ToolId,
  ViewTransform,
  WhiteboardObject,
} from './types'

export type InspectorTab = 'tool' | 'style' | 'object' | 'page'
export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type ArrangeMode = 'front' | 'forward' | 'backward' | 'back'
export type SelectionHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface StylePatch {
  color?: string
  strokeWidth?: number
  fill?: string | null
  fillOpacity?: number
  radius?: number
  fontSize?: number
  fontWeight?: FontWeight
  align?: TextAlign
  background?: string | null
  noteColor?: string
  opacity?: number
}

export interface WhiteboardState {
  ready: boolean
  boards: Board[]
  activeBoardId: string | null
  tool: ToolId
  brush: BrushSettings
  eraser: EraserSettings
  laser: LaserSettings
  gesture: GestureSettings
  ruler: RulerState
  view: ViewTransform
  viewport: { width: number; height: number }
  selection: string[]
  editingId: string | null
  presentation: boolean
  history: HistoryEntry[]
  future: HistoryEntry[]
  historyKey: string | null
  historyAt: number
  saveState: SaveState
  savedAt: number | null
  storageError: string | null

  init: () => Promise<void>
  createBoard: (name?: string) => string | null
  openBoard: (id: string) => void
  renameBoard: (id: string, name: string) => void
  duplicateBoard: (id: string, name?: string) => string | null
  deleteBoard: (id: string) => Promise<void>

  setTool: (tool: ToolId) => void
  setBrush: (patch: Partial<BrushSettings>) => void
  setEraser: (patch: Partial<EraserSettings>) => void
  setLaser: (patch: Partial<LaserSettings>) => void
  setGesture: (patch: Partial<GestureSettings>) => void
  setRuler: (patch: Partial<RulerState>) => void
  toggleRuler: () => void

  setView: (view: ViewTransform) => void
  setViewport: (size: { width: number; height: number }) => void
  zoomTo: (zoom: number, pivot?: Point) => void
  resetView: () => void
  fitView: (viewport: { width: number; height: number }) => void

  setSelection: (ids: string[]) => void
  selectAll: () => void
  setEditing: (id: string | null) => void
  setPresentation: (value: boolean) => void

  beginHistory: (key?: string) => void
  undo: () => void
  redo: () => void

  addObject: (object: WhiteboardObject) => void
  updateObject: (id: string, patch: Partial<WhiteboardObject>) => void
  updateObjectText: (id: string, text: string) => void
  setObjects: (objects: WhiteboardObject[]) => void
  deleteSelection: () => void
  duplicateSelection: (offset?: number) => void
  groupSelection: () => void
  ungroupSelection: () => void
  lockSelection: (locked: boolean) => void
  arrange: (mode: ArrangeMode) => void
  align: (edge: AlignEdge) => void
  nudgeSelection: (dx: number, dy: number, key?: string) => void
  resizeSelection: (handle: SelectionHandle, point: Point) => void
  updateSelectionStyle: (patch: StylePatch) => void

  addStroke: (kind: StrokeObject['ink'], points: Point[]) => string | null
  appendStrokePoints: (id: string, points: Point[]) => void
  addShape: (shape: ShapeKind, start: Point, current: Point, constrain: boolean) => string | null
  updateShape: (id: string, start: Point, current: Point, constrain: boolean) => void
  addText: (point: Point) => string | null
  addNote: (point: Point) => string | null
  addImage: (src: string, name: string, width: number, height: number, center?: Point) => string | null
  eraseAt: (point: Point, mode: EraserSettings['mode']) => void

  setBackground: (background: BackgroundStyle) => void
  setPaper: (paper: string) => void
  addPage: () => string | null
  duplicatePage: (id: string) => string | null
  deletePage: (id: string) => void
  renamePage: (id: string, name: string) => void
  setActivePage: (id: string) => void
  clearPage: () => void

  saveNow: () => Promise<void>
}

const HISTORY_LIMIT = 80
const COALESCE_MS = 650

export function activeBoardOf(
  state: Pick<WhiteboardState, 'boards' | 'activeBoardId'>,
): Board | null {
  return state.boards.find((board) => board.id === state.activeBoardId) ?? null
}

export function activePageOf(
  state: Pick<WhiteboardState, 'boards' | 'activeBoardId'>,
): Page | null {
  const board = activeBoardOf(state)
  if (!board) return null
  return board.pages.find((page) => page.id === board.activePageId) ?? board.pages[0] ?? null
}

export function selectedObjectsOf(state: Pick<WhiteboardState, 'boards' | 'activeBoardId' | 'selection'>): WhiteboardObject[] {
  const page = activePageOf(state)
  if (!page) return []
  const ids = new Set(state.selection)
  return page.objects.filter((object) => ids.has(object.id))
}

function cloneObjects(objects: WhiteboardObject[]): WhiteboardObject[] {
  return objects.map((object) =>
    object.type === 'stroke'
      ? { ...object, points: object.points.map((point) => ({ ...point })) }
      : { ...object },
  )
}

function mapPage(
  boards: Board[],
  boardId: string,
  pageId: string,
  update: (page: Page) => Page,
): Board[] {
  return boards.map((board) => {
    if (board.id !== boardId) return board
    return {
      ...board,
      updatedAt: Date.now(),
      pages: board.pages.map((page) => (page.id === pageId ? update(page) : page)),
    }
  })
}

function snapshotOf(boards: Board[], boardId: string, pageId: string): HistoryEntry | null {
  const board = boards.find((item) => item.id === boardId)
  const page = board?.pages.find((item) => item.id === pageId)
  if (!board || !page) return null
  return {
    boardId,
    pageId,
    objects: cloneObjects(page.objects),
    background: page.background,
    paper: page.paper,
  }
}

function applyHistoryEntry(boards: Board[], entry: HistoryEntry): Board[] {
  return boards.map((board) => {
    if (board.id !== entry.boardId) return board
    return {
      ...board,
      activePageId: entry.pageId,
      updatedAt: Date.now(),
      pages: board.pages.map((page) =>
        page.id === entry.pageId
          ? {
              ...page,
              objects: cloneObjects(entry.objects),
              background: entry.background,
              paper: entry.paper,
            }
          : page,
      ),
    }
  })
}

function constrainShapePoint(start: Point, current: Point, kind: 'box' | 'line'): Point {
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

function strokeWidthForObject(object: WhiteboardObject): number {
  switch (object.type) {
    case 'stroke':
      return object.width
    case 'shape':
      return object.strokeWidth
    default:
      return 0
  }
}

const LINE_SHAPES: ShapeKind[] = ['line', 'arrow', 'double-arrow']

let initPromise: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
const dirtyBoards = new Set<string>()

const initialHistory = {
  history: [] as HistoryEntry[],
  future: [] as HistoryEntry[],
  historyKey: null as string | null,
  historyAt: 0,
}

export const useWhiteboard = create<WhiteboardState>()(
  persist(
    (set, get) => {
      const queueSave = (boardId: string) => {
        dirtyBoards.add(boardId)
        if (get().saveState !== 'saving') set({ saveState: 'saving' })
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          saveTimer = null
          void get().saveNow()
        }, 700)
      }

      const flush = async (): Promise<void> => {
        if (saveTimer) {
          clearTimeout(saveTimer)
          saveTimer = null
        }
        const ids = [...dirtyBoards]
        dirtyBoards.clear()
        const boards = get().boards
        const targets = ids
          .map((id) => boards.find((board) => board.id === id))
          .filter((board): board is Board => Boolean(board))
        if (targets.length === 0) {
          if (dirtyBoards.size === 0) set({ saveState: 'saved' })
          return
        }
        set({ saveState: 'saving' })
        try {
          for (const board of targets) {
            await saveBoard({ ...board, updatedAt: Date.now() })
          }
          if (dirtyBoards.size === 0) set({ saveState: 'saved', savedAt: Date.now(), storageError: null })
        } catch (error) {
          set({
            saveState: 'error',
            storageError: error instanceof Error ? error.message : 'The board could not be saved.',
          })
        }
      }

      const commit = (key?: string) => {
        const state = get()
        const board = activeBoardOf(state)
        if (!board) return
        const pageId = board.activePageId
        if (key && key === state.historyKey && Date.now() - state.historyAt < COALESCE_MS) {
          return
        }
        const entry = snapshotOf(state.boards, board.id, pageId)
        if (!entry) return
        set({
          history: [...state.history, entry].slice(-HISTORY_LIMIT),
          future: [],
          historyKey: key ?? null,
          historyAt: Date.now(),
        })
      }

      const selectedIds = () => new Set(get().selection)

      return {
        ready: false,
        boards: [],
        activeBoardId: null,
        tool: 'pen',
        brush: { ...defaultBrush },
        eraser: { ...defaultEraser },
        laser: { ...defaultLaser },
        gesture: { ...defaultGesture },
        ruler: { ...defaultRuler },
        view: { x: 0, y: 0, zoom: 1 },
        viewport: { width: 0, height: 0 },
        selection: [],
        editingId: null,
        presentation: false,
        ...initialHistory,
        saveState: 'idle',
        savedAt: null,
        storageError: null,

        // ---------------------------------------------------------------- init
        init: async () => {
          if (get().ready) return
          if (initPromise) return initPromise
          initPromise = (async () => {
            try {
              const stored = await loadBoards()
              let boards = stored
              if (boards.length === 0) {
                const board = newBoard('')
                await saveBoard(board)
                boards = [board]
              }
              set({
                boards,
                activeBoardId: boards[0]!.id,
                ready: true,
                saveState: 'saved',
                savedAt: Date.now(),
                storageError: null,
              })
            } catch (error) {
              const board = newBoard('')
              set({
                boards: [board],
                activeBoardId: board.id,
                ready: true,
                saveState: 'error',
                storageError:
                  error instanceof Error
                    ? error.message
                    : 'Local storage is unavailable, so this board will not be saved.',
              })
            }
          })()
          return initPromise
        },

        // -------------------------------------------------------------- boards
        createBoard: (name = '') => {
          const board = newBoard(name.trim())
          set({
            boards: [board, ...get().boards],
            activeBoardId: board.id,
            selection: [],
            editingId: null,
            view: { x: 0, y: 0, zoom: 1 },
            history: [],
            future: [],
            historyKey: null,
            historyAt: 0,
          })
          dirtyBoards.add(board.id)
          queueSave(board.id)
          return board.id
        },

        openBoard: (id) => {
          const board = get().boards.find((item) => item.id === id)
          if (!board) return
          set({
            activeBoardId: id,
            selection: [],
            editingId: null,
            view: { x: 0, y: 0, zoom: 1 },
          })
        },

        renameBoard: (id, name) => {
          const clean = name.trim()
          set({
            boards: get().boards.map((board) =>
              board.id === id ? { ...board, name: clean, updatedAt: Date.now() } : board,
            ),
          })
          queueSave(id)
        },

        duplicateBoard: (id, name) => {
          const source = get().boards.find((board) => board.id === id)
          if (!source) return null
          const pageIds = new Map(source.pages.map((page) => [page.id, uid('pg')]))
          const groupIds = new Map<string, string>()
          const copy: Board = {
            ...source,
            id: uid('bd'),
            name: name?.trim() || source.name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            pages: source.pages.map((page) => ({
              ...page,
              id: pageIds.get(page.id)!,
              objects: cloneObjects(page.objects).map((object) => {
                let groupId: string | null = null
                if (object.groupId) {
                  groupId = groupIds.get(object.groupId) ?? uid('grp')
                  groupIds.set(object.groupId, groupId)
                }
                return { ...object, id: uid('o'), groupId }
              }),
            })),
          }
          copy.activePageId = pageIds.get(source.activePageId) ?? copy.pages[0]!.id
          set({
            boards: [copy, ...get().boards],
            activeBoardId: copy.id,
            selection: [],
            editingId: null,
            view: { x: 0, y: 0, zoom: 1 },
          })
          dirtyBoards.add(copy.id)
          queueSave(copy.id)
          return copy.id
        },

        deleteBoard: async (id) => {
          const state = get()
          const remaining = state.boards.filter((board) => board.id !== id)
          let boards = remaining
          let activeBoardId = state.activeBoardId
          if (activeBoardId === id) activeBoardId = remaining[0]?.id ?? null

          if (remaining.length === 0) {
            const board = newBoard('')
            boards = [board]
            activeBoardId = board.id
            dirtyBoards.add(board.id)
          }

          set({
            boards,
            activeBoardId,
            selection: [],
            editingId: null,
            history: state.history.filter((entry) => entry.boardId !== id),
            future: state.future.filter((entry) => entry.boardId !== id),
            view: { x: 0, y: 0, zoom: 1 },
          })
          dirtyBoards.delete(id)
          try {
            await deleteBoardRecord(id)
            await flush()
          } catch (error) {
            set({
              saveState: 'error',
              storageError:
                error instanceof Error ? error.message : 'The board could not be deleted.',
            })
          }
        },

        // ----------------------------------------------------------- tool state
        setTool: (tool) => {
          const state = get()
          let brush = state.brush
          if (tool === 'highlighter' && (INK_COLORS as readonly string[]).includes(brush.color)) {
            brush = { ...brush, color: HIGHLIGHTER_COLORS[0] }
          }
          if (tool === 'ruler') {
            set({ tool, brush, ruler: { ...state.ruler, visible: true } })
          } else {
            set({ tool, brush })
          }
          if (tool !== 'select' && tool !== 'lasso') set({ editingId: null })
        },

        setBrush: (patch) => set({ brush: { ...get().brush, ...patch } }),
        setEraser: (patch) => set({ eraser: { ...get().eraser, ...patch } }),
        setLaser: (patch) => set({ laser: { ...get().laser, ...patch } }),
        setGesture: (patch) => set({ gesture: { ...get().gesture, ...patch } }),
        setRuler: (patch) => set({ ruler: { ...get().ruler, ...patch } }),
        toggleRuler: () => {
          const state = get()
          const visible = !state.ruler.visible
          set({
            ruler: { ...state.ruler, visible },
            ...(visible ? {} : { tool: state.tool === 'ruler' ? 'pen' : state.tool }),
          })
        },

        // ----------------------------------------------------------------- view
        setView: (view) => set({ view: { ...view, zoom: Math.min(4, Math.max(0.12, view.zoom)) } }),

        setViewport: (size) => {
          const current = get().viewport
          if (current.width === size.width && current.height === size.height) return
          set({ viewport: { width: size.width, height: size.height } })
        },

        zoomTo: (zoom, pivot) => {
          const state = get()
          const next = Math.min(4, Math.max(0.12, zoom))
          const point =
            pivot ??
            (state.viewport.width > 0
              ? { x: state.viewport.width / 2, y: state.viewport.height / 2 }
              : { x: 0, y: 0 })
          const world = {
            x: (point.x - state.view.x) / state.view.zoom,
            y: (point.y - state.view.y) / state.view.zoom,
          }
          set({
            view: {
              zoom: next,
              x: point.x - world.x * next,
              y: point.y - world.y * next,
            },
          })
        },

        resetView: () => set({ view: { x: 0, y: 0, zoom: 1 } }),

        fitView: (viewport) => {
          const page = activePageOf(get())
          if (!page) return
          const bounds = selectionBounds(page.objects)
          if (!bounds) {
            set({ view: { x: viewport.width / 2, y: viewport.height / 2, zoom: 1 } })
            return
          }
          const margin = 72
          const zoom = Math.min(
            2,
            Math.max(
              0.15,
              Math.min(
                (viewport.width - margin * 2) / Math.max(bounds.w, 1),
                (viewport.height - margin * 2) / Math.max(bounds.h, 1),
              ),
            ),
          )
          set({
            view: {
              zoom,
              x: viewport.width / 2 - (bounds.x + bounds.w / 2) * zoom,
              y: viewport.height / 2 - (bounds.y + bounds.h / 2) * zoom,
            },
          })
        },

        // ------------------------------------------------------------ selection
        setSelection: (ids) => set({ selection: [...new Set(ids)] }),
        selectAll: () => {
          const page = activePageOf(get())
          set({ selection: page ? page.objects.map((object) => object.id) : [] })
        },
        setEditing: (id) => set({ editingId: id }),
        setPresentation: (value) => {
          set({ presentation: value, selection: value ? [] : get().selection, editingId: null })
        },

        // -------------------------------------------------------------- history
        beginHistory: (key) => commit(key),

        undo: () => {
          const state = get()
          const entry = state.history[state.history.length - 1]
          if (!entry) return
          const current = snapshotOf(state.boards, entry.boardId, entry.pageId)
          if (!current) {
            set({ history: state.history.slice(0, -1) })
            return
          }
          set({
            boards: applyHistoryEntry(state.boards, entry),
            activeBoardId: entry.boardId,
            history: state.history.slice(0, -1),
            future: [current, ...state.future].slice(0, HISTORY_LIMIT),
            selection: [],
            editingId: null,
            historyKey: null,
          })
          dirtyBoards.add(entry.boardId)
          queueSave(entry.boardId)
        },

        redo: () => {
          const state = get()
          const entry = state.future[0]
          if (!entry) return
          const current = snapshotOf(state.boards, entry.boardId, entry.pageId)
          if (!current) {
            set({ future: state.future.slice(1) })
            return
          }
          set({
            boards: applyHistoryEntry(state.boards, entry),
            activeBoardId: entry.boardId,
            history: [...state.history, current].slice(-HISTORY_LIMIT),
            future: state.future.slice(1),
            selection: [],
            editingId: null,
            historyKey: null,
          })
          dirtyBoards.add(entry.boardId)
          queueSave(entry.boardId)
        },

        // ------------------------------------------------------------- mutation
        addObject: (object) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: [...page.objects, object],
            })),
          })
          queueSave(board.id)
        },

        updateObject: (id, patch) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) =>
                object.id === id ? ({ ...object, ...patch } as WhiteboardObject) : object,
              ),
            })),
          })
          queueSave(board.id)
        },

        updateObjectText: (id, text) => {
          commit(`text:${id}`)
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) =>
                object.id === id && (object.type === 'text' || object.type === 'note')
                  ? { ...object, text }
                  : object,
              ),
            })),
          })
          queueSave(board.id)
        },

        setObjects: (objects) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects,
            })),
          })
          queueSave(board.id)
        },

        deleteSelection: () => {
          const state = get()
          const ids = selectedIds()
          if (ids.size === 0) return
          commit()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.filter((object) => !ids.has(object.id)),
            })),
            selection: [],
          })
          queueSave(board.id)
        },

        duplicateSelection: (offset = 18) => {
          const state = get()
          const ids = selectedIds()
          if (ids.size === 0) return
          const page = activePageOf(state)
          if (!page) return
          commit()
          const groupMap = new Map<string, string>()
          const copies = page.objects
            .filter((object) => ids.has(object.id))
            .map((object) => {
              const groupId = object.groupId
                ? groupMap.get(object.groupId) ?? uid('grp')
                : null
              if (object.groupId) groupMap.set(object.groupId, groupId!)
              const copy = translateObject(
                {
                  ...object,
                  id: uid('o'),
                  groupId,
                  locked: false,
                },
                offset,
                offset,
              )
              return copy
            })
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (current) => ({
              ...current,
              objects: [...current.objects, ...copies],
            })),
            selection: copies.map((object) => object.id),
          })
          queueSave(board.id)
        },

        groupSelection: () => {
          const state = get()
          const ids = selectedIds()
          if (ids.size < 2) return
          commit()
          const board = activeBoardOf(state)
          if (!board) return
          const groupId = uid('grp')
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) =>
                ids.has(object.id) ? { ...object, groupId } : object,
              ),
            })),
          })
          queueSave(board.id)
        },

        ungroupSelection: () => {
          const state = get()
          const ids = selectedIds()
          if (ids.size === 0) return
          commit()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) =>
                ids.has(object.id) ? { ...object, groupId: null } : object,
              ),
            })),
          })
          queueSave(board.id)
        },

        lockSelection: (locked) => {
          const state = get()
          const ids = selectedIds()
          if (ids.size === 0) return
          commit(`lock:${locked ? 'on' : 'off'}`)
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) =>
                ids.has(object.id) ? { ...object, locked } : object,
              ),
            })),
          })
          queueSave(board.id)
        },

        arrange: (mode) => {
          const state = get()
          const ids = selectedIds()
          if (ids.size === 0) return
          const page = activePageOf(state)
          if (!page) return
          commit()
          const objects = [...page.objects]
          const chosen = objects.filter((object) => ids.has(object.id))
          const rest = objects.filter((object) => !ids.has(object.id))
          let next: WhiteboardObject[]
          switch (mode) {
            case 'front':
              next = [...rest, ...chosen]
              break
            case 'back':
              next = [...chosen, ...rest]
              break
            case 'forward': {
              next = [...objects]
              for (let index = next.length - 2; index >= 0; index -= 1) {
                const current = next[index]!
                const after = next[index + 1]!
                if (ids.has(current.id) && !ids.has(after.id)) {
                  next[index] = after
                  next[index + 1] = current
                }
              }
              break
            }
            case 'backward': {
              next = [...objects]
              for (let index = 1; index < next.length; index += 1) {
                const current = next[index]!
                const before = next[index - 1]!
                if (ids.has(current.id) && !ids.has(before.id)) {
                  next[index] = before
                  next[index - 1] = current
                }
              }
              break
            }
          }
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (current) => ({
              ...current,
              objects: next,
            })),
          })
          queueSave(board.id)
        },

        align: (edge) => {
          const state = get()
          const selected = selectedObjectsOf(state)
          if (selected.length < 2) return
          commit()
          const aligned = alignObjects(selected, edge)
          const byId = new Map(aligned.map((object) => [object.id, object]))
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) => byId.get(object.id) ?? object),
            })),
          })
          queueSave(board.id)
        },

        nudgeSelection: (dx, dy, key = 'nudge') => {
          const state = get()
          const selected = selectedObjectsOf(state).filter((object) => !object.locked)
          if (selected.length === 0) return
          commit(key)
          const byId = new Map(
            selected.map((object) => [object.id, translateObject(object, dx, dy)]),
          )
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) => byId.get(object.id) ?? object),
            })),
          })
          queueSave(board.id)
        },

        resizeSelection: (handle, point) => {
          const state = get()
          const selected = selectedObjectsOf(state).filter((object) => !object.locked)
          if (selected.length === 0) return
          const bounds = selectionBounds(selected)
          if (!bounds) return
          const resized = resizeSelection(selected, bounds, handle, point)
          const byId = new Map(resized.map((object) => [object.id, object]))
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) => byId.get(object.id) ?? object),
            })),
          })
          queueSave(board.id)
        },

        updateSelectionStyle: (patch) => {
          const state = get()
          const ids = selectedIds()
          if (ids.size === 0) return
          commit(`style:${Object.keys(patch).sort().join(',')}`)
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) => {
                if (!ids.has(object.id)) return object
                switch (object.type) {
                  case 'stroke': {
                    const next: StrokeObject = {
                      ...object,
                      color: patch.color ?? object.color,
                      width: patch.strokeWidth ?? object.width,
                      opacity: patch.opacity ?? object.opacity,
                    }
                    return next
                  }
                  case 'shape': {
                    const next: ShapeObject = {
                      ...object,
                      stroke: patch.color ?? object.stroke,
                      strokeWidth: patch.strokeWidth ?? object.strokeWidth,
                      fill: patch.fill === undefined ? object.fill : patch.fill,
                      fillOpacity: patch.fillOpacity ?? object.fillOpacity,
                      radius: patch.radius ?? object.radius,
                      opacity: patch.opacity ?? object.opacity,
                    }
                    return next
                  }
                  case 'text': {
                    const next: TextObject = {
                      ...object,
                      color: patch.color ?? object.color,
                      fontSize: patch.fontSize ?? object.fontSize,
                      fontWeight: patch.fontWeight ?? object.fontWeight,
                      align: patch.align ?? object.align,
                      background: patch.background === undefined ? object.background : patch.background,
                      opacity: patch.opacity ?? object.opacity,
                    }
                    return next
                  }
                  case 'note': {
                    const next: NoteObject = {
                      ...object,
                      color: patch.noteColor ?? patch.color ?? object.color,
                      opacity: patch.opacity ?? object.opacity,
                    }
                    return next
                  }
                  case 'image': {
                    const next: ImageObject = {
                      ...object,
                      opacity: patch.opacity ?? object.opacity,
                    }
                    return next
                  }
                }
              }),
            })),
          })
          queueSave(board.id)
        },

        // --------------------------------------------------------------- objects
        addStroke: (kind, points) => {
          if (points.length === 0) return null
          const { brush } = get()
          const stroke: StrokeObject = {
            id: uid('o'),
            type: 'stroke',
            ink: kind,
            points: points.map((point) => ({ ...point })),
            color: brush.color,
            width: brush.width,
            opacity: kind === 'highlighter' ? Math.min(brush.opacity, 0.9) : brush.opacity,
            rotation: 0,
            locked: false,
            groupId: null,
          }
          get().addObject(stroke)
          return stroke.id
        },

        appendStrokePoints: (id, points) => {
          if (points.length === 0) return
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: page.objects.map((object) =>
                object.id === id && object.type === 'stroke'
                  ? { ...object, points: [...object.points, ...points.map((point) => ({ ...point }))] }
                  : object,
              ),
            })),
          })
          queueSave(board.id)
        },

        addShape: (shape, start, current, constrain) => {
          const { brush } = get()
          const end = constrain
            ? constrainShapePoint(start, current, LINE_SHAPES.includes(shape) ? 'line' : 'box')
            : current
          const object: ShapeObject = {
            id: uid('o'),
            type: 'shape',
            shape,
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            w: Math.abs(end.x - start.x),
            h: Math.abs(end.y - start.y),
            flipX: end.x < start.x,
            flipY: end.y < start.y,
            stroke: brush.color,
            fill: brush.fill,
            fillOpacity: brush.fillOpacity,
            strokeWidth: brush.width,
            radius: brush.radius,
            opacity: brush.opacity,
            rotation: 0,
            locked: false,
            groupId: null,
          }
          get().addObject(object)
          return object.id
        },

        updateShape: (id, start, current, constrain) => {
          const state = get()
          const page = activePageOf(state)
          const object = page?.objects.find((item) => item.id === id)
          if (!object || object.type !== 'shape') return
          const end = constrain
            ? constrainShapePoint(start, current, LINE_SHAPES.includes(object.shape) ? 'line' : 'box')
            : current
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (currentPage) => ({
              ...currentPage,
              objects: currentPage.objects.map((item) =>
                item.id === id && item.type === 'shape'
                  ? {
                      ...item,
                      x: Math.min(start.x, end.x),
                      y: Math.min(start.y, end.y),
                      w: Math.abs(end.x - start.x),
                      h: Math.abs(end.y - start.y),
                      flipX: end.x < start.x,
                      flipY: end.y < start.y,
                    }
                  : item,
              ),
            })),
          })
          queueSave(board.id)
        },

        addText: (point) => {
          const { brush } = get()
          const object: TextObject = {
            id: uid('o'),
            type: 'text',
            x: point.x,
            y: point.y,
            w: 240,
            h: Math.max(brush.fontSize * 1.5, 32),
            text: '',
            fontSize: brush.fontSize,
            fontWeight: brush.fontWeight,
            align: brush.align,
            color: brush.color,
            background: brush.textBackground,
            opacity: 1,
            rotation: 0,
            locked: false,
            groupId: null,
          }
          get().beginHistory()
          get().addObject(object)
          set({ editingId: object.id, selection: [object.id] })
          return object.id
        },

        addNote: (point) => {
          const { brush } = get()
          const object: NoteObject = {
            id: uid('o'),
            type: 'note',
            x: point.x,
            y: point.y,
            w: 184,
            h: 152,
            text: '',
            color: brush.noteColor,
            opacity: 1,
            rotation: 0,
            locked: false,
            groupId: null,
          }
          get().beginHistory()
          get().addObject(object)
          set({ editingId: object.id, selection: [object.id] })
          return object.id
        },

        addImage: (src, name, width, height, center) => {
          const state = get()
          const page = activePageOf(state)
          const view = state.view
          const max = 420
          const ratio = Math.min(max / Math.max(width, 1), max / Math.max(height, 1), 1)
          const w = Math.max(40, width * ratio)
          const h = Math.max(40, height * ratio)
          const anchorBounds = selectionBounds(page?.objects ?? [])
          const target = center
            ? { x: center.x, y: center.y }
            : anchorBounds
              ? { x: anchorBounds.x + anchorBounds.w / 2, y: anchorBounds.y + anchorBounds.h / 2 }
              : { x: (0 - view.x) / view.zoom + 120, y: (0 - view.y) / view.zoom + 120 }
          const object: ImageObject = {
            id: uid('o'),
            type: 'image',
            x: target.x - w / 2,
            y: target.y - h / 2,
            w,
            h,
            src,
            name,
            opacity: 1,
            rotation: 0,
            locked: false,
            groupId: null,
          }
          get().beginHistory()
          get().addObject(object)
          set({ selection: [object.id], tool: 'select' })
          return object.id
        },

        eraseAt: (point, mode) => {
          const state = get()
          const board = activeBoardOf(state)
          const page = activePageOf(state)
          if (!board || !page) return
          const radius = state.eraser.size / 2
          const hit = (object: WhiteboardObject): boolean => {
            if (object.type === 'stroke') {
              return object.points.some(
                (item) => Math.hypot(item.x - point.x, item.y - point.y) <= radius + object.width / 2,
              )
            }
            return false
          }
          let objects: WhiteboardObject[]
          if (mode === 'object') {
            objects = page.objects.filter((object) => {
              if (object.locked) return true
              if (object.type === 'stroke') return !hit(object)
              return !(
                point.x >= object.x - radius &&
                point.x <= object.x + object.w + radius &&
                point.y >= object.y - radius &&
                point.y <= object.y + object.h + radius
              )
            })
          } else {
            objects = []
            for (const object of page.objects) {
              if (object.type !== 'stroke' || object.locked || !hit(object)) {
                objects.push(object)
                continue
              }
              const runs: Point[][] = []
              let run: Point[] = []
              for (const item of object.points) {
                if (Math.hypot(item.x - point.x, item.y - point.y) <= radius + object.width / 2) {
                  if (run.length > 0) runs.push(run)
                  run = []
                } else {
                  run.push(item)
                }
              }
              if (run.length > 0) runs.push(run)
              for (const part of runs) {
                if (part.length === 0) continue
                objects.push({ ...object, id: uid('o'), points: part })
              }
            }
          }
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (currentPage) => ({
              ...currentPage,
              objects,
            })),
          })
          queueSave(board.id)
        },

        // --------------------------------------------------------------- page
        setBackground: (background) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          commit('page:background')
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              background,
            })),
          })
          queueSave(board.id)
        },

        setPaper: (paper) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          commit('page:paper')
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              paper,
            })),
          })
          queueSave(board.id)
        },

        addPage: () => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return null
          const index = board.pages.findIndex((page) => page.id === board.activePageId)
          const page = newPage('')
          page.background = board.pages[index]?.background ?? page.background
          page.paper = board.pages[index]?.paper ?? page.paper
          const pages = [...board.pages]
          pages.splice(index + 1, 0, page)
          set({
            boards: state.boards.map((item) =>
              item.id === board.id ? { ...item, pages, activePageId: page.id, updatedAt: Date.now() } : item,
            ),
            selection: [],
            editingId: null,
          })
          queueSave(board.id)
          return page.id
        },

        duplicatePage: (id) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return null
          const source = board.pages.find((page) => page.id === id)
          if (!source) return null
          const copy: Page = {
            ...source,
            id: uid('pg'),
            name: source.name,
            objects: cloneObjects(source.objects).map((object) => ({
              ...object,
              id: uid('o'),
              groupId: object.groupId ? uid('grp') : null,
            })),
          }
          const index = board.pages.findIndex((page) => page.id === id)
          const pages = [...board.pages]
          pages.splice(index + 1, 0, copy)
          set({
            boards: state.boards.map((item) =>
              item.id === board.id
                ? { ...item, pages, activePageId: copy.id, updatedAt: Date.now() }
                : item,
            ),
            selection: [],
            editingId: null,
          })
          queueSave(board.id)
          return copy.id
        },

        deletePage: (id) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board || board.pages.length < 2) return
          const index = board.pages.findIndex((page) => page.id === id)
          if (index < 0) return
          const pages = board.pages.filter((page) => page.id !== id)
          const activePageId =
            board.activePageId === id
              ? (pages[Math.min(index, pages.length - 1)]?.id ?? pages[0]!.id)
              : board.activePageId
          set({
            boards: state.boards.map((item) =>
              item.id === board.id ? { ...item, pages, activePageId, updatedAt: Date.now() } : item,
            ),
            selection: [],
            editingId: null,
          })
          queueSave(board.id)
        },

        renamePage: (id, name) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          set({
            boards: mapPage(state.boards, board.id, id, (page) => ({ ...page, name: name.trim() })),
          })
          queueSave(board.id)
        },

        setActivePage: (id) => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board || board.activePageId === id) return
          if (!board.pages.some((page) => page.id === id)) return
          set({
            boards: state.boards.map((item) =>
              item.id === board.id ? { ...item, activePageId: id, updatedAt: Date.now() } : item,
            ),
            selection: [],
            editingId: null,
          })
          queueSave(board.id)
        },

        clearPage: () => {
          const state = get()
          const board = activeBoardOf(state)
          if (!board) return
          commit()
          set({
            boards: mapPage(state.boards, board.id, board.activePageId, (page) => ({
              ...page,
              objects: [],
            })),
            selection: [],
            editingId: null,
          })
          queueSave(board.id)
        },

        // ---------------------------------------------------------------- saving
        saveNow: async () => {
          const board = activeBoardOf(get())
          if (board) dirtyBoards.add(board.id)
          await flush()
        },
      }
    },
    {
      name: 'gesturelink.whiteboard.v1',
      version: 1,
      partialize: (state) => ({
        tool: state.tool,
        brush: state.brush,
        eraser: state.eraser,
        laser: state.laser,
        gesture: state.gesture,
        ruler: state.ruler,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<WhiteboardState>
        return {
          ...current,
          tool: saved.tool ?? current.tool,
          brush: { ...current.brush, ...saved.brush },
          eraser: { ...current.eraser, ...saved.eraser },
          laser: { ...current.laser, ...saved.laser },
          gesture: { ...current.gesture, ...saved.gesture },
          ruler: { ...current.ruler, ...saved.ruler, x: 0, y: 0 },
        }
      },
    },
  ),
)

/** Used by tests to guarantee a clean document between cases. */
export function resetWhiteboardForTests(): void {
  dirtyBoards.clear()
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  initPromise = null
  useWhiteboard.setState({
    ready: false,
    boards: [],
    activeBoardId: null,
    tool: 'pen',
    brush: { ...defaultBrush },
    eraser: { ...defaultEraser },
    laser: { ...defaultLaser },
    gesture: { ...defaultGesture },
    ruler: { ...defaultRuler },
    view: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 0, height: 0 },
    selection: [],
    editingId: null,
    presentation: false,
    ...initialHistory,
    saveState: 'idle',
    savedAt: null,
    storageError: null,
  })
}

export { strokeWidthForObject }
export type { PeaceAction }
