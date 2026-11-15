import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Download, ImageOff, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Controls'
import { EmptyState, Panel } from '@/components/ui/Panel'
import { Workspace } from '@/components/layout/Workspace'
import { useI18n } from '@/localization/i18n'
import { downloadBlob, photoFileName } from '@/photos/capture'
import { filterById } from '@/photos/filters'
import { STICKERS } from '@/photos/stickers'
import { usePhotos } from '@/photos/store'
import type { PhotoRecord } from '@/photos/types'
import styles from './gallery.module.css'

type Range = 'all' | 'today' | 'week' | 'month'

export function GalleryPage() {
  const { t, formatNumber, formatDate } = useI18n()
  const photos = usePhotos((state) => state.photos)
  const status = usePhotos((state) => state.status)
  const error = usePhotos((state) => state.error)
  const remove = usePhotos((state) => state.remove)
  const rename = usePhotos((state) => state.rename)

  const [range, setRange] = useState<Range>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [draftName, setDraftName] = useState('')

  useEffect(() => {
    void usePhotos.getState().init()
  }, [])

  const visible = useMemo(() => {
    if (range === 'all') return photos
    const now = new Date()
    const start = new Date(now)
    if (range === 'today') start.setHours(0, 0, 0, 0)
    if (range === 'week') start.setDate(start.getDate() - 6)
    if (range === 'month') start.setDate(start.getDate() - 29)
    const from = start.getTime()
    return photos.filter((photo) => photo.createdAt >= from)
  }, [photos, range])

  const selected = selectedId ? (photos.find((photo) => photo.id === selectedId) ?? null) : null

  const closePreview = () => {
    setSelectedId(null)
    setConfirming(false)
    setDraftName('')
  }

  return (
    <Workspace>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>{t('nav.libraryGroup')}</span>
            <h1>{t('page.gallery.title')}</h1>
            <p>{t('page.gallery.lead')}</p>
          </div>
          <div className={styles.headerTools}>
            <Segmented
              ariaLabel={t('gallery.range')}
              value={range}
              onChange={setRange}
              options={[
                { value: 'all', label: t('gallery.rangeAll') },
                { value: 'today', label: t('gallery.rangeToday') },
                { value: 'week', label: t('gallery.rangeWeek') },
                { value: 'month', label: t('gallery.rangeMonth') },
              ]}
            />
            <span className={styles.count}>
              {t('gallery.photoCount', { count: formatNumber(visible.length) })}
            </span>
          </div>
        </header>

        <div className={styles.body}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          {status === 'loading' ? (
            <p className={styles.loading} role="status">
              {t('common.loading')}
            </p>
          ) : null}

          {photos.length === 0 && status !== 'loading' ? (
            <Panel>
              <EmptyState
                icon={<ImageOff aria-hidden="true" />}
                title={t('gallery.emptyTitle')}
                body={t('gallery.emptyBody')}
                action={
                  <Link className={styles.emptyAction} to="/camera">
                    <Camera aria-hidden="true" />
                    {t('gallery.openCamera')}
                  </Link>
                }
              />
            </Panel>
          ) : null}

          {photos.length > 0 && visible.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<ImageOff aria-hidden="true" />}
                title={t('gallery.emptyRangeTitle')}
                body={t('gallery.emptyRangeBody')}
                action={
                  <Button size="sm" variant="secondary" onClick={() => setRange('all')}>
                    {t('gallery.rangeAll')}
                  </Button>
                }
              />
            </Panel>
          ) : null}

          {visible.length > 0 ? (
            <ul className={styles.grid}>
              {visible.map((photo) => (
                <li key={photo.id}>
                  <button
                    type="button"
                    className={styles.card}
                    onClick={() => {
                      setSelectedId(photo.id)
                      setDraftName(photo.name)
                      setConfirming(false)
                    }}
                  >
                    <PhotoImage photo={photo} />
                    <span className={styles.cardName}>{photo.name}</span>
                    <span className={styles.cardDate}>
                      {formatDate(photo.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div
          className={styles.backdrop}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePreview()
          }}
        >
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={selected.name}>
            <header className={styles.dialogHead}>
              <h2>{t('gallery.previewTitle')}</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closePreview}
                aria-label={t('common.close')}
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <div className={styles.dialogBody}>
              <div className={styles.dialogImage}>
                <PhotoImage photo={selected} full />
              </div>

              <div className={styles.meta}>
                <label className={styles.nameField}>
                  <span>{t('gallery.photoName')}</span>
                  <input
                    value={draftName}
                    maxLength={80}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void rename(selected.id, draftName)
                      }
                    }}
                  />
                </label>
                <dl className={styles.detailList}>
                  <div>
                    <dt>{t('gallery.taken')}</dt>
                    <dd>
                      {formatDate(selected.createdAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('gallery.size')}</dt>
                    <dd>
                      {selected.width}×{selected.height}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('gallery.filter')}</dt>
                    <dd>{t(filterById(selected.filter).labelKey)}</dd>
                  </div>
                  <div>
                    <dt>{t('gallery.stickers')}</dt>
                    <dd>
                      {selected.stickers.length === 0
                        ? t('gallery.none')
                        : selected.stickers
                            .map(
                              (id) =>
                                t(STICKERS.find((sticker) => sticker.id === id)?.labelKey ?? 'cam.stickerGlasses'),
                            )
                            .join(', ')}
                    </dd>
                  </div>
                </dl>

                {confirming ? (
                  <div className={styles.confirm} role="alert">
                    <span>{t('gallery.deleteConfirm')}</span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        void remove(selected.id)
                        closePreview()
                      }}
                    >
                      {t('wb.delete')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Pencil aria-hidden="true" />}
                      onClick={() => void rename(selected.id, draftName)}
                    >
                      {t('gallery.rename')}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Download aria-hidden="true" />}
                      onClick={() => downloadBlob(selected.blob, photoFileName(selected.name))}
                    >
                      {t('gallery.download')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 aria-hidden="true" />}
                      onClick={() => setConfirming(true)}
                    >
                      {t('wb.delete')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Workspace>
  )
}

function PhotoImage({ photo, full = false }: { photo: PhotoRecord; full?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(full ? photo.blob : photo.thumb)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo.blob, photo.thumb, full])

  if (!url) return <span className={styles.placeholder} aria-hidden="true" />
  return <img src={url} alt={photo.name} data-full={full} />
}
