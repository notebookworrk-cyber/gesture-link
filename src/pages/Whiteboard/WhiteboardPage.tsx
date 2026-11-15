import { useEffect, useRef, useState } from 'react'
import { Workspace } from '@/components/layout/Workspace'
import { useI18n } from '@/localization/i18n'
import { CanvasStage } from './CanvasStage'
import { DocumentDialog, type DocumentTab } from './DocumentDialog'
import { ExportDialog } from './ExportDialog'
import { ToolRail } from './ToolRail'
import { WhiteboardHeader } from './WhiteboardHeader'
import { WhiteboardInspector } from './WhiteboardInspector'
import { WhiteboardStatusBar } from './WhiteboardStatusBar'
import { TOOLS } from '@/whiteboard/defaults'
import { activeBoardOf, useWhiteboard } from '@/whiteboard/store'
import type { ToolId } from '@/whiteboard/types'
import styles from './whiteboard.module.css'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024

const TOOL_KEYS: Record<string, ToolId> = Object.fromEntries(
  TOOLS.filter((tool) => tool.shortcut).map((tool) => [
    tool.shortcut!.toLowerCase(),
    tool.id,
  ]),
) as Record<string, ToolId>

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function WhiteboardPage() {
  const { t } = useI18n()
  const ready = useWhiteboard((state) => state.ready)
  const presentation = useWhiteboard((state) => state.presentation)
  const [dialog, setDialog] = useState<DocumentTab | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Load the persisted document set once per session.
  useEffect(() => {
    void useWhiteboard.getState().init()
  }, [])

  // Best-effort flush when the tab is hidden or closed.
  useEffect(() => {
    const flush = () => {
      void useWhiteboard.getState().saveNow()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    return () => window.removeEventListener('pagehide', flush)
  }, [])

  useEffect(() => {
    if (!imageError) return
    const timer = setTimeout(() => setImageError(null), 6000)
    return () => clearTimeout(timer)
  }, [imageError])

  // Escape leaves presentation mode before anything else claims the key.
  useEffect(() => {
    if (!presentation) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        useWhiteboard.getState().setPresentation(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [presentation])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const state = useWhiteboard.getState()
      if (state.presentation) return
      const mod = event.ctrlKey || event.metaKey

      if (mod) {
        switch (event.key.toLowerCase()) {
          case 'z':
            event.preventDefault()
            if (event.shiftKey) state.redo()
            else state.undo()
            return
          case 'y':
            event.preventDefault()
            state.redo()
            return
          case 's':
            event.preventDefault()
            void state.saveNow()
            return
          case 'a':
            event.preventDefault()
            state.selectAll()
            return
          case 'd':
            event.preventDefault()
            state.duplicateSelection()
            return
          case 'g':
            event.preventDefault()
            if (event.shiftKey) state.ungroupSelection()
            else state.groupSelection()
            return
          case '0':
            event.preventDefault()
            state.resetView()
            return
          case '=':
          case '+':
            event.preventDefault()
            state.zoomTo(state.view.zoom * 1.2)
            return
          case '-':
            event.preventDefault()
            state.zoomTo(state.view.zoom / 1.2)
            return
          case 'e':
            event.preventDefault()
            setExportOpen(true)
            return
          default:
            return
        }
      }

      if (event.altKey) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selection.length === 0) return
        event.preventDefault()
        state.deleteSelection()
        return
      }

      if (event.key === 'Escape') {
        if (state.selection.length > 0) {
          event.preventDefault()
          state.setSelection([])
        }
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (state.selection.length === 0) return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
        state.nudgeSelection(dx, dy, `nudge:${dx}:${dy}`)
        return
      }

      if (event.key === '[' || event.key === ']') {
        const board = activeBoardOf(state)
        if (!board) return
        const index = board.pages.findIndex((page) => page.id === board.activePageId)
        const next = board.pages[index + (event.key === ']' ? 1 : -1)]
        if (next) {
          event.preventDefault()
          state.setActivePage(next.id)
        }
        return
      }

      if (event.key === 'PageDown' || event.key === 'PageUp') {
        const board = activeBoardOf(state)
        if (!board) return
        const index = board.pages.findIndex((page) => page.id === board.activePageId)
        const next = board.pages[index + (event.key === 'PageDown' ? 1 : -1)]
        if (next) {
          event.preventDefault()
          state.setActivePage(next.id)
        }
        return
      }

      const tool = TOOL_KEYS[event.key.toLowerCase()]
      if (tool) {
        event.preventDefault()
        state.setTool(tool)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pickImage = () => fileRef.current?.click()

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError(t('wb.imageUnsupported'))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t('wb.imageTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      const image = new Image()
      image.onload = () => {
        const state = useWhiteboard.getState()
        const center = {
          x: (state.viewport.width / 2 - state.view.x) / state.view.zoom,
          y: (state.viewport.height / 2 - state.view.y) / state.view.zoom,
        }
        state.addImage(src, file.name, image.naturalWidth, image.naturalHeight, center)
      }
      image.onerror = () => setImageError(t('wb.imageUnsupported'))
      image.src = src
    }
    reader.onerror = () => setImageError(t('wb.imageUnsupported'))
    reader.readAsDataURL(file)
  }

  const inspector = presentation ? undefined : <WhiteboardInspector onPickImage={pickImage} />

  return (
    <>
      <Workspace inspector={inspector}>
        <div className={styles.page} data-presentation={presentation}>
          {!presentation ? (
            <WhiteboardHeader
              onOpenBoards={() => setDialog('boards')}
              onOpenExport={() => setExportOpen(true)}
            />
          ) : null}

          <div className={styles.body}>
            {!presentation ? <ToolRail /> : null}
            <div className={styles.stageWrap}>
              {ready ? (
                <CanvasStage onPickImage={pickImage} presentation={presentation} />
              ) : (
                <div className={styles.loading} role="status">
                  {t('wb.loading')}
                </div>
              )}
            </div>
          </div>

          {!presentation ? (
            <WhiteboardStatusBar onOpenPages={() => setDialog('pages')} />
          ) : null}
        </div>
      </Workspace>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className={styles.fileInput}
        aria-label={t('wb.insertImage')}
        onChange={(event) => {
          onFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {imageError ? (
        <div className={styles.toast} role="alert">
          {imageError}
          <button type="button" onClick={() => setImageError(null)} aria-label={t('common.close')}>
            {t('common.close')}
          </button>
        </div>
      ) : null}

      <DocumentDialog
        open={dialog !== null}
        tab={dialog ?? 'boards'}
        onClose={() => setDialog(null)}
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  )
}
