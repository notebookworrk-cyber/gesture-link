import { useEffect, useRef } from 'react'
import { Camera, CameraOff, LoaderCircle, RefreshCw, ScanLine, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { useSettings } from '@/settings/settingsStore'
import { visionErrorKey } from '@/vision/labels'
import { drawHandOverlay } from '@/vision/overlay'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import styles from './cameraPreview.module.css'

interface CameraPreviewProps {
  /** Overrides the tracking setting; used by workspaces with their own toggle. */
  showLandmarks?: boolean
  compact?: boolean
  className?: string
}

type Tone = 'neutral' | 'ok' | 'warn' | 'danger'

export function CameraPreview({ showLandmarks, compact = false, className }: CameraPreviewProps) {
  const { t, formatNumber } = useI18n()
  const engine = getVisionEngine()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const camera = useVisionStatus((state) => state.camera)
  const tracking = useVisionStatus((state) => state.tracking)
  const hands = useVisionStatus((state) => state.hands)
  const fps = useVisionStatus((state) => state.fps)
  const inferenceMs = useVisionStatus((state) => state.inferenceMs)
  const delegate = useVisionStatus((state) => state.delegate)
  const captureWidth = useVisionStatus((state) => state.captureWidth)
  const captureHeight = useVisionStatus((state) => state.captureHeight)
  const processingWidth = useVisionStatus((state) => state.processingWidth)
  const error = useVisionStatus((state) => state.error)

  const mirror = useSettings((state) => state.camera.mirror)
  const landmarkSetting = useSettings((state) => state.tracking.showLandmarks)
  const show = showLandmarks ?? landmarkSetting

  const mirrorRef = useRef(mirror)
  const showRef = useRef(show)
  useEffect(() => {
    mirrorRef.current = mirror
    showRef.current = show
  }, [mirror, show])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    return engine.bindPreview(video)
  }, [engine])

  // Mounting the preview is a lease on the shared session. With auto-release
  // enabled, leaving the route stops the camera instead of leaving it on.
  useEffect(() => engine.acquire(), [engine])

  useEffect(
    () =>
      engine.subscribeFrames((frame) => {
        const canvas = canvasRef.current
        const video = videoRef.current
        if (!canvas || !video) return
        drawHandOverlay(canvas, frame, {
          mirror: mirrorRef.current,
          showLandmarks: showRef.current,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        })
      }),
    [engine],
  )

  useEffect(() => {
    if (camera === 'live') return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height)
  }, [camera])

  const isLive = camera === 'live'
  const state = describeState(camera, tracking)
  const errorText = error ? t(visionErrorKey(error.code)) : null

  return (
    <section
      className={[styles.preview, className].filter(Boolean).join(' ')}
      data-compact={compact}
      data-camera={camera}
      data-tracking={tracking}
      data-hands={hands}
      data-fps={fps}
      data-inference-ms={inferenceMs}
      data-processing-width={processingWidth}
      data-capture-width={captureWidth}
      data-capture-height={captureHeight}
      data-delegate={delegate ?? 'none'}
    >
      <div className={styles.head}>
        <span className={styles.title}>
          <ScanLine aria-hidden="true" />
          {t('vision.previewTitle')}
        </span>
        <span className={styles.state} data-tone={state.tone} role="status">
          <i aria-hidden="true" />
          {t(state.key)}
        </span>
      </div>

      <div className={styles.stage}>
        <video
          ref={videoRef}
          className={styles.video}
          data-mirror={mirror}
          muted
          playsInline
          autoPlay
          aria-label={t('vision.previewLabel')}
        />
        <canvas ref={canvasRef} className={styles.overlay} aria-hidden="true" />
        {camera !== 'live' ? (
          <div className={styles.placeholder}>
            {camera === 'starting' ? (
              <>
                <LoaderCircle aria-hidden="true" className={styles.spinner} />
                <strong>{t('vision.starting')}</strong>
                <span>{t('vision.startingBody')}</span>
              </>
            ) : camera === 'error' ? (
              <>
                <TriangleAlert aria-hidden="true" className={styles.alertIcon} />
                <strong>{errorText ?? t('vision.errorUnknown')}</strong>
                <span>{t('vision.errorBody')}</span>
              </>
            ) : camera === 'paused' ? (
              <>
                <CameraOff aria-hidden="true" />
                <strong>{t('vision.pausedTitle')}</strong>
                <span>{t('vision.pausedBody')}</span>
              </>
            ) : (
              <>
                <Camera aria-hidden="true" />
                <strong>{t('vision.offTitle')}</strong>
                <span>{t('vision.offBody')}</span>
                <span className={styles.hint}>{t('vision.permissionHint')}</span>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className={styles.bar}>
        <div className={styles.stats}>
          {isLive && captureWidth > 0 ? (
            <span className="mono">
              {captureWidth}×{captureHeight}
            </span>
          ) : null}
          {isLive && tracking !== 'loading' ? (
            <>
              <span className="mono">{t('vision.fps', { value: formatNumber(fps) })}</span>
              <span className="mono">{t('vision.frameTime', { value: inferenceMs })}</span>
              <span>
                {hands > 0
                  ? t(hands === 1 ? 'vision.handCountOne' : 'vision.handCountOther', {
                      count: formatNumber(hands),
                    })
                  : t('vision.noHand')}
              </span>
              {processingWidth > 0 ? (
                <span>
                  {t('vision.processing', { width: formatNumber(processingWidth) })}
                </span>
              ) : null}
              {delegate ? (
                <span className={styles.delegate} data-delegate={delegate}>
                  {delegate === 'gpu' ? 'GPU' : 'CPU'}
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        <div className={styles.actions}>
          {camera === 'idle' ? (
            <Button
              size="sm"
              variant="primary"
              icon={<Camera aria-hidden="true" />}
              onClick={() => void engine.start()}
            >
              {t('vision.start')}
            </Button>
          ) : null}
          {camera === 'error' ? (
            <Button
              size="sm"
              variant="primary"
              icon={<RefreshCw aria-hidden="true" />}
              onClick={() => void engine.retry()}
            >
              {t('vision.retry')}
            </Button>
          ) : null}
          {camera === 'starting' ? (
            <Button size="sm" variant="secondary" onClick={() => engine.stop()}>
              {t('vision.cancel')}
            </Button>
          ) : null}
          {isLive || camera === 'paused' ? (
            <>
              {tracking === 'error' ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<RefreshCw aria-hidden="true" />}
                  onClick={() => void engine.retry()}
                >
                  {t('vision.retry')}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={tracking === 'error' ? 'ghost' : 'secondary'}
                icon={<CameraOff aria-hidden="true" />}
                onClick={() => engine.stop()}
              >
                {t('vision.stop')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error && camera === 'live' ? (
        <p className={styles.error} role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>{errorText}</span>
        </p>
      ) : null}
    </section>
  )
}

function describeState(
  camera: ReturnType<typeof useVisionStatus.getState>['camera'],
  tracking: ReturnType<typeof useVisionStatus.getState>['tracking'],
): { key: MessageKey; tone: Tone } {
  if (camera === 'starting') return { key: 'vision.starting', tone: 'warn' }
  if (camera === 'error' || tracking === 'error') return { key: 'vision.error', tone: 'danger' }
  if (camera === 'paused') return { key: 'vision.paused', tone: 'neutral' }
  if (camera !== 'live') return { key: 'vision.off', tone: 'neutral' }
  if (tracking === 'loading') return { key: 'vision.loadingModel', tone: 'warn' }
  return { key: 'vision.live', tone: 'ok' }
}
