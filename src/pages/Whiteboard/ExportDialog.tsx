import { useEffect, useState } from 'react'
import { Download, FileImage, FileText, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Controls'
import { useI18n } from '@/localization/i18n'
import { activeBoardOf, activePageOf, useWhiteboard } from '@/whiteboard/store'
import { downloadBlob, exportPage, type ExportFormat } from '@/whiteboard/export'
import styles from './whiteboard.module.css'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

const FORMATS: Array<{ id: ExportFormat; labelKey: 'wb.formatPng' | 'wb.formatJpeg' | 'wb.formatSvg' | 'wb.formatPdf' }> = [
  { id: 'png', labelKey: 'wb.formatPng' },
  { id: 'jpeg', labelKey: 'wb.formatJpeg' },
  { id: 'svg', labelKey: 'wb.formatSvg' },
  { id: 'pdf', labelKey: 'wb.formatPdf' },
]

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { t, formatNumber } = useI18n()
  const [format, setFormat] = useState<ExportFormat>('png')
  const [transparent, setTransparent] = useState(false)
  const [scale, setScale] = useState('2')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setBusy(false)
    setError(null)
    setDone(false)
  }, [open])

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

  const board = activeBoardOf(useWhiteboard.getState())
  const page = activePageOf(useWhiteboard.getState())
  const pageIndex = board && page ? board.pages.findIndex((item) => item.id === page.id) : -1
  const baseName = `${board?.name.trim() || t('wb.untitledBoard')} ${
    pageIndex >= 0 ? t('wb.pageNumber', { number: formatNumber(pageIndex + 1) }) : ''
  }`.trim()

  const supportsTransparent = format === 'png' || format === 'svg'

  const run = async () => {
    if (!page || !board) return
    setBusy(true)
    setError(null)
    try {
      const result = await exportPage(page, {
        format,
        transparent: supportsTransparent && transparent,
        scale: Number(scale),
        name: baseName,
      })
      downloadBlob(result.blob, result.filename)
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('wb.exportError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label={t('wb.exportTitle')}>
        <header className={styles.modalHead}>
          <div className={styles.modalTitle}>
            <Download aria-hidden="true" />
            <h2>{t('wb.exportTitle')}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label={t('common.close')}>
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className={styles.modalBody}>
          <div className={styles.exportGrid} role="radiogroup" aria-label={t('wb.format')}>
            {FORMATS.map((item) => {
              const Icon = item.id === 'svg' || item.id === 'pdf' ? FileText : FileImage
              return (
                <button
                  key={item.id}
                  type="button"
                  className={styles.formatCard}
                  data-active={format === item.id}
                  role="radio"
                  aria-checked={format === item.id}
                  onClick={() => {
                    setFormat(item.id)
                    setDone(false)
                  }}
                >
                  <Icon aria-hidden="true" />
                  <span>{t(item.labelKey)}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.exportRow}>
            <div className={styles.exportLabel}>
              <span>{t('wb.transparent')}</span>
              <small>{supportsTransparent ? t('wb.transparentHint') : t('wb.transparentUnsupported')}</small>
            </div>
            <Toggle
              checked={supportsTransparent && transparent}
              disabled={!supportsTransparent}
              onChange={setTransparent}
              label={t('wb.transparent')}
            />
          </div>

          <div className={styles.exportRow}>
            <div className={styles.exportLabel}>
              <span>{t('wb.scale')}</span>
              <small>{t('wb.scaleHint')}</small>
            </div>
            <select
              className={styles.select}
              value={scale}
              aria-label={t('wb.scale')}
              disabled={format === 'svg' || format === 'pdf'}
              onChange={(event) => setScale(event.target.value)}
            >
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="3">3×</option>
            </select>
          </div>

          <p className={styles.exportNote}>{t('wb.exportCanvasNote')}</p>

          {error ? (
            <p className={styles.exportError} role="alert">
              <TriangleAlert aria-hidden="true" />
              {error}
            </p>
          ) : null}
          {done ? <p className={styles.exportDone}>{t('wb.exported')}</p> : null}

          <div className={styles.modalFooter}>
            <Button variant="ghost" onClick={onClose}>
              {t('common.close')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void run()}
              disabled={busy || !page}
              icon={
                busy ? (
                  <LoaderCircle aria-hidden="true" className={styles.spin} />
                ) : (
                  <Download aria-hidden="true" />
                )
              }
            >
              {busy ? t('wb.exporting') : t('wb.exportNow')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
