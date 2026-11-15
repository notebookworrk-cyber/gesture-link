import { useEffect, useState } from 'react'
import { Check, Copy, FilePlus2, LayoutGrid, PencilLine, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { objectsLabel, pagesLabel } from '@/localization/counts'
import { useI18n } from '@/localization/i18n'
import { activeBoardOf, useWhiteboard } from '@/whiteboard/store'
import styles from './whiteboard.module.css'

export type DocumentTab = 'boards' | 'pages'

interface DocumentDialogProps {
  open: boolean
  tab: DocumentTab
  onClose: () => void
}

export function DocumentDialog({ open, tab, onClose }: DocumentDialogProps) {
  const { t, formatNumber } = useI18n()
  const [currentTab, setCurrentTab] = useState<DocumentTab>(tab)
  const [editingBoard, setEditingBoard] = useState<string | null>(null)
  const [editingPage, setEditingPage] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmBoard, setConfirmBoard] = useState<string | null>(null)
  const [confirmPage, setConfirmPage] = useState<string | null>(null)

  const boards = useWhiteboard((state) => state.boards)
  const activeBoardId = useWhiteboard((state) => state.activeBoardId)
  const activeBoard = useWhiteboard((state) => activeBoardOf(state))
  const openBoard = useWhiteboard((state) => state.openBoard)
  const createBoard = useWhiteboard((state) => state.createBoard)
  const renameBoard = useWhiteboard((state) => state.renameBoard)
  const duplicateBoard = useWhiteboard((state) => state.duplicateBoard)
  const deleteBoard = useWhiteboard((state) => state.deleteBoard)
  const setActivePage = useWhiteboard((state) => state.setActivePage)
  const addPage = useWhiteboard((state) => state.addPage)
  const renamePage = useWhiteboard((state) => state.renamePage)
  const duplicatePage = useWhiteboard((state) => state.duplicatePage)
  const deletePage = useWhiteboard((state) => state.deletePage)

  useEffect(() => {
    if (open) {
      setCurrentTab(tab)
      setEditingBoard(null)
      setEditingPage(null)
      setConfirmBoard(null)
      setConfirmPage(null)
    }
  }, [open, tab])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  if (!open) return null

  const boardName = (name: string) => name.trim() || t('wb.untitledBoard')

  const pageName = (name: string, index: number) =>
    name.trim() || t('wb.pageNumber', { number: formatNumber(index + 1) })

  const startRenameBoard = (id: string, name: string) => {
    setEditingBoard(id)
    setEditingPage(null)
    setDraft(name)
  }
  const startRenamePage = (id: string, name: string) => {
    setEditingPage(id)
    setEditingBoard(null)
    setDraft(name)
  }

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={t('wb.documents')}>
        <header className={styles.modalHead}>
          <div className={styles.modalTitle}>
            <LayoutGrid aria-hidden="true" />
            <h2>{t('wb.documents')}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label={t('common.close')}>
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className={styles.modalTabs} role="tablist" aria-label={t('wb.documents')}>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'boards'}
            data-active={currentTab === 'boards'}
            onClick={() => setCurrentTab('boards')}
          >
            {t('wb.boards')}
            <span>{formatNumber(boards.length)}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'pages'}
            data-active={currentTab === 'pages'}
            onClick={() => setCurrentTab('pages')}
          >
            {t('wb.pages')}
            <span>{formatNumber(activeBoard?.pages.length ?? 0)}</span>
          </button>
        </div>

        <div className={styles.modalBody}>
          {currentTab === 'boards' ? (
            <>
              <div className={styles.modalToolbar}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<FilePlus2 aria-hidden="true" />}
                  onClick={() => {
                    createBoard(t('wb.untitledBoard'))
                    onClose()
                  }}
                >
                  {t('wb.newBoard')}
                </Button>
              </div>
              <ul className={styles.docList}>
                {boards.map((board) => {
                  const active = board.id === activeBoardId
                  const deleting = confirmBoard === board.id
                  return (
                    <li key={board.id} className={styles.docRow} data-active={active}>
                      <button
                        type="button"
                        className={styles.docMain}
                        onClick={() => {
                          openBoard(board.id)
                          onClose()
                        }}
                        aria-current={active ? 'true' : undefined}
                      >
                        <span className={styles.docName}>
                          {editingBoard === board.id ? (
                            <input
                              autoFocus
                              className={styles.renameInput}
                              value={draft}
                              aria-label={t('wb.boardName')}
                              onChange={(event) => setDraft(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                event.stopPropagation()
                                if (event.key === 'Enter') {
                                  renameBoard(board.id, draft)
                                  setEditingBoard(null)
                                }
                                if (event.key === 'Escape') setEditingBoard(null)
                              }}
                              onBlur={() => {
                                renameBoard(board.id, draft)
                                setEditingBoard(null)
                              }}
                            />
                          ) : (
                            boardName(board.name)
                          )}
                          {active ? <span className={styles.currentTag}>{t('wb.current')}</span> : null}
                        </span>
                        <span className={styles.docMeta}>
                          {pagesLabel(t, formatNumber, board.pages.length)} ·{' '}
                          {objectsLabel(
                            t,
                            formatNumber,
                            board.pages.reduce((sum, page) => sum + page.objects.length, 0),
                          )}
                        </span>
                      </button>

                      {deleting ? (
                        <div className={styles.confirmInline} role="alert">
                          <span>{t('wb.deleteBoardConfirm')}</span>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              void deleteBoard(board.id)
                              setConfirmBoard(null)
                            }}
                          >
                            {t('wb.delete')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmBoard(null)}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      ) : (
                        <div className={styles.docActions}>
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={t('wb.rename')}
                            title={t('wb.rename')}
                            onClick={() => startRenameBoard(board.id, board.name)}
                          >
                            <PencilLine aria-hidden="true" />
                          </Button>
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={t('wb.duplicate')}
                            title={t('wb.duplicate')}
                            onClick={() => {
                              duplicateBoard(
                                board.id,
                                `${boardName(board.name)} ${t('wb.copySuffix')}`,
                              )
                              onClose()
                            }}
                          >
                            <Copy aria-hidden="true" />
                          </Button>
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={t('wb.delete')}
                            title={t('wb.delete')}
                            disabled={boards.length < 2}
                            onClick={() => setConfirmBoard(board.id)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : activeBoard ? (
            <>
              <div className={styles.modalToolbar}>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus aria-hidden="true" />}
                  onClick={() => addPage()}
                >
                  {t('wb.newPage')}
                </Button>
              </div>
              <ul className={styles.docList}>
                {activeBoard.pages.map((page, index) => {
                  const active = page.id === activeBoard.activePageId
                  const deleting = confirmPage === page.id
                  return (
                    <li key={page.id} className={styles.docRow} data-active={active}>
                      <button
                        type="button"
                        className={styles.docMain}
                        onClick={() => {
                          setActivePage(page.id)
                          onClose()
                        }}
                        aria-current={active ? 'true' : undefined}
                      >
                        <span className={styles.docName}>
                          {editingPage === page.id ? (
                            <input
                              autoFocus
                              className={styles.renameInput}
                              value={draft}
                              aria-label={t('wb.pageName')}
                              onChange={(event) => setDraft(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                event.stopPropagation()
                                if (event.key === 'Enter') {
                                  renamePage(page.id, draft)
                                  setEditingPage(null)
                                }
                                if (event.key === 'Escape') setEditingPage(null)
                              }}
                              onBlur={() => {
                                renamePage(page.id, draft)
                                setEditingPage(null)
                              }}
                            />
                          ) : (
                            pageName(page.name, index)
                          )}
                          {active ? <span className={styles.currentTag}>{t('wb.current')}</span> : null}
                        </span>
                        <span className={styles.docMeta}>
                          {objectsLabel(t, formatNumber, page.objects.length)}
                        </span>
                      </button>

                      {deleting ? (
                        <div className={styles.confirmInline} role="alert">
                          <span>{t('wb.deletePageConfirm')}</span>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              deletePage(page.id)
                              setConfirmPage(null)
                            }}
                          >
                            {t('wb.delete')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmPage(null)}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      ) : (
                        <div className={styles.docActions}>
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={t('wb.rename')}
                            title={t('wb.rename')}
                            onClick={() => startRenamePage(page.id, page.name)}
                          >
                            <PencilLine aria-hidden="true" />
                          </Button>
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={t('wb.duplicate')}
                            title={t('wb.duplicate')}
                            onClick={() => duplicatePage(page.id)}
                          >
                            <Copy aria-hidden="true" />
                          </Button>
                          <Button
                            size="iconSm"
                            variant="ghost"
                            aria-label={t('wb.delete')}
                            title={t('wb.delete')}
                            disabled={activeBoard.pages.length < 2}
                            onClick={() => setConfirmPage(page.id)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <p className={styles.modalNote}>
                <Check aria-hidden="true" />
                {t('wb.autosaveNote')}
              </p>
            </>
          ) : (
            <p className={styles.modalNote}>{t('wb.noBoard')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
