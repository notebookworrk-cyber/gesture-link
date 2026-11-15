import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SelectControl, Slider, Toggle } from '@/components/ui/Controls'
import { Workspace } from '@/components/layout/Workspace'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { useSettings, CAMERA_GESTURE_ACTIONS, type CameraGestureAction } from '@/settings/settingsStore'
import { defaultPhotoName } from '@/photos/capture'
import {
  isCountdownComplete,
  shouldCancelCountdown,
  startCountdown,
} from '@/photos/countdown'
import { FILTERS, filterById } from '@/photos/filters'
import { STICKERS } from '@/photos/stickers'
import { usePhotos } from '@/photos/store'
import type { FilterId, PhotoRecord, StickerId } from '@/photos/types'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import type { StaticGestureId } from '@/vision/types'
import { StudioInspector } from './StudioInspector'
import { StudioStage, type StudioStageHandle } from './StudioStage'
import styles from './camera.module.css'

export function GestureCameraPage() {
  const { t, formatNumber } = useI18n()
  const engine = getVisionEngine()

  const camera = useVisionStatus((state) => state.camera)
  const tracking = useVisionStatus((state) => state.tracking)
  const hands = useVisionStatus((state) => state.hands)
  const faces = useVisionStatus((state) => state.faces)
  const fps = useVisionStatus((state) => state.fps)
  const inferenceMs = useVisionStatus((state) => state.inferenceMs)
  const faceMs = useVisionStatus((state) => state.faceMs)
  const delegate = useVisionStatus((state) => state.delegate)
  const captureWidth = useVisionStatus((state) => state.captureWidth)
  const captureHeight = useVisionStatus((state) => state.captureHeight)

  const deviceId = useSettings((state) => state.camera.deviceId)
  const gesturesEnabled = useSettings((state) => state.gestures.enabled)
  const bindings = useSettings((state) => state.gestures.bindings)

  const [filterId, setFilterId] = useState<FilterId>('natural')
  const [strength, setStrength] = useState(0.8)
  const [stickers, setStickers] = useState<StickerId[]>(['glasses'])
  const [effectEnabled, setEffectEnabled] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [currentGesture, setCurrentGesture] = useState<StaticGestureId>('none')
  const [notice, setNotice] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  const stageRef = useRef<StudioStageHandle>(null)
  const photos = usePhotos((state) => state.photos)
  const photoStatus = usePhotos((state) => state.status)
  const photoError = usePhotos((state) => state.error)

  const filter = filterById(filterId)

  // Keep the values the capture handle needs in refs, so the handle never has
  // to be rebuilt when a control changes.
  const captureOptions = useRef({ filter, strength, stickers, effectEnabled })
  captureOptions.current = { filter, strength, stickers, effectEnabled }
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings
  const gesturesEnabledRef = useRef(gesturesEnabled)
  gesturesEnabledRef.current = gesturesEnabled
  const capturingRef = useRef(false)

  useEffect(() => {
    void usePhotos.getState().init()
  }, [])

  // Device list for the camera switcher.
  useEffect(() => {
    let alive = true
    const load = () => {
      const media = navigator.mediaDevices
      if (!media?.enumerateDevices) return
      media
        .enumerateDevices()
        .then((list) => {
          if (!alive) return
          setDevices(list.filter((device) => device.kind === 'videoinput' && device.deviceId))
        })
        .catch(() => undefined)
    }
    load()
    navigator.mediaDevices?.addEventListener?.('devicechange', load)
    return () => {
      alive = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', load)
    }
  }, [camera])

  // Current gesture, used for the status readout and to cancel the countdown
  // when the hand shape is dropped before the photograph is taken.
  useEffect(
    () =>
      engine.subscribeFrames((frame) => {
        const gesture = frame.hands[0]?.gesture ?? 'none'
        setCurrentGesture(gesture)
      }),
    [engine],
  )

  const savePhoto = useCallback(async () => {
    const stage = stageRef.current
    if (!stage || capturingRef.current) return
    capturingRef.current = true
    setCapturing(true)
    try {
      const frame = await stage.capture()
      if (!frame) return
      const options = captureOptions.current
      const now = new Date()
      const record: PhotoRecord = {
        id: `ph_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: defaultPhotoName(now),
        createdAt: now.getTime(),
        width: frame.width,
        height: frame.height,
        filter: options.filter.id,
        filterStrength: options.strength,
        stickers: options.effectEnabled ? options.stickers : [],
        blob: frame.blob,
        thumb: frame.thumb,
      }
      try {
        await usePhotos.getState().add(record)
        setNotice(t('cam.saved'))
      } catch {
        setNotice(t('cam.saveFailed'))
      }
    } finally {
      capturingRef.current = false
      setCapturing(false)
    }
  }, [t])

  const startCountdownNow = useCallback(() => {
    setCountdown((current) => startCountdown(current))
  }, [])

  const runAction = useCallback(
    (action: CameraGestureAction) => {
      switch (action) {
        case 'capture':
          startCountdownNow()
          break
        case 'nextFilter': {
          const index = FILTERS.findIndex((item) => item.id === filterId)
          const next = FILTERS[(index + 1) % FILTERS.length]
          if (next) setFilterId(next.id)
          break
        }
        case 'previousFilter': {
          const index = FILTERS.findIndex((item) => item.id === filterId)
          const previous = FILTERS[(index - 1 + FILTERS.length) % FILTERS.length]
          if (previous) setFilterId(previous.id)
          break
        }
        case 'toggleControls':
          setControlsVisible((visible) => !visible)
          break
        case 'toggleEffect':
          setEffectEnabled((enabled) => !enabled)
          break
      }
    },
    [filterId, startCountdownNow],
  )

  // Gesture events fire once per held shape.
  useEffect(
    () =>
      engine.onGesture(({ gesture }) => {
        if (!gesturesEnabledRef.current) return
        const action = CAMERA_GESTURE_ACTIONS.find(
          (candidate) => bindingsRef.current[candidate] === gesture,
        )
        if (!action) return
        runAction(action)
      }),
    [engine, runAction],
  )

  // Countdown: three seconds, cancelled when the hand shape is released.
  useEffect(() => {
    if (countdown === null) return
    if (!isCountdownComplete(countdown)) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
    void savePhoto()
    return undefined
  }, [countdown, savePhoto])

  useEffect(() => {
    if (countdown === null) return
    if (shouldCancelCountdown(countdown, currentGesture, bindingsRef.current.capture)) {
      setCountdown(null)
    }
  }, [countdown, currentGesture])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const deviceOptions = useMemo(
    () => [
      { value: '', label: t('settings.cameraDefault') },
      ...devices.map((device, index) => ({
        value: device.deviceId,
        label: device.label || t('settings.cameraNumber', { number: index + 1 }),
      })),
    ],
    [devices, t],
  )

  const shiftFilter = (delta: number) => {
    const index = FILTERS.findIndex((item) => item.id === filterId)
    const next = FILTERS[(index + delta + FILTERS.length) % FILTERS.length]
    if (next) setFilterId(next.id)
  }

  const toggleSticker = (id: StickerId) => {
    setStickers((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const gestureKey = gestureLabelKey(currentGesture)
  const live = camera === 'live'

  const inspector = (
    <StudioInspector
      currentGesture={currentGesture}
      gestureEnabled={gesturesEnabled}
      hands={hands}
      faces={faces}
      fps={fps}
      inferenceMs={inferenceMs}
      faceMs={faceMs}
      delegate={delegate}
      captureWidth={captureWidth}
      captureHeight={captureHeight}
      photoCount={photos.length}
      photoStatus={photoStatus}
      photoError={photoError}
      formatNumber={formatNumber}
    />
  )

  return (
    <Workspace inspector={inspector}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>{t('nav.workspaceGroup')}</span>
            <h1>{t('page.camera.title')}</h1>
            <p>{t('page.camera.lead')}</p>
          </div>

          <div className={styles.headerActions}>
            <label className={styles.device}>
              <span className={styles.srOnly}>{t('settings.cameraDevice')}</span>
              <SelectControl
                ariaLabel={t('settings.cameraDevice')}
                value={deviceId ?? ''}
                onChange={(value) => useSettings.getState().setCamera({ deviceId: value || null })}
                options={deviceOptions}
              />
            </label>
            {camera === 'idle' ? (
              <Button
                variant="primary"
                icon={<Camera aria-hidden="true" />}
                onClick={() => void engine.start()}
              >
                {t('vision.start')}
              </Button>
            ) : null}
            {camera === 'error' ? (
              <Button
                variant="primary"
                icon={<RefreshCw aria-hidden="true" />}
                onClick={() => void engine.retry()}
              >
                {t('vision.retry')}
              </Button>
            ) : null}
            {camera === 'starting' ? (
              <Button variant="secondary" onClick={() => engine.stop()}>
                {t('vision.cancel')}
              </Button>
            ) : null}
            {live || camera === 'paused' ? (
              <Button
                variant="secondary"
                icon={<CameraOff aria-hidden="true" />}
                onClick={() => engine.stop()}
              >
                {t('vision.stop')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              icon={<Camera aria-hidden="true" />}
              disabled={!live || capturing}
              onClick={() => void savePhoto()}
            >
              {capturing ? t('cam.saving') : t('cam.capture')}
            </Button>
          </div>
        </header>

        <div className={styles.body}>
          <StudioStage
            ref={stageRef}
            filter={filter}
            strength={strength}
            stickers={stickers}
            effectEnabled={effectEnabled}
            countdown={countdown}
          />

          <div className={styles.statusBar}>
            <span className={styles.gesture} data-active={currentGesture !== 'none'}>
              <Sparkles aria-hidden="true" />
              {t(gestureKey)}
            </span>
            {countdown !== null ? (
              <span className={styles.countdownChip}>
                <Timer aria-hidden="true" />
                {t('cam.countdownHint')}
              </span>
            ) : null}
            <span className={styles.spacer} />
            {live ? (
              <span className="mono">
                {captureWidth}×{captureHeight}
              </span>
            ) : null}
            {live && tracking !== 'loading' ? (
              <span className="mono">{t('vision.fps', { value: formatNumber(fps) })}</span>
            ) : null}
            {delegate ? <span className={styles.delegate}>{delegate === 'gpu' ? 'GPU' : 'CPU'}</span> : null}
          </div>

          {controlsVisible ? (
            <div className={styles.trays}>
              <section className={styles.tray} aria-label={t('cam.filters')}>
                <div className={styles.trayHead}>
                  <h2>{t('cam.filters')}</h2>
                  <div className={styles.trayTools}>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      aria-label={t('cam.previousFilter')}
                      onClick={() => shiftFilter(-1)}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </Button>
                    <Button
                      size="iconSm"
                      variant="ghost"
                      aria-label={t('cam.nextFilter')}
                      onClick={() => shiftFilter(1)}
                    >
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className={styles.chips}>
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.chip}
                      data-active={item.id === filterId}
                      aria-pressed={item.id === filterId}
                      onClick={() => setFilterId(item.id)}
                    >
                      <span className={styles.swatch} style={{ background: item.swatch }} />
                      <span className={styles.chipLabel}>{t(item.labelKey)}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.strength}>
                  <Slider
                    label={t('cam.filterStrength')}
                    value={Math.round(strength * 100)}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(value) => setStrength(value / 100)}
                    format={(value) => `${formatNumber(value)}%`}
                  />
                </div>
              </section>

              <section className={styles.tray} aria-label={t('cam.stickers')}>
                <div className={styles.trayHead}>
                  <h2>{t('cam.stickers')}</h2>
                  <Toggle
                    checked={effectEnabled}
                    onChange={setEffectEnabled}
                    label={t('cam.effectsEnabled')}
                  />
                </div>
                <div className={styles.chips}>
                  {STICKERS.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      className={styles.chip}
                      data-active={stickers.includes(sticker.id)}
                      aria-pressed={stickers.includes(sticker.id)}
                      disabled={!effectEnabled}
                      onClick={() => toggleSticker(sticker.id)}
                    >
                      <span className={styles.chipLabel}>{t(sticker.labelKey)}</span>
                    </button>
                  ))}
                </div>
                <p className={styles.trayNote}>{t('cam.stickerNote')}</p>
              </section>
            </div>
          ) : null}

          <section className={styles.recent} aria-label={t('cam.recent')}>
            <div className={styles.trayHead}>
              <h2>
                <ImageIcon aria-hidden="true" />
                {t('cam.recent')}
              </h2>
              <span className={styles.trayNote}>
                {t('cam.photoCount', { count: formatNumber(photos.length) })}
              </span>
            </div>
            {photos.length === 0 ? (
              <p className={styles.trayNote}>{t('cam.noPhotos')}</p>
            ) : (
              <div className={styles.recentList}>
                {photos.slice(0, 8).map((photo) => (
                  <RecentShot key={photo.id} photo={photo} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {notice ? (
        <div className={styles.toast} role="status">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label={t('common.close')}>
            {t('common.close')}
          </button>
        </div>
      ) : null}
    </Workspace>
  )
}

function RecentShot({ photo }: { photo: PhotoRecord }) {
  const { formatDate } = useI18n()
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo.thumb)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo.thumb])

  return (
    <figure className={styles.recentItem}>
      {url ? <img src={url} alt={photo.name} /> : null}
      <figcaption>{formatDate(photo.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</figcaption>
    </figure>
  )
}

function gestureLabelKey(gesture: StaticGestureId): MessageKey {
  switch (gesture) {
    case 'open-palm':
      return 'gesture.openPalm'
    case 'fist':
      return 'gesture.fist'
    case 'point':
      return 'gesture.point'
    case 'peace':
      return 'gesture.peace'
    case 'thumbs-up':
      return 'gesture.thumbsUp'
    case 'pinch':
      return 'gesture.pinch'
    case 'three':
      return 'gesture.three'
    default:
      return 'gesture.none'
  }
}
