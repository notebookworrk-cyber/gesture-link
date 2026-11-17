import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Crosshair, Save, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Workspace } from '@/components/layout/Workspace'
import { Button } from '@/components/ui/Button'
import { CameraPreview } from '@/components/vision/CameraPreview'
import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import {
  clearProfile,
  createProfile,
  loadProfile,
  saveProfile,
  type CalibrationProfile,
} from '@/vision/calibration'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import styles from './calibration.module.css'

/**
 * Six guided steps. The four reach steps each record a short burst of palm
 * positions; the setup and review steps only explain and confirm. Nothing is
 * estimated: a step with no recorded samples cannot be completed.
 */
type StepId = 'setup' | 'left' | 'right' | 'top' | 'bottom' | 'review'

interface Step {
  id: StepId
  titleKey: MessageKey
  bodyKey: MessageKey
}

const STEPS: Step[] = [
  { id: 'setup', titleKey: 'calibration.stepSetup', bodyKey: 'calibration.setupBody' },
  { id: 'left', titleKey: 'calibration.stepLeft', bodyKey: 'calibration.leftBody' },
  { id: 'right', titleKey: 'calibration.stepRight', bodyKey: 'calibration.rightBody' },
  { id: 'top', titleKey: 'calibration.stepTop', bodyKey: 'calibration.topBody' },
  { id: 'bottom', titleKey: 'calibration.stepBottom', bodyKey: 'calibration.bottomBody' },
  { id: 'review', titleKey: 'calibration.stepReview', bodyKey: 'calibration.reviewBody' },
]

const CAPTURE_STEPS: StepId[] = ['left', 'right', 'top', 'bottom']
const CAPTURE_MS = 1200

type Captures = Record<StepId, Array<{ x: number; y: number }>>

const emptyCaptures = (): Captures => ({
  setup: [],
  left: [],
  right: [],
  top: [],
  bottom: [],
  review: [],
})

export function CalibrationPage() {
  const { t, formatNumber, formatDate } = useI18n()
  const engine = getVisionEngine()

  const camera = useVisionStatus((state) => state.camera)
  const hands = useVisionStatus((state) => state.hands)
  const shoulderFrameReady = useVisionStatus((state) => state.shoulderFrameReady)

  const [stepIndex, setStepIndex] = useState(0)
  const [captures, setCaptures] = useState<Captures>(emptyCaptures)
  const [recordingStep, setRecordingStep] = useState<StepId | null>(null)
  const [profile, setProfile] = useState<CalibrationProfile | null>(() => loadProfile())
  const [notice, setNotice] = useState<string | null>(null)

  const step = STEPS[stepIndex]!
  const recordingStepRef = useRef<StepId | null>(null)
  recordingStepRef.current = recordingStep

  // A stored profile applies to the engine as soon as the page opens.
  useEffect(() => {
    engine.setCalibration(profile)
  }, [engine, profile])

  useEffect(
    () =>
      engine.subscribeFrames((frame) => {
        const target = recordingStepRef.current
        if (!target) return
        const hand = frame.hands[0]
        if (!hand) return
        setCaptures((current) => ({
          ...current,
          [target]: [...current[target], { ...hand.palmCenter }],
        }))
      }),
    [engine],
  )

  useEffect(() => {
    if (!recordingStep) return
    const timer = window.setTimeout(() => setRecordingStep(null), CAPTURE_MS)
    return () => window.clearTimeout(timer)
  }, [recordingStep])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const startCapture = useCallback(() => {
    if (camera !== 'live' || hands === 0) return
    setCaptures((current) => ({ ...current, [step.id]: [] }))
    setRecordingStep(step.id)
  }, [camera, hands, step.id])

  const allSamples = CAPTURE_STEPS.flatMap((id) => captures[id])
  const capturedCorners = CAPTURE_STEPS.filter((id) => captures[id].length > 0).length

  const canAdvance = step.id === 'setup' || step.id === 'review' || captures[step.id].length > 0

  const save = useCallback(() => {
    const created = createProfile(allSamples, Date.now())
    if (!created) {
      setNotice(t('calibration.tooSparse'))
      return
    }
    saveProfile(created)
    setProfile(created)
    setNotice(t('calibration.saved'))
  }, [allSamples, t])

  const clear = useCallback(() => {
    clearProfile()
    setProfile(null)
    setCaptures(emptyCaptures())
    setStepIndex(0)
    setNotice(t('calibration.cleared'))
  }, [t])

  return (
    <Workspace>
      <div className={styles.page}>
        <PageHeader
          eyebrow={t('nav.systemGroup')}
          title={t('page.calibration.title')}
          lead={t('page.calibration.lead')}
        />

        <div className={styles.body}>
          <div className={styles.layout}>
            <section className={styles.previewColumn}>
              <CameraPreview />
              <p className={styles.note}>{t('calibration.captureHint')}</p>
              <p className={styles.note}>{t('calibration.limits')}</p>
            </section>

            <div className={styles.mainColumn}>
              <section className={styles.card} aria-label={t('calibration.steps')}>
                <div className={styles.cardHead}>
                  <h2>{t(step.titleKey)}</h2>
                  <span className={styles.stepCount}>
                    {t('calibration.stepOf', {
                      current: formatNumber(stepIndex + 1),
                      total: formatNumber(STEPS.length),
                    })}
                  </span>
                </div>

                <ol className={styles.stepList}>
                  {STEPS.map((item, index) => (
                    <li
                      key={item.id}
                      data-state={
                        index === stepIndex ? 'current' : index < stepIndex ? 'done' : 'todo'
                      }
                    >
                      <span className={styles.stepIndex}>{formatNumber(index + 1)}</span>
                      <span className={styles.stepName}>{t(item.titleKey)}</span>
                      {CAPTURE_STEPS.includes(item.id) ? (
                        <span className={styles.stepSamples}>
                          {t('calibration.sampleCount', {
                            count: formatNumber(captures[item.id].length),
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>

                <p className={styles.instructions}>{t(step.bodyKey)}</p>

                {step.id === 'setup' ? (
                  <ul className={styles.checkList}>
                    <li data-ok={camera === 'live'}>
                      <Check aria-hidden="true" />
                      {t('calibration.checkCamera')}
                    </li>
                    <li data-ok={hands > 0}>
                      <Check aria-hidden="true" />
                      {t('calibration.checkHand')}
                    </li>
                    <li data-ok={shoulderFrameReady}>
                      <Check aria-hidden="true" />
                      {t('calibration.checkShoulders')}
                    </li>
                  </ul>
                ) : null}

                {CAPTURE_STEPS.includes(step.id) ? (
                  <div className={styles.capture}>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Crosshair aria-hidden="true" />}
                      disabled={camera !== 'live' || hands === 0 || recordingStep !== null}
                      onClick={startCapture}
                    >
                      {recordingStep === step.id
                        ? t('calibration.recording')
                        : captures[step.id].length > 0
                          ? t('calibration.recapture')
                          : t('calibration.record')}
                    </Button>
                    <span className={styles.captureState} role="status">
                      {camera !== 'live'
                        ? t('calibration.needCamera')
                        : hands === 0
                          ? t('calibration.needHand')
                          : recordingStep === step.id
                            ? t('calibration.holdStill')
                            : t('calibration.ready')}
                    </span>
                  </div>
                ) : null}

                {step.id === 'review' ? (
                  <div className={styles.review}>
                    <p className={styles.reviewLine}>
                      {t('calibration.reviewSamples', { count: formatNumber(allSamples.length) })}
                    </p>
                    <p className={styles.reviewLine}>
                      {t('calibration.reviewCorners', { count: formatNumber(capturedCorners) })}
                    </p>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Save aria-hidden="true" />}
                      disabled={allSamples.length < 8 || capturedCorners < 4 || recordingStep !== null}
                      onClick={save}
                    >
                      {t('calibration.save')}
                    </Button>
                  </div>
                ) : null}

                <div className={styles.nav}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<ArrowLeft aria-hidden="true" />}
                    disabled={stepIndex === 0}
                    onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                  >
                    {t('calibration.back')}
                  </Button>
                  <span className={styles.spacer} />
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ArrowRight aria-hidden="true" />}
                    disabled={!canAdvance || stepIndex === STEPS.length - 1}
                    onClick={() => setStepIndex((index) => Math.min(STEPS.length - 1, index + 1))}
                  >
                    {t('calibration.next')}
                  </Button>
                </div>
              </section>

              <section className={styles.card} aria-label={t('calibration.savedProfile')}>
                <div className={styles.cardHead}>
                  <h2>{t('calibration.savedProfile')}</h2>
                  {profile ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 aria-hidden="true" />}
                      onClick={clear}
                    >
                      {t('calibration.clear')}
                    </Button>
                  ) : null}
                </div>
                {profile ? (
                  <>
                    <p className={styles.reviewLine}>
                      {t('calibration.savedOn', { date: formatDate(profile.createdAt) })}
                    </p>
                    <p className={styles.reviewLine}>
                      {t('calibration.savedSamples', { count: formatNumber(profile.samples) })}
                    </p>
                  </>
                ) : (
                  <p className={styles.note}>{t('calibration.noProfile')}</p>
                )}
                <p className={styles.note}>
                  {t('calibration.retake')}{' '}
                  <Link className={styles.link} to="/settings?section=tracking">
                    {t('calibration.settingsLink')}
                  </Link>
                </p>
              </section>
            </div>
          </div>
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
