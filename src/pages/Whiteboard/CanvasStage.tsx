import { useEffect, useRef, useState } from 'react'
import { Check, Hand, X } from 'lucide-react'
import { CameraPreview } from '@/components/vision/CameraPreview'
import { useI18n } from '@/localization/i18n'
import { useSettings } from '@/settings/settingsStore'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import { isInkTool, isShapeTool, shapeFromTool } from '@/whiteboard/defaults'
import {
  objectBounds,
  objectsInPolygon,
  pick,
  rectCenter,
  rectsIntersect,
  rotateObjectAround,
  scaleObject,
  selectionBounds,
  translateObject,
} from '@/whiteboard/geometry'
import {
  mapHandToStage,
  pickGestureHand,
  readIntent,
  smoothPoint,
} from '@/whiteboard/gesture'
import {
  drawOverlay,
  drawScene,
  ensureImage,
  handleScreenPoints,
  readThemeColors,
  type GestureCursor,
  type LaserPoint,
  type ThemeColors,
} from '@/whiteboard/render'
import {
  activePageOf,
  selectedObjectsOf,
  useWhiteboard,
  type SelectionHandle,
} from '@/whiteboard/store'
import type { InkKind, Point, Rect, ToolId, WhiteboardObject } from '@/whiteboard/types'
import styles from './whiteboard.module.css'

interface CanvasStageProps {
  onPickImage: () => void
  presentation: boolean
}

type Interaction =
  | { kind: 'pan'; startX: number; startY: number; view: { x: number; y: number; zoom: number } }
  | { kind: 'marquee'; start: Point; current: Point; additive: boolean }
  | { kind: 'lasso'; points: Point[]; additive: boolean }
  | { kind: 'move'; start: Point; originals: WhiteboardObject[]; begun: boolean }
  | {
      kind: 'resize'
      handle: SelectionHandle
      bounds: Rect
      originals: WhiteboardObject[]
      begun: boolean
    }
  | {
      kind: 'rotate'
      center: Point
      startAngle: number
      originals: WhiteboardObject[]
      begun: boolean
    }
  | { kind: 'stroke'; id: string; last: Point; count: number }
  | { kind: 'shape'; id: string; start: Point; constrain: boolean }
  | { kind: 'erase' }
  | { kind: 'laser' }
  | { kind: 'ruler-move'; dx: number; dy: number }
  | { kind: 'ruler-rotate' }
  | { kind: 'insert'; point: Point; tool: InsertTool }

// Text, notes and the image picker are click tools: the object is created on
// pointer-up so the press that started it cannot take focus from the inline
// editor and blur a still-empty text box out of existence.
type InsertTool = 'text' | 'note' | 'image'

// Tools that create something while the canvas is pressed.
const DRAW_TOOLS: ToolId[] = [
  'pen',
  'pencil',
  'marker',
  'highlighter',
  'laser',
  'eraser',
  'line',
  'arrow',
  'double-arrow',
  'rect',
  'round-rect',
  'circle',
  'ellipse',
  'triangle',
  'polygon',
]

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function CanvasStage({ onPickImage, presentation }: CanvasStageProps) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const themeRef = useRef<ThemeColors>(readThemeColors())
  const interactionRef = useRef<Interaction | null>(null)
  const spaceRef = useRef(false)
  const laserRef = useRef<LaserPoint[]>([])
  const laserRafRef = useRef(0)
  const gestureRef = useRef<GestureCursor | null>(null)
  const gesturePointRef = useRef<{ x: number; y: number } | null>(null)
  const gesturePanRef = useRef<{ x: number; y: number } | null>(null)
  const gestureEraseRef = useRef<Point | null>(null)
  const fistHistoryRef = useRef(false)
  const requestedImagesRef = useRef(new Set<string>())
  const labelsRef = useRef({ locked: '' })
  const onPickImageRef = useRef(onPickImage)
  const presentationRef = useRef(presentation)
  const fitOnResizeRef = useRef(false)
  const editorViewRef = useRef<{ x: number; y: number; zoom: number } | null>(null)
  const drawRafRef = useRef(0)
  const overlayRafRef = useRef(0)
  const [dockOpen, setDockOpen] = useState(true)
  const [spaceDown, setSpaceDown] = useState(false)

  const tool = useWhiteboard((state) => state.tool)
  const gesture = useWhiteboard((state) => state.gesture)
  const view = useWhiteboard((state) => state.view)
  const editingId = useWhiteboard((state) => state.editingId)
  const editingObject = useWhiteboard((state) => {
    if (!state.editingId) return null
    const page = activePageOf(state)
    return page?.objects.find((object) => object.id === state.editingId) ?? null
  })
  const camera = useVisionStatus((state) => state.camera)
  const tracking = useVisionStatus((state) => state.tracking)
  const hands = useVisionStatus((state) => state.hands)
  const mirror = useSettings((state) => state.camera.mirror)
  const mirrorRef = useRef(mirror)

  labelsRef.current = { locked: t('wb.locked') }
  onPickImageRef.current = onPickImage
  presentationRef.current = presentation
  mirrorRef.current = mirror

  // ---------------------------------------------------------------- drawing
  const renderScene = () => {
    const canvas = sceneRef.current
    const context = canvas?.getContext('2d')
    const { width, height } = sizeRef.current
    if (!canvas || !context || width === 0 || height === 0) return
    const state = useWhiteboard.getState()
    const page = activePageOf(state)
    if (!page) return
    const dpr = canvas.width / Math.max(width, 1)
    drawScene(context, {
      page,
      view: state.view,
      width,
      height,
      dpr,
      theme: themeRef.current,
    })
    for (const object of page.objects) {
      if (object.type === 'image' && !requestedImagesRef.current.has(object.src)) {
        requestedImagesRef.current.add(object.src)
        void ensureImage(object.src).then(() => scheduleDraw())
      }
    }
  }

  const renderOverlay = () => {
    const canvas = overlayRef.current
    const context = canvas?.getContext('2d')
    const { width, height } = sizeRef.current
    if (!canvas || !context || width === 0 || height === 0) return
    const state = useWhiteboard.getState()
    const page = activePageOf(state)
    if (!page) return
    const dpr = canvas.width / Math.max(width, 1)
    const now = performance.now()
    const duration = state.laser.duration
    laserRef.current = laserRef.current.filter(
      (point, index) => now - point.at <= duration || index === laserRef.current.length - 1,
    )
    const activeInteraction = interactionRef.current
    drawOverlay(context, {
      view: state.view,
      width,
      height,
      dpr,
      theme: themeRef.current,
      selection: presentationRef.current ? [] : selectedObjectsOf(state),
      showHandles: !presentationRef.current,
      lasso: activeInteraction?.kind === 'lasso' ? activeInteraction.points : null,
      marquee:
        activeInteraction?.kind === 'marquee'
          ? normalizeRect(activeInteraction.start, activeInteraction.current)
          : null,
      ruler: state.ruler,
      laser: laserRef.current,
      laserSettings: state.laser,
      now,
      gesture: state.gesture.showCursor ? gestureRef.current : null,
      labels: labelsRef.current,
    })
  }

  const scheduleDraw = () => {
    if (drawRafRef.current) return
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = 0
      renderScene()
      renderOverlay()
    })
  }

  const scheduleOverlay = () => {
    if (overlayRafRef.current) return
    overlayRafRef.current = requestAnimationFrame(() => {
      overlayRafRef.current = 0
      renderOverlay()
    })
  }

  const runLaserAnimation = () => {
    if (laserRafRef.current) return
    const step = () => {
      laserRafRef.current = 0
      const duration = useWhiteboard.getState().laser.duration
      const now = performance.now()
      laserRef.current = laserRef.current.filter((point) => now - point.at <= duration)
      renderOverlay()
      if (laserRef.current.length > 0) {
        laserRafRef.current = requestAnimationFrame(step)
      }
    }
    laserRafRef.current = requestAnimationFrame(step)
  }

  // ------------------------------------------------------------- coordinates
  const stagePoint = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const toWorld = (screen: Point): Point => {
    const current = useWhiteboard.getState().view
    return {
      x: (screen.x - current.x) / current.zoom,
      y: (screen.y - current.y) / current.zoom,
    }
  }

  const screenToWorld = (clientX: number, clientY: number): Point =>
    toWorld(stagePoint(clientX, clientY))

  const pointerPressure = (event: PointerEvent): number | undefined =>
    event.pointerType === 'pen' ? Math.max(0.05, event.pressure) : undefined

  // ------------------------------------------------------------ draw session
  const beginDrawAt = (
    point: Point,
    source: 'pointer' | 'gesture',
    constrain: boolean,
    pressure?: number,
  ) => {
    const state = useWhiteboard.getState()
    const activeTool = state.tool
    if (isInkTool(activeTool)) {
      state.beginHistory()
      const id = state.addStroke(activeTool as InkKind, [{ ...point, p: pressure }])
      if (id) {
        interactionRef.current = { kind: 'stroke', id, last: point, count: 1 }
      }
      return
    }
    if (isShapeTool(activeTool)) {
      const shape = shapeFromTool[activeTool]
      if (!shape) return
      state.beginHistory()
      const id = state.addShape(shape, point, point, constrain || activeTool === 'circle')
      if (id) {
        interactionRef.current = {
          kind: 'shape',
          id,
          start: point,
          constrain: constrain || activeTool === 'circle',
        }
      }
      return
    }
    if (activeTool === 'eraser') {
      state.beginHistory('erase')
      state.eraseAt(point, state.eraser.mode)
      interactionRef.current = { kind: 'erase' }
      return
    }
    if (activeTool === 'laser') {
      laserRef.current = [{ ...point, at: performance.now() }]
      interactionRef.current = { kind: 'laser' }
      runLaserAnimation()
      return
    }
    if (source === 'gesture') return
  }

  const insertAt = (point: Point, tool: InsertTool) => {
    const state = useWhiteboard.getState()
    if (tool === 'text') state.addText(point)
    else if (tool === 'note') state.addNote(point)
    else onPickImageRef.current()
  }

  const continueDrawAt = (point: Point, pressure?: number) => {
    const interaction = interactionRef.current
    if (!interaction) return
    const state = useWhiteboard.getState()
    const zoom = state.view.zoom
    if (interaction.kind === 'stroke') {
      const distance = Math.hypot(point.x - interaction.last.x, point.y - interaction.last.y)
      if (distance < 0.7 / zoom) return
      if (interaction.count >= 6000) return
      state.appendStrokePoints(interaction.id, [{ ...point, p: pressure }])
      interaction.last = point
      interaction.count += 1
      return
    }
    if (interaction.kind === 'shape') {
      state.updateShape(interaction.id, interaction.start, point, interaction.constrain)
      return
    }
    if (interaction.kind === 'erase') {
      const last = gestureEraseRef.current
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < state.eraser.size / 5) {
        return
      }
      gestureEraseRef.current = point
      state.eraseAt(point, state.eraser.mode)
      return
    }
    if (interaction.kind === 'laser') {
      const last = laserRef.current[laserRef.current.length - 1]
      if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1 / zoom) return
      laserRef.current = [...laserRef.current.slice(-500), { ...point, at: performance.now() }]
      runLaserAnimation()
    }
  }

  const endDraw = () => {
    const interaction = interactionRef.current
    if (interaction?.kind === 'shape') {
      const state = useWhiteboard.getState()
      const page = activePageOf(state)
      const object = page?.objects.find((item) => item.id === interaction.id)
      if (object && object.type === 'shape' && object.w < 2 && object.h < 2) {
        state.setObjects((page?.objects ?? []).filter((item) => item.id !== object.id))
      }
    }
    interactionRef.current = null
    gestureEraseRef.current = null
    scheduleDraw()
  }

  const applyObjects = (originals: WhiteboardObject[]) => {
    const state = useWhiteboard.getState()
    const page = activePageOf(state)
    if (!page) return
    const byId = new Map(originals.map((object) => [object.id, object]))
    state.setObjects(page.objects.map((object) => byId.get(object.id) ?? object))
  }

  // ---------------------------------------------------------------- pointer
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    const container = containerRef.current
    if (!container) return
    if (isTypingTarget(event.target)) return
    // Overlay controls (camera dock, HUD, inline editor) live inside the stage.
    // Capturing the pointer for a press that starts on one of them would make
    // the browser retarget the follow-up click and leave the control dead.
    if (!(event.target instanceof HTMLCanvasElement)) return
    const screen = stagePoint(event.clientX, event.clientY)
    const world = toWorld(screen)
    const state = useWhiteboard.getState()
    const interactionPan =
      event.button === 1 || spaceRef.current || state.tool === 'pan' || presentationRef.current

    container.setPointerCapture(event.pointerId)
    gestureEraseRef.current = null

    if (interactionPan) {
      interactionRef.current = {
        kind: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        view: state.view,
      }
      return
    }

    if (state.tool === 'ruler' && state.ruler.visible) {
      const length = Math.max(sizeRef.current.width, sizeRef.current.height) * 0.86
      const angle = (state.ruler.angle * Math.PI) / 180
      const knob = {
        x: state.ruler.x + Math.cos(angle) * (length / 2),
        y: state.ruler.y + Math.sin(angle) * (length / 2),
      }
      if (Math.hypot(screen.x - knob.x, screen.y - knob.y) <= 18) {
        interactionRef.current = { kind: 'ruler-rotate' }
      } else {
        interactionRef.current = {
          kind: 'ruler-move',
          dx: state.ruler.x - screen.x,
          dy: state.ruler.y - screen.y,
        }
      }
      return
    }

    if (state.tool === 'lasso') {
      interactionRef.current = {
        kind: 'lasso',
        points: [world],
        additive: event.shiftKey,
      }
      scheduleOverlay()
      return
    }

    if (state.tool === 'select') {
      const selected = selectedObjectsOf(state)
      const bounds = selectionBounds(selected)
      if (bounds && !selected.every((object) => object.locked)) {
        for (const handle of handleScreenPoints(bounds, state.view)) {
          if (Math.hypot(screen.x - handle.x, screen.y - handle.y) <= 8) {
            interactionRef.current = {
              kind: 'resize',
              handle: handle.handle,
              bounds,
              originals: selected.filter((object) => !object.locked),
              begun: false,
            }
            return
          }
        }
        const rotateHandle = {
          x: (bounds.x + bounds.w / 2) * state.view.zoom + state.view.x,
          y: bounds.y * state.view.zoom + state.view.y - 26,
        }
        if (Math.hypot(screen.x - rotateHandle.x, screen.y - rotateHandle.y) <= 9) {
          interactionRef.current = {
            kind: 'rotate',
            center: rectCenter(bounds),
            startAngle: Math.atan2(world.y - rectCenter(bounds).y, world.x - rectCenter(bounds).x) * 180 / Math.PI,
            originals: selected.filter((object) => !object.locked),
            begun: false,
          }
          return
        }
      }

      const page = activePageOf(state)
      const hit = page ? pick(page.objects, world, 5 / state.view.zoom) : null
      if (hit && page) {
        let ids = [hit.object.id]
        if (hit.object.groupId) {
          ids = page.objects
            .filter((object) => object.groupId === hit.object.groupId)
            .map((object) => object.id)
        }
        if (event.shiftKey) {
          const next = new Set(state.selection)
          if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id))
          else ids.forEach((id) => next.add(id))
          state.setSelection([...next])
        } else if (!state.selection.includes(hit.object.id)) {
          state.setSelection(ids)
        } else {
          const merged = new Set([...state.selection, ...ids])
          if (merged.size !== state.selection.length) state.setSelection([...merged])
        }
        if (
          event.detail >= 2 &&
          !hit.object.locked &&
          (hit.object.type === 'text' || hit.object.type === 'note')
        ) {
          state.setEditing(hit.object.id)
          return
        }
        const originals = selectedObjectsOf(useWhiteboard.getState()).filter(
          (object) => !object.locked,
        )
        interactionRef.current = { kind: 'move', start: world, originals, begun: false }
        return
      }
      if (!event.shiftKey) state.setSelection([])
      interactionRef.current = {
        kind: 'marquee',
        start: world,
        current: world,
        additive: event.shiftKey,
      }
      scheduleOverlay()
      return
    }

    if (state.tool === 'text' || state.tool === 'note' || state.tool === 'image') {
      interactionRef.current = { kind: 'insert', point: world, tool: state.tool }
      return
    }

    if (DRAW_TOOLS.includes(state.tool)) {
      beginDrawAt(world, 'pointer', event.shiftKey, pointerPressure(event.nativeEvent))
    }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    if (!interaction) return
    const screen = stagePoint(event.clientX, event.clientY)
    const world = toWorld(screen)
    const state = useWhiteboard.getState()

    switch (interaction.kind) {
      case 'pan': {
        state.setView({
          x: interaction.view.x + (event.clientX - interaction.startX),
          y: interaction.view.y + (event.clientY - interaction.startY),
          zoom: interaction.view.zoom,
        })
        break
      }
      case 'marquee': {
        interaction.current = world
        scheduleOverlay()
        break
      }
      case 'lasso': {
        const last = interaction.points[interaction.points.length - 1]
        if (!last || Math.hypot(world.x - last.x, world.y - last.y) > 2 / state.view.zoom) {
          interaction.points.push(world)
          scheduleOverlay()
        }
        break
      }
      case 'move': {
        if (interaction.originals.length === 0) break
        const dx = world.x - interaction.start.x
        const dy = world.y - interaction.start.y
        if (!interaction.begun) {
          if (Math.hypot(dx, dy) < 1 / state.view.zoom) break
          state.beginHistory('move')
          interaction.begun = true
        }
        applyObjects(
          interaction.originals.map((object) => translateObject(object, dx, dy)),
        )
        break
      }
      case 'resize': {
        if (!interaction.begun) {
          state.beginHistory('resize')
          interaction.begun = true
        }
        const bounds = interaction.bounds
        const right = bounds.x + bounds.w
        const bottom = bounds.y + bounds.h
        const anchorX = interaction.handle.includes('w') ? right : bounds.x
        const anchorY = interaction.handle.includes('n') ? bottom : bounds.y
        const horizontal = interaction.handle.includes('e') || interaction.handle.includes('w')
        const vertical = interaction.handle.includes('n') || interaction.handle.includes('s')
        let scaleX = horizontal && bounds.w > 1 ? Math.abs(world.x - anchorX) / bounds.w : 1
        let scaleY = vertical && bounds.h > 1 ? Math.abs(world.y - anchorY) / bounds.h : 1
        if (event.shiftKey && horizontal && vertical) {
          const uniform = Math.max(scaleX, scaleY)
          scaleX = uniform
          scaleY = uniform
        }
        scaleX = Math.max(scaleX, 0.02)
        scaleY = Math.max(scaleY, 0.02)
        applyObjects(
          interaction.originals.map((object) =>
            scaleObject(object, { x: anchorX, y: anchorY }, scaleX, scaleY),
          ),
        )
        break
      }
      case 'rotate': {
        if (!interaction.begun) {
          state.beginHistory('rotate')
          interaction.begun = true
        }
        const angle =
          (Math.atan2(world.y - interaction.center.y, world.x - interaction.center.x) * 180) /
          Math.PI
        const delta = angle - interaction.startAngle
        const snapped = event.shiftKey ? Math.round(delta / 15) * 15 : delta
        applyObjects(
          interaction.originals.map((object) =>
            rotateObjectAround(object, interaction.center, snapped),
          ),
        )
        break
      }
      case 'stroke':
      case 'erase':
      case 'laser':
      case 'shape': {
        continueDrawAt(world, pointerPressure(event.nativeEvent))
        break
      }
      case 'ruler-move': {
        state.setRuler({ x: screen.x + interaction.dx, y: screen.y + interaction.dy })
        break
      }
      case 'ruler-rotate': {
        const angle =
          (Math.atan2(screen.y - state.ruler.y, screen.x - state.ruler.x) * 180) / Math.PI
        state.setRuler({ angle: Math.round(angle) })
        break
      }
    }
  }

  const finishInteraction = () => {
    const interaction = interactionRef.current
    if (!interaction) return
    const state = useWhiteboard.getState()
    if (interaction.kind === 'stroke' || interaction.kind === 'shape' || interaction.kind === 'erase') {
      endDraw()
      return
    }
    if (interaction.kind === 'laser') {
      interactionRef.current = null
      runLaserAnimation()
      return
    }
    if (interaction.kind === 'lasso') {
      const page = activePageOf(state)
      if (page && interaction.points.length > 2) {
        const ids = objectsInPolygon(page.objects, interaction.points).map((object) => object.id)
        state.setSelection(
          interaction.additive ? [...new Set([...state.selection, ...ids])] : ids,
        )
      }
      interactionRef.current = null
      scheduleOverlay()
      return
    }
    if (interaction.kind === 'insert') {
      interactionRef.current = null
      insertAt(interaction.point, interaction.tool)
      return
    }
    if (interaction.kind === 'marquee') {
      const page = activePageOf(state)
      const bounds = normalizeRect(interaction.start, interaction.current)
      if (page && bounds.w > 1 && bounds.h > 1) {
        const ids = page.objects
          .filter((object) => rectsIntersect(objectBounds(object), bounds))
          .map((object) => object.id)
        state.setSelection(
          interaction.additive ? [...new Set([...state.selection, ...ids])] : ids,
        )
      }
      interactionRef.current = null
      scheduleOverlay()
      return
    }
    interactionRef.current = null
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (container?.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId)
    // A cancelled press must not drop a text box or open the file picker.
    if (event.type === 'pointercancel' && interactionRef.current?.kind === 'insert') {
      interactionRef.current = null
      return
    }
    finishInteraction()
  }

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const state = useWhiteboard.getState()
    if (state.tool !== 'select') return
    const page = activePageOf(state)
    if (!page) return
    const hit = pick(page.objects, screenToWorld(event.clientX, event.clientY), 5 / state.view.zoom)
    if (hit && !hit.object.locked && (hit.object.type === 'text' || hit.object.type === 'note')) {
      state.setEditing(hit.object.id)
    }
  }

  // ---------------------------------------------------------------- gestures
  useEffect(() => {
    const engine = getVisionEngine()
    const unsubscribe = engine.subscribeFrames((frame) => {
      const state = useWhiteboard.getState()
      if (!state.gesture.enabled) {
        if (gestureRef.current) {
          gestureRef.current = null
          scheduleOverlay()
        }
        return
      }
      if (presentationRef.current) {
        if (gestureRef.current) {
          gestureRef.current = null
          scheduleOverlay()
        }
        return
      }
      const trackingSettings = useSettings.getState().tracking
      const hand = pickGestureHand(frame.hands, trackingSettings.dominantHand)
      if (!hand) {
        if (interactionRef.current && ['stroke', 'shape', 'erase', 'laser'].includes(interactionRef.current.kind)) {
          endDraw()
        }
        gesturePointRef.current = null
        gesturePanRef.current = null
        gestureRef.current = null
        fistHistoryRef.current = false
        scheduleOverlay()
        return
      }
      const raw = mapHandToStage(
        hand,
        state.gesture.reach,
        mirrorRef.current,
        sizeRef.current,
      )
      const smoothed = smoothPoint(gesturePointRef.current, raw, 0.55)
      gesturePointRef.current = smoothed
      const world = toWorld(smoothed)
      const intent = readIntent(hand, state.gesture)
      gestureRef.current = {
        x: smoothed.x,
        y: smoothed.y,
        pinching: intent.pinching,
        paused: intent.paused,
        fist: intent.fist,
      }

      if (intent.peaceFired) {
        const board = state.boards.find((item) => item.id === state.activeBoardId)
        if (state.gesture.peaceAction === 'undo') state.undo()
        if (board && state.gesture.peaceAction === 'next-page') {
          const index = board.pages.findIndex((page) => page.id === board.activePageId)
          const next = board.pages[index + 1]
          if (next) state.setActivePage(next.id)
        }
        if (board && state.gesture.peaceAction === 'previous-page') {
          const index = board.pages.findIndex((page) => page.id === board.activePageId)
          const previous = board.pages[index - 1]
          if (previous) state.setActivePage(previous.id)
        }
      }

      if (intent.fist && state.gesture.fistEraser) {
        const last = gestureEraseRef.current
        gestureEraseRef.current = world
        if (!last || Math.hypot(world.x - last.x, world.y - last.y) > state.eraser.size / 3) {
          if (!fistHistoryRef.current) {
            state.beginHistory('gesture-erase')
            fistHistoryRef.current = true
          }
          state.eraseAt(world, 'object')
        }
        if (interactionRef.current && ['stroke', 'shape', 'laser'].includes(interactionRef.current.kind)) {
          endDraw()
        }
        scheduleOverlay()
        return
      }
      fistHistoryRef.current = false

      if (intent.pan) {
        if (interactionRef.current && ['stroke', 'shape', 'laser'].includes(interactionRef.current.kind)) {
          endDraw()
        }
        const previous = gesturePanRef.current
        if (previous) {
          const current = useWhiteboard.getState().view
          state.setView({
            x: current.x + (smoothed.x - previous.x),
            y: current.y + (smoothed.y - previous.y),
            zoom: current.zoom,
          })
        }
        gesturePanRef.current = smoothed
        scheduleOverlay()
        return
      }
      gesturePanRef.current = null

      if (intent.pinching) {
        const active = interactionRef.current
        if (!active) {
          if (DRAW_TOOLS.includes(state.tool)) {
            beginDrawAt(world, 'gesture', false)
            if (interactionRef.current?.kind === 'laser') {
              laserRef.current = [{ ...world, at: performance.now() }]
            }
          }
        } else {
          continueDrawAt(world)
        }
      } else if (
        interactionRef.current &&
        ['stroke', 'shape', 'erase', 'laser'].includes(interactionRef.current.kind)
      ) {
        endDraw()
      }
      scheduleOverlay()
    })
    return () => {
      unsubscribe()
      if (laserRafRef.current) cancelAnimationFrame(laserRafRef.current)
    }
  }, [])

  // -------------------------------------------------------------- lifecycle
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const resize = () => {
      const rect = container.getBoundingClientRect()
      sizeRef.current = { width: rect.width, height: rect.height }
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      for (const canvas of [sceneRef.current, overlayRef.current]) {
        if (!canvas) continue
        const width = Math.max(1, Math.round(rect.width * dpr))
        const height = Math.max(1, Math.round(rect.height * dpr))
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
      }
      const state = useWhiteboard.getState()
      state.setViewport({ width: rect.width, height: rect.height })
      // Presentation fills the window, so the stage size changes right after the
      // mode switches. Fit the drawing once the new size is known.
      if (fitOnResizeRef.current && rect.width > 0 && rect.height > 0) {
        fitOnResizeRef.current = false
        state.fitView({ width: rect.width, height: rect.height })
      }
      if (state.ruler.visible && state.ruler.x === 0 && state.ruler.y === 0 && rect.width > 0) {
        state.setRuler({ x: rect.width / 2, y: rect.height / 2 })
      }
      scheduleDraw()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    window.addEventListener('resize', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Presentation shows the drawing, not the editor's current pan: fit the page
  // when the mode starts and restore the editor view when it ends.
  useEffect(() => {
    const state = useWhiteboard.getState()
    if (presentation) {
      editorViewRef.current = state.view
      fitOnResizeRef.current = true
      if (state.viewport.width > 0 && state.viewport.height > 0) {
        state.fitView(state.viewport)
      }
      return
    }
    if (editorViewRef.current) {
      state.setView(editorViewRef.current)
      editorViewRef.current = null
    }
  }, [presentation])

  useEffect(() => {
    const updateTheme = () => {
      themeRef.current = readThemeColors()
      scheduleDraw()
    }
    updateTheme()
    const unsubscribe = useSettings.subscribe((state, previous) => {
      if (state.appearance !== previous.appearance) updateTheme()
    })
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-accent', 'data-contrast'],
    })
    return () => {
      unsubscribe()
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const unsubscribe = useWhiteboard.subscribe(() => scheduleDraw())
    return () => {
      unsubscribe()
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current)
      if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const state = useWhiteboard.getState()
      if (event.ctrlKey || event.metaKey) {
        const point = stagePoint(event.clientX, event.clientY)
        state.zoomTo(state.view.zoom * Math.exp(-event.deltaY * 0.0015), point)
      } else {
        state.setView({
          x: state.view.x - event.deltaX,
          y: state.view.y - event.deltaY,
          zoom: state.view.zoom,
        })
      }
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return
      if (event.repeat) return
      spaceRef.current = true
      setSpaceDown(true)
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spaceRef.current = false
      setSpaceDown(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const gestureActive = gesture.enabled
  const cameraLive = camera === 'live'
  const drawableTool =
    isInkTool(tool) || isShapeTool(tool) || tool === 'eraser' || tool === 'laser'
  const hudText = !cameraLive
    ? t('wb.gestureCameraOff')
    : tracking === 'lost' || hands === 0
      ? t('wb.gestureNoHand')
      : drawableTool
        ? t('wb.gestureReady')
        : t('wb.gesturePickTool')

  return (
    <div
      ref={containerRef}
      className={styles.stage}
      data-tool={tool}
      data-space={spaceDown}
      role="application"
      tabIndex={0}
      aria-label={t('wb.canvasLabel')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas ref={sceneRef} className={styles.canvas} aria-hidden="true" />
      <canvas ref={overlayRef} className={styles.canvas} aria-hidden="true" />

      {gestureActive ? (
        <div className={styles.gestureHud} data-tone={cameraLive ? 'ok' : 'warn'} role="status">
          <Hand aria-hidden="true" />
          <span>{hudText}</span>
          {!dockOpen ? (
            <button type="button" onClick={() => setDockOpen(true)}>
              {t('wb.showCamera')}
            </button>
          ) : null}
        </div>
      ) : null}

      {gestureActive && dockOpen ? (
        <div className={styles.cameraDock}>
          <button
            type="button"
            className={styles.dockClose}
            aria-label={t('wb.hideCamera')}
            onClick={() => setDockOpen(false)}
          >
            <X aria-hidden="true" />
          </button>
          <CameraPreview compact showLandmarks={false} />
        </div>
      ) : null}

      {editingId && editingObject && (editingObject.type === 'text' || editingObject.type === 'note') ? (
        <InlineEditor
          object={editingObject}
          view={view}
          onDone={() => useWhiteboard.getState().setEditing(null)}
        />
      ) : null}

      {presentation ? (
        <div className={styles.presentationBadge}>
          <span>{t('wb.presentation')}</span>
          <button
            type="button"
            onClick={() => useWhiteboard.getState().setPresentation(false)}
          >
            {t('wb.exitPresentation')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function normalizeRect(start: Point, current: Point): Rect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  }
}

function InlineEditor({
  object,
  view,
  onDone,
}: {
  object: Extract<WhiteboardObject, { type: 'text' | 'note' }>
  view: { x: number; y: number; zoom: number }
  onDone: () => void
}) {
  const { t } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isNote = object.type === 'note'
  const scale = isNote ? Math.min(object.w / 184, object.h / 152) : 1
  const fontSize = isNote
    ? Math.max(10, Math.min(24, 14 * scale)) * view.zoom
    : object.fontSize * view.zoom
  const padding = (isNote ? Math.max(10, 13 * scale) : 8) * view.zoom
  const color = isNote
    ? isDark(object.color)
      ? '#f2f4f3'
      : '#26302f'
    : object.type === 'text'
      ? object.color
      : '#26302f'
  const background = object.type === 'text' ? object.background ?? 'transparent' : object.color

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [object.id])

  return (
    <div
      className={styles.editorWrap}
      style={{
        left: object.x * view.zoom + view.x,
        top: object.y * view.zoom + view.y,
        width: Math.max(60, object.w * view.zoom),
        height: Math.max(36, object.h * view.zoom),
        transform: object.rotation ? `rotate(${object.rotation}deg)` : undefined,
      }}
    >
      <textarea
        ref={textareaRef}
        className={styles.editor}
        value={object.text}
        aria-label={isNote ? t('wb.noteText') : t('wb.textContent')}
        style={{
          fontSize,
          padding,
          color,
          background,
          textAlign: object.type === 'text' ? object.align : 'left',
          fontWeight: object.type === 'text' ? object.fontWeight : 500,
          lineHeight: object.type === 'text' ? 1.34 : 1.4,
          borderRadius: object.type === 'text' && object.background ? 6 : isNote ? 4 : 0,
        }}
        onChange={(event) => useWhiteboard.getState().updateObjectText(object.id, event.target.value)}
        onBlur={() => {
          const state = useWhiteboard.getState()
          const page = activePageOf(state)
          const current = page?.objects.find((item) => item.id === object.id)
          if (!current || current.type !== 'text' && current.type !== 'note' || current.text.trim().length === 0) {
            if (page) state.setObjects(page.objects.filter((item) => item.id !== object.id))
          }
          onDone()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          event.stopPropagation()
        }}
      />
      <button
        type="button"
        className={styles.doneButton}
        onClick={() => textareaRef.current?.blur()}
      >
        <Check aria-hidden="true" />
        {t('wb.done')}
      </button>
    </div>
  )
}

function isDark(color: string): boolean {
  const hex = color.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45
}
