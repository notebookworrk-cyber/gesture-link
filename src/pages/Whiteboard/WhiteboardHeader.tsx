import {
  Check,
  Download,
  LayoutGrid,
  LoaderCircle,
  Presentation,
  Redo2,
  Save,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/localization/i18n'
import { activeBoardOf, useWhiteboard } from '@/whiteboard/store'
import styles from './whiteboard.module.css'

interface WhiteboardHeaderProps {
  onOpenBoards: () => void
  onOpenExport: () => void
}

export function WhiteboardHeader({ onOpenBoards, onOpenExport }: WhiteboardHeaderProps) {
  const { t } = useI18n()
  const boardId = useWhiteboard((state) => state.activeBoardId)
  const boardName = useWhiteboard((state) => activeBoardOf(state)?.name ?? '')
  const canUndo = useWhiteboard((state) => state.history.length > 0)
  const canRedo = useWhiteboard((state) => state.future.length > 0)
  const saveState = useWhiteboard((state) => state.saveState)
  const savedAt = useWhiteboard((state) => state.savedAt)
  const storageError = useWhiteboard((state) => state.storageError)
  const renameBoard = useWhiteboard((state) => state.renameBoard)
  const undo = useWhiteboard((state) => state.undo)
  const redo = useWhiteboard((state) => state.redo)
  const saveNow = useWhiteboard((state) => state.saveNow)
  const setPresentation = useWhiteboard((state) => state.setPresentation)

  const savedTime = savedAt ? new Date(savedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <header className={styles.topBar}>
      <Button
        size="sm"
        variant="ghost"
        icon={<LayoutGrid aria-hidden="true" />}
        onClick={onOpenBoards}
        aria-label={t('wb.boards')}
      >
        <span className={styles.hideNarrow}>{t('wb.boards')}</span>
      </Button>

      <div className={styles.titleWrap}>
        <span className={styles.docKind}>{t('wb.document')}</span>
        <input
          className={styles.titleInput}
          value={boardName}
          placeholder={t('wb.untitledBoard')}
          aria-label={t('wb.boardName')}
          maxLength={80}
          onChange={(event) => {
            if (boardId) renameBoard(boardId, event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            event.stopPropagation()
          }}
        />
      </div>

      <div className={styles.topActions}>
        <Button
          size="icon"
          variant="ghost"
          disabled={!canUndo}
          onClick={undo}
          aria-label={t('wb.undo')}
          title={`${t('wb.undo')} (Ctrl+Z)`}
        >
          <Undo2 aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={!canRedo}
          onClick={redo}
          aria-label={t('wb.redo')}
          title={`${t('wb.redo')} (Ctrl+Shift+Z)`}
        >
          <Redo2 aria-hidden="true" />
        </Button>

        <span className={styles.saveState} data-state={saveState} role="status">
          {saveState === 'saving' ? (
            <LoaderCircle aria-hidden="true" className={styles.spin} />
          ) : saveState === 'error' ? (
            <TriangleAlert aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          <span className={styles.hideNarrow}>
            {saveState === 'saving'
              ? t('wb.saving')
              : saveState === 'error'
                ? t('wb.saveError')
                : savedTime
                  ? t('wb.savedAt', { time: savedTime })
                  : t('wb.saved')}
          </span>
          {saveState === 'error' && storageError ? (
            <span className={styles.saveDetail}>{storageError}</span>
          ) : null}
        </span>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => void saveNow()}
          aria-label={t('wb.saveNow')}
          title={t('wb.saveNow')}
        >
          <Save aria-hidden="true" />
        </Button>

        <Button
          size="sm"
          variant="secondary"
          icon={<Download aria-hidden="true" />}
          onClick={onOpenExport}
        >
          <span className={styles.hideNarrow}>{t('wb.export')}</span>
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<Presentation aria-hidden="true" />}
          onClick={() => setPresentation(true)}
        >
          <span className={styles.hideNarrow}>{t('wb.present')}</span>
        </Button>
      </div>
    </header>
  )
}
