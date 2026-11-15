import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  activeBoardOf,
  activePageOf,
  resetWhiteboardForTests,
  useWhiteboard,
} from '@/whiteboard/store'

const state = () => useWhiteboard.getState()
const page = () => activePageOf(useWhiteboard.getState())
const board = () => activeBoardOf(useWhiteboard.getState())

beforeEach(async () => {
  resetWhiteboardForTests()
  await state().init()
})

afterEach(() => {
  resetWhiteboardForTests()
})

describe('whiteboard store', () => {
  it('creates a starter board when no storage is available', async () => {
    expect(state().ready).toBe(true)
    expect(state().boards).toHaveLength(1)
    expect(page()?.objects).toEqual([])
  })

  it('adds strokes, undoes and redoes them', () => {
    state().beginHistory()
    const id = state().addStroke('pen', [
      { x: 10, y: 10 },
      { x: 40, y: 40 },
    ])
    expect(id).toBeTruthy()
    expect(page()?.objects).toHaveLength(1)
    expect(page()?.objects[0]).toMatchObject({ type: 'stroke', ink: 'pen', width: 3 })

    state().undo()
    expect(page()?.objects).toHaveLength(0)
    expect(state().future).toHaveLength(1)

    state().redo()
    expect(page()?.objects).toHaveLength(1)
  })

  it('appends points to the active stroke', () => {
    state().beginHistory()
    const id = state().addStroke('marker', [{ x: 0, y: 0 }])!
    state().appendStrokePoints(id, [{ x: 10, y: 10 }])
    const object = page()?.objects[0]
    expect(object?.type).toBe('stroke')
    expect(object?.type === 'stroke' ? object.points : []).toHaveLength(2)
  })

  it('keeps text edits in the document and removes empty objects', () => {
    const id = state().addText({ x: 20, y: 20 })!
    expect(state().editingId).toBe(id)
    state().updateObjectText(id, 'Hello')
    const object = page()?.objects.find((item) => item.id === id)
    expect(object?.type === 'text' ? object.text : null).toBe('Hello')

    state().setObjects(page()!.objects.filter((item) => item.id !== id))
    expect(page()?.objects).toHaveLength(0)
  })

  it('duplicates a selection with a shared group id', () => {
    state().beginHistory()
    const first = state().addStroke('pen', [{ x: 0, y: 0 }])!
    const second = state().addStroke('pen', [{ x: 20, y: 0 }])!
    state().setSelection([first, second])
    state().groupSelection()
    expect(page()?.objects.every((object) => Boolean(object.groupId))).toBe(true)

    state().duplicateSelection(12)
    expect(page()?.objects).toHaveLength(4)
    expect(state().selection).toHaveLength(2)
    const copies = page()!.objects.filter((object) => state().selection.includes(object.id))
    expect(copies[0]!.groupId).toBe(copies[1]!.groupId)
    expect(copies[0]!.groupId).not.toBe(page()!.objects[0]!.groupId)
  })

  it('splits a stroke when the eraser crosses it', () => {
    state().setEraser({ mode: 'stroke', size: 12 })
    state().beginHistory()
    const points = Array.from({ length: 21 }, (_, index) => ({ x: index * 10, y: 0 }))
    state().addStroke('pen', points)
    state().eraseAt({ x: 100, y: 0 }, 'stroke')
    const objects = page()?.objects ?? []
    expect(objects).toHaveLength(2)
    for (const object of objects) {
      expect(object.type).toBe('stroke')
      if (object.type === 'stroke') {
        expect(object.points.every((point) => Math.abs(point.x - 100) > 7)).toBe(true)
      }
    }
  })

  it('removes whole objects in object erase mode', () => {
    state().setEraser({ mode: 'object', size: 18 })
    state().beginHistory()
    state().addNote({ x: 40, y: 40 })
    const noteId = page()!.objects[0]!.id
    state().eraseAt({ x: 60, y: 60 }, 'object')
    expect(page()?.objects.some((object) => object.id === noteId)).toBe(false)
  })

  it('reorders, aligns and nudges selected objects', () => {
    state().beginHistory()
    const first = state().addText({ x: 0, y: 0 })!
    const second = state().addText({ x: 300, y: 120 })!
    state().setSelection([first, second])
    state().align('left')
    const texts = page()!.objects.filter((object) => object.type === 'text')
    expect(texts.every((object) => object.type === 'text' && object.x === 0)).toBe(true)

    state().nudgeSelection(10, 5)
    const moved = page()!.objects.find((object) => object.id === first)
    expect(moved?.type === 'text' ? moved.x : 0).toBe(10)

    state().arrange('back')
    expect(page()!.objects[0]!.id).toBe(first)
  })

  it('manages pages and keeps one page minimum', () => {
    const initial = page()!.id
    const added = state().addPage()!
    expect(page()?.id).toBe(added)
    expect(board()?.pages).toHaveLength(2)

    state().setActivePage(initial)
    state().deletePage(added)
    expect(board()?.pages).toHaveLength(1)
    state().deletePage(initial)
    expect(board()?.pages).toHaveLength(1)
  })

  it('applies page background and paper to the active page only', () => {
    state().setBackground('dots')
    state().setPaper('#141819')
    expect(page()?.background).toBe('dots')
    expect(page()?.paper).toBe('#141819')
  })

  it('duplicates a board with fresh page and object ids', () => {
    state().beginHistory()
    state().addStroke('pen', [{ x: 5, y: 5 }])
    const source = board()!
    const copyId = state().duplicateBoard(source.id, 'Copy')!
    const copy = state().boards.find((item) => item.id === copyId)!
    expect(copy.pages[0]!.id).not.toBe(source.pages[0]!.id)
    expect(copy.pages[0]!.objects[0]!.id).not.toBe(source.pages[0]!.objects[0]!.id)
    expect(copy.pages.some((item) => item.id === copy.activePageId)).toBe(true)
  })

  it('clamps zoom and keeps the pivot point fixed', () => {
    state().zoomTo(1000, { x: 200, y: 100 })
    expect(state().view.zoom).toBe(4)
    state().zoomTo(1, { x: 200, y: 100 })
    expect(state().view.zoom).toBe(1)
    expect(state().view.x).toBeCloseTo(0)
    expect(state().view.y).toBeCloseTo(0)
  })

  it('fits content inside the viewport', () => {
    state().beginHistory()
    state().addShape('rect', { x: 100, y: 100 }, { x: 500, y: 400 }, false)
    state().setViewport({ width: 1000, height: 600 })
    state().fitView({ width: 1000, height: 600 })
    const { zoom, x, y } = state().view
    expect(zoom).toBeGreaterThan(0.15)
    expect(zoom).toBeLessThanOrEqual(2)
    // The content centre lands on the viewport centre.
    expect(300 * zoom + x).toBeCloseTo(500)
    expect(250 * zoom + y).toBeCloseTo(300)
  })
})
