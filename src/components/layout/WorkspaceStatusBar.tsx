import { useEffect } from 'react'
import { useI18n } from '@/localization/i18n'
import { useSigns } from '@/signs/store'
import { useVisionStatus } from '@/vision/visionStatus'
import styles from './shell.module.css'

/**
 * One status strip under every workspace. It reads the same stores the pages
 * read, so it can only report measured state: no invented accuracy, no assumed
 * camera, and no pose claim until a shoulder frame actually exists.
 */
export function WorkspaceStatusBar() {
  const { t, formatNumber } = useI18n()
  const model = useSigns((state) => state.model)
  const labelCount = useSigns((state) => state.labels.length)
  const signsStatus = useSigns((state) => state.status)
  const hands = useVisionStatus((state) => state.hands)
  const fps = useVisionStatus((state) => state.fps)
  const pose = useVisionStatus((state) => state.poseTracking)
  const shoulderFrameReady = useVisionStatus((state) => state.shoulderFrameReady)

  useEffect(() => {
    void useSigns.getState().init()
  }, [])

  const modelText = model
    ? t('status.modelReady', {
        signs: formatNumber(model.labels.length),
        labels: formatNumber(labelCount),
      })
    : signsStatus === 'error'
      ? t('status.modelError')
      : t('status.modelNone')

  const poseText =
    pose === 'off'
      ? t('status.poseOff')
      : shoulderFrameReady
        ? t('status.poseReady')
        : t('status.posePending')

  return (
    <footer className={styles.statusBar} aria-label={t('status.barLabel')}>
      <span className={styles.statusItem}>
        {t('status.model')}
        <strong>{modelText}</strong>
      </span>
      <span className={styles.statusItem}>
        {t('status.tracking')}
        <strong>
          {t('status.handsFps', {
            hands: formatNumber(hands),
            fps: formatNumber(Math.round(fps)),
          })}
        </strong>
      </span>
      <span className={styles.statusItem}>
        {t('status.pose')}
        <strong>{poseText}</strong>
      </span>
      <span className={styles.statusSpacer} />
      <span className={styles.statusItem}>{t('footer.local')}</span>
    </footer>
  )
}
