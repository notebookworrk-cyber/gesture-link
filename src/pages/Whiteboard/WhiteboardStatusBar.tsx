import {
  ChevronLeft,
  ChevronRight,
  Hand,
  Maximize,
  Plus,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useI18n } from '@/localization/i18n'
import { objectsLabel } from '@/localization/counts'
import { useVisionStatus } from '@/vision/visionStatus'
import { useWhiteboard } from '@/whiteboard/store'
import styles from './whiteboard.module.css'

interface WhiteboardStatusBarProps {
  onOpenPages: () => void
}

export function WhiteboardStatusBar({ onOpenPages }: WhiteboardStatusBarProps) {
  const { t, formatNumber } = useI18n()
  const zoom = useWhiteboard((state) => state.view.zoom)
  const pageIndex = useWhiteboard((state) => {
    const board = state.boards.find((item) => item.id === state.activeBoardId)
    return board ? board.pages.findIndex((page) => page.id === board.activePageId) : -1
  })
  const pageCount = useWhiteboard((state) => {
    const board = state.boards.find((item) => item.id === state.activeBoardId)
    return board?.pages.length ?? 0
  })
  const objectCount = useWhiteboard((state) => {
    const board = state.boards.find((item) => item.id === state.activeBoardId)
    const page = board?.pages.find((item) => item.id === board.activePageId)
    return page?.objects.length ?? 0
  })
  const selectedCount = useWhiteboard((state) => state.selection.length)
  const gesture = useWhiteboard((state) => state.gesture)
  const camera = useVisionStatus((state) => state.camera)
  const tracking = useVisionStatus((state) => state.tracking)

  const zoomTo = useWhiteboard((state) => state.zoomTo)
  const resetView = useWhiteboard((state) => state.resetView)
  const fitView = useWhiteboard((state) => state.fitView)
  const viewport = useWhiteboard((state) => state.viewport)
  const addPage = useWhiteboard((state) => state.addPage)
  const setActivePage = useWhiteboard((state) => state.setActivePage)

  const goRelative = (direction: -1 | 1) => {
    const state = useWhiteboard.getState()
    const board = state.boards.find((item) => item.id === state.activeBoardId)
    if (!board) return
    const index = board.pages.findIndex((page) => page.id === board.activePageId)
    const next = board.pages[index + direction]
    if (next) setActivePage(next.id)
  }

  const gestureState = !gesture.enabled
    ? t('wb.gestureOff')
    : camera !== 'live'
      ? t('wb.gestureCameraOff')
      : tracking === 'lost'
        ? t('wb.gestureLost')
        : t('wb.gestureTracking')

  return (
    <footer className={styles.statusBar}>
      <div className={styles.statusGroup} role="group" aria-label={t('wb.zoom')}>
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => zoomTo(zoom / 1.2)}
          aria-label={t('wb.zoomOut')}
          title={t('wb.zoomOut')}
        >
          <ZoomOut aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.zoomValue}
          onClick={resetView}
          aria-label={t('wb.resetZoom')}
          title={t('wb.resetZoom')}
        >
          {formatNumber(Math.round(zoom * 100))}%
        </button>
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => zoomTo(zoom * 1.2)}
          aria-label={t('wb.zoomIn')}
          title={t('wb.zoomIn')}
        >
          <ZoomIn aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => fitView(viewport)}
          aria-label={t('wb.fitToContent')}
          title={t('wb.fitToContent')}
        >
          <Maximize aria-hidden="true" />
        </button>
      </div>

      <div className={styles.statusGroup} role="group" aria-label={t('wb.pages')}>
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => goRelative(-1)}
          disabled={pageIndex <= 0}
          aria-label={t('wb.previousPage')}
          title={t('wb.previousPage')}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.pageValue}
          onClick={onOpenPages}
          aria-label={t('wb.openPages')}
          title={t('wb.openPages')}
        >
          {pageIndex >= 0 ? pageIndex + 1 : 0} / {pageCount}
        </button>
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => goRelative(1)}
          disabled={pageIndex < 0 || pageIndex >= pageCount - 1}
          aria-label={t('wb.nextPage')}
          title={t('wb.nextPage')}
        >
          <ChevronRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.statusButton}
          onClick={() => addPage()}
          aria-label={t('wb.addPage')}
          title={t('wb.addPage')}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>

      <div className={styles.statusSpacer} />

      <div className={styles.statusMeta}>
        <span>
          {objectsLabel(t, formatNumber, objectCount)}
        </span>
        {selectedCount > 0 ? (
          <span className={styles.selectedMeta}>
            {t('wb.selectedCount', { count: formatNumber(selectedCount) })}
          </span>
        ) : null}
        <span className={styles.gestureMeta} data-tone={gesture.enabled ? (camera === 'live' ? 'ok' : 'warn') : 'off'}>
          <Hand aria-hidden="true" />
          {gestureState}
        </span>
      </div>
    </footer>
  )
}
