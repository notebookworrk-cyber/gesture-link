import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { Button } from '@/components/ui/Button'
import { DetailList } from '@/components/layout/DetailList'
import { Panel } from '@/components/ui/Panel'
import {
  CAMERA_GESTURE_ACTIONS,
  conflictingBindings,
  useSettings,
  type CameraGestureAction,
  type GestureBinding,
} from '@/settings/settingsStore'
import type { PhotoStoreStatus } from '@/photos/types'
import type { StaticGestureId } from '@/vision/types'
import styles from './camera.module.css'

interface StudioInspectorProps {
  currentGesture: StaticGestureId
  gestureEnabled: boolean
  hands: number
  faces: number
  fps: number
  inferenceMs: number
  faceMs: number
  delegate: 'gpu' | 'cpu' | null
  captureWidth: number
  captureHeight: number
  photoCount: number
  photoStatus: PhotoStoreStatus
  photoError: string | null
  formatNumber: (value: number) => string
}

const GESTURE_OPTIONS: StaticGestureId[] = [
  'none',
  'open-palm',
  'fist',
  'point',
  'peace',
  'thumbs-up',
  'pinch',
  'three',
]

export function StudioInspector({
  currentGesture,
  gestureEnabled,
  hands,
  faces,
  fps,
  inferenceMs,
  faceMs,
  delegate,
  captureWidth,
  captureHeight,
  photoCount,
  photoStatus,
  photoError,
  formatNumber,
}: StudioInspectorProps) {
  const { t } = useI18n()
  const bindings = useSettings((state) => state.gestures.bindings)
  const setGestureBinding = useSettings((state) => state.setGestureBinding)
  const setGestures = useSettings((state) => state.setGestures)
  const conflicts = conflictingBindings(bindings)

  return (
    <>
      <Panel title={t('cam.inspectorLive')}>
        <DetailList
          items={[
            {
              label: t('cam.inspectorGesture'),
              value: t(gestureLabelKey(currentGesture)),
            },
            {
              label: t('vision.handCountOther', { count: formatNumber(hands) }),
              value: formatNumber(hands),
            },
            { label: t('cam.inspectorFaces'), value: formatNumber(faces) },
            { label: t('vision.fps', { value: formatNumber(fps) }), value: formatNumber(fps) },
            {
              label: t('vision.frameTime', { value: formatNumber(inferenceMs) }),
              value: formatNumber(inferenceMs),
            },
            { label: t('cam.faceTime'), value: formatNumber(faceMs) },
            {
              label: t('cam.inspectorDelegate'),
              value: delegate ? (delegate === 'gpu' ? 'GPU' : 'CPU') : t('common.notAvailable'),
            },
            {
              label: t('cam.inspectorSize'),
              value: captureWidth > 0 ? `${captureWidth}×${captureHeight}` : t('common.notAvailable'),
            },
          ]}
        />
      </Panel>

      <Panel
        title={t('cam.inspectorBindings')}
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setGestures({ enabled: !gestureEnabled })}
          >
            {gestureEnabled ? t('common.on') : t('common.off')}
          </Button>
        }
      >
        <p className={styles.inspectorNote}>{t('cam.bindingHint')}</p>
        <div className={styles.bindingList}>
          {CAMERA_GESTURE_ACTIONS.map((action) => (
            <label key={action} className={styles.bindingRow}>
              <span>{t(actionLabelKey(action))}</span>
              <select
                className={styles.bindingSelect}
                value={bindings[action]}
                aria-label={t(actionLabelKey(action))}
                disabled={!gestureEnabled}
                onChange={(event) =>
                  setGestureBinding(action, event.target.value as GestureBinding)
                }
              >
                {GESTURE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'none' ? t('cam.bindingNone') : t(gestureLabelKey(option))}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {conflicts.length > 0 ? (
          <p className={styles.conflict} role="alert">
            {t('cam.bindingConflict')}
          </p>
        ) : null}
      </Panel>

      <Panel title={t('cam.inspectorStorage')}>
        <DetailList
          items={[
            { label: t('cam.photoCount', { count: formatNumber(photoCount) }), value: formatNumber(photoCount) },
            {
              label: t('status.label'),
              value: t(photoStatusKey(photoStatus)),
            },
          ]}
        />
        {photoError ? (
          <p className={styles.conflict} role="alert">
            {photoError}
          </p>
        ) : null}
        <p className={styles.inspectorNote}>{t('cam.storageNote')}</p>
      </Panel>
    </>
  )
}

function actionLabelKey(action: CameraGestureAction): MessageKey {
  switch (action) {
    case 'capture':
      return 'cam.actionCapture'
    case 'nextFilter':
      return 'cam.actionNextFilter'
    case 'previousFilter':
      return 'cam.actionPreviousFilter'
    case 'toggleControls':
      return 'cam.actionToggleControls'
    case 'toggleEffect':
      return 'cam.actionToggleEffect'
  }
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

function photoStatusKey(status: PhotoStoreStatus): MessageKey {
  switch (status) {
    case 'ready':
      return 'status.ready'
    case 'loading':
      return 'common.loading'
    case 'error':
      return 'status.degraded'
    default:
      return 'status.unknown'
  }
}
