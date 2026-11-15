import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { CameraOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useI18n } from '@/localization/i18n'
import { useSettings } from '@/settings/settingsStore'
import { accentColor, drawComposition, renderCapture } from '@/photos/compose'
import { canvasToBlob, makeThumbnail } from '@/photos/capture'
import type { FilterDefinition, StickerId } from '@/photos/types'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import type { FaceReading, HandReading } from '@/vision/types'
import styles from './camera.module.css'

export interface CapturedFrame {
  blob: Blob
  thumb: Blob
  width: number
  height: number
}

export interface StudioStageHandle {
  /** Renders the current frame at full resolution and returns the blobs. */
  capture: () => Promise<CapturedFrame | null>
}

interface StudioStageProps {
  filter: FilterDefinition
  strength: number
  stickers: StickerId[]
  effectEnabled: boolean
  /** Seconds left in the capture countdown, or null when idle. */
  countdown: number | null
}

export const StudioStage = forwardRef<StudioStageHandle, StudioStageProps>(
  function StudioStage({ filter, strength, stickers, effectEnabled, countdown }, ref) {
    const { t } = useI18n()
    const engine = getVisionEngine()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const handsRef = useRef<HandReading[]>([])
    const faceRef = useRef<FaceReading | null>(null)
    const rafRef = useRef(0)

    const camera = useVisionStatus((state) => state.camera)
    const tracking = useVisionStatus((state) => state.tracking)
    const captureWidth = useVisionStatus((state) => state.captureWidth)
    const captureHeight = useVisionStatus((state) => state.captureHeight)

    const mirror = useSettings((state) => state.camera.mirror)
    const showLandmarks = useSettings((state) => state.tracking.showLandmarks)

    const optionsRef = useRef({ filter, strength, stickers, effectEnabled, mirror, showLandmarks })
    optionsRef.current = { filter, strength, stickers, effectEnabled, mirror, showLandmarks }

    useEffect(() => {
      const video = videoRef.current
      if (!video) return
      return engine.bindPreview(video)
    }, [engine])

    // Mounting the studio is a lease on the shared camera session.
    useEffect(() => engine.acquire(), [engine])

    useEffect(
      () =>
        engine.subscribeFrames((frame) => {
          handsRef.current = frame.hands
          faceRef.current = frame.faces[0] ?? null
        }),
      [engine],
    )

    // Faces are only needed for the sticker anchors, so the face model is
    // requested here and released when the studio is closed.
    useEffect(() => {
      void engine.setFaceTracking(true)
      return () => {
        void engine.setFaceTracking(false)
      }
    }, [engine])

    // The preview runs on its own animation loop so the image stays smooth
    // even when inference is slower than the display refresh.
    useEffect(() => {
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop)
        const canvas = canvasRef.current
        const video = videoRef.current
        if (!canvas || !video) return
        const rect = canvas.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const width = Math.round(rect.width * dpr)
        const height = Math.round(rect.height * dpr)
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const current = optionsRef.current
        drawComposition(ctx, video, width, height, {
          mirror: current.mirror,
          filter: current.filter,
          strength: current.strength,
          stickers: current.effectEnabled ? current.stickers : [],
          face: faceRef.current,
          hands: current.showLandmarks ? handsRef.current : [],
          showLandmarks: current.showLandmarks,
          accent: accentColor(),
        })
      }
      rafRef.current = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(rafRef.current)
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        capture: async () => {
          const video = videoRef.current
          if (!video || video.readyState < 2 || video.videoWidth === 0) return null
          const current = optionsRef.current
          const canvas = renderCapture(video, {
            mirror: current.mirror,
            filter: current.filter,
            strength: current.strength,
            stickers: current.effectEnabled ? current.stickers : [],
            face: faceRef.current,
            hands: current.showLandmarks ? handsRef.current : [],
            showLandmarks: current.showLandmarks,
            accent: accentColor(),
          })
          const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
          const thumb = await makeThumbnail(canvas)
          return { blob, thumb, width: canvas.width, height: canvas.height }
        },
      }),
      [],
    )

    const aspect =
      captureWidth > 0 && captureHeight > 0
        ? `${captureWidth} / ${captureHeight}`
        : '16 / 9'

    return (
      <div className={styles.stage} data-camera={camera}>
        <video ref={videoRef} className={styles.source} muted playsInline autoPlay aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ aspectRatio: aspect }}
          role="img"
          aria-label={t('cam.previewLabel')}
        />
        {countdown !== null ? (
          <div className={styles.countdown} role="status" aria-live="assertive">
            <span>{countdown}</span>
          </div>
        ) : null}
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
                <strong>{t('vision.error')}</strong>
                <span>{t('vision.errorBody')}</span>
              </>
            ) : (
              <>
                <CameraOff aria-hidden="true" />
                <strong>{t('vision.offTitle')}</strong>
                <span>{t('vision.offBody')}</span>
              </>
            )}
          </div>
        ) : null}
        {camera === 'live' && tracking === 'loading' ? (
          <div className={styles.loadingBadge} role="status">
            <LoaderCircle aria-hidden="true" className={styles.spinner} />
            {t('vision.loadingModel')}
          </div>
        ) : null}
      </div>
    )
  },
)
