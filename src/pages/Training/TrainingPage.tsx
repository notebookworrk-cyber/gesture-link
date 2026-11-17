import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  CircleStop,
  Play,
  Plus,
  Square,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SelectControl, Toggle } from '@/components/ui/Controls'
import { Panel } from '@/components/ui/Panel'
import { Workspace } from '@/components/layout/Workspace'
import { CameraPreview } from '@/components/vision/CameraPreview'
import { useI18n } from '@/localization/i18n'
import { toArray, windowFrameFromReading } from '@/signs/features'
import { twoHandFrameFromUpdate } from '@/recognition/TemporalFeatureExtractor'
import { trackerOptionsFrom } from '@/recognition/config'
import { TwoHandTracker } from '@/recognition/TwoHandTracker'
import { windowsFromTake } from '@/signs/windowBuffer'
import { useSigns } from '@/signs/store'
import { useSettings } from '@/settings/settingsStore'
import type { SignCategory, SignLabel, SignSample } from '@/signs/types'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import { TrainingInspector } from './TrainingInspector'
import styles from './training.module.css'

/** Frames kept per take; about 10 s at 30 Hz, enough for one sign. */
const MAX_TAKE_FRAMES = 300

export function TrainingPage() {
  const { t, formatNumber, formatDate } = useI18n()
  const engine = getVisionEngine()

  const camera = useVisionStatus((state) => state.camera)

  const labels = useSigns((state) => state.labels)
  const samples = useSigns((state) => state.samples)
  const model = useSigns((state) => state.model)
  const evaluation = useSigns((state) => state.evaluation)
  const error = useSigns((state) => state.error)
  const addLabel = useSigns((state) => state.addLabel)
  const removeLabel = useSigns((state) => state.removeLabel)
  const addSamples = useSigns((state) => state.addSamples)
  const removeSamples = useSigns((state) => state.removeSamples)
  const clearAllSamples = useSigns((state) => state.clearAllSamples)
  const train = useSigns((state) => state.train)
  const evaluate = useSigns((state) => state.evaluate)

  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SignCategory>('custom')
  const [capturing, setCapturing] = useState(false)
  const [takeCount, setTakeCount] = useState(0)
  const [prototypesPerLabel, setPrototypesPerLabel] = useState(5)
  const [unknownThreshold, setUnknownThreshold] = useState(0.6)
  const [trainShare, setTrainShare] = useState(70)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const takeRef = useRef<string | null>(null)
  const takeFramesRef = useRef<Array<{ timestamp: number; vector: Float32Array }>>([])
  const twoHandTrackerRef = useRef<TwoHandTracker | null>(null)
  const recognition = useSettings((state) => state.recognition)
  const mirror = useSettings((state) => state.camera.mirror)
  const takeStartedAtRef = useRef(0)
  const takeHandednessRef = useRef<SignSample['handedness']>('Right')
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedLabelId

  useEffect(() => {
    void useSigns.getState().init()
  }, [])

  // Keep the selected label valid when labels change.
  useEffect(() => {
    if (!selectedLabelId) return
    if (!labels.some((label) => label.id === selectedLabelId)) setSelectedLabelId(null)
  }, [labels, selectedLabelId])

  // Capture: every frame with a hand is kept as part of the current take. The
  // take becomes time-normalised windows when it stops, so speed and a short
  // pause inside a sign do not create separate samples.
  useEffect(
    () =>
      engine.subscribeFrames((frame) => {
        if (!takeRef.current) return
        if (takeFramesRef.current.length >= MAX_TAKE_FRAMES) return
        if (recognition.twoHandMode) {
          if (!twoHandTrackerRef.current) {
            twoHandTrackerRef.current = new TwoHandTracker(
              trackerOptionsFrom(recognition, mirror),
            )
          }
          const update = twoHandTrackerRef.current.update(frame)
          const vector = twoHandFrameFromUpdate(update)
          if (!vector) return
          takeFramesRef.current.push({ timestamp: frame.timestamp, vector })
          setTakeCount(takeFramesRef.current.length)
          return
        }
        const hand = frame.hands[0]
        if (!hand) return
        takeHandednessRef.current = hand.handedness
        takeFramesRef.current.push({
          timestamp: frame.timestamp,
          vector: windowFrameFromReading(hand, frame.hands[1] ?? null),
        })
        setTakeCount(takeFramesRef.current.length)
      }),
    [engine, mirror, recognition],
  )

  const startTake = useCallback(() => {
    if (!selectedLabelId) return
    takeRef.current = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    takeFramesRef.current = []
    twoHandTrackerRef.current?.reset()
    takeStartedAtRef.current = Date.now()
    setTakeCount(0)
    setCapturing(true)
  }, [selectedLabelId])

  const stopTake = useCallback(async () => {
    const labelId = selectedRef.current
    const group = takeRef.current
    const frames = takeFramesRef.current
    takeRef.current = null
    takeFramesRef.current = []
    setCapturing(false)
    if (!labelId || !group) return

    const windows = windowsFromTake(frames)
    if (windows.length === 0) {
      setNotice(t('training.takeTooShort'))
      return
    }

    const createdAt = Date.now()
    const durationMs = createdAt - takeStartedAtRef.current
    const samples: SignSample[] = windows.map((window, index) => ({
      id: `s_${createdAt.toString(36)}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      labelId,
      features: toArray(window),
      handedness: takeHandednessRef.current,
      group,
      createdAt: createdAt + index,
      durationMs,
    }))
    await addSamples(samples)
    setNotice(t('training.takeSaved', { count: formatNumber(samples.length) }))
  }, [addSamples, formatNumber, t])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const addNewLabel = useCallback(async () => {
    const value = name.trim()
    if (!value) return
    const label: SignLabel = {
      id: `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: value,
      category,
      description: description.trim(),
      createdAt: Date.now(),
    }
    await addLabel(label)
    setSelectedLabelId(label.id)
    setName('')
    setDescription('')
    setNotice(t('training.labelAdded'))
  }, [addLabel, category, description, name, t])

  const trainOptions = useMemo(
    () => ({
      prototypesPerLabel,
      unknownThreshold,
      trainShare: trainShare / 100,
    }),
    [prototypesPerLabel, trainShare, unknownThreshold],
  )

  const runTrain = useCallback(async () => {
    setBusy(true)
    const result = await train(trainOptions)
    setBusy(false)
    setNotice(result ? t('training.trained') : t('training.trainFailed'))
  }, [t, train, trainOptions])

  const runEvaluate = useCallback(async () => {
    setBusy(true)
    const result = await evaluate(trainOptions)
    setBusy(false)
    setNotice(result ? t('training.evaluated') : t('training.evaluateFailed'))
  }, [evaluate, t, trainOptions])

  const selectedSamples = useMemo(
    () => samples.filter((sample) => sample.labelId === selectedLabelId),
    [samples, selectedLabelId],
  )

  const takes = useMemo(
    () => new Set(selectedSamples.map((sample) => sample.group)).size,
    [selectedSamples],
  )

  const exportDataset = useCallback(() => {
    const payload = {
      format: 'gesturelink-training',
      version: 1,
      exportedAt: Date.now(),
      labels,
      samples,
      model,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gesturelink-training-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, [labels, model, samples])

  const importDataset = useCallback(
    async (file: File) => {
      try {
        const parsed = JSON.parse(await file.text()) as {
          labels?: SignLabel[]
          samples?: SignSample[]
        }
        const importedLabels = parsed.labels ?? []
        const importedSamples = parsed.samples ?? []
        if (importedLabels.length === 0 && importedSamples.length === 0) {
          setNotice(t('training.importEmpty'))
          return
        }
        for (const label of importedLabels) await addLabel(label)
        if (importedSamples.length > 0) await addSamples(importedSamples)
        setNotice(t('training.imported'))
      } catch {
        setNotice(t('training.importFailed'))
      }
    },
    [addLabel, addSamples, t],
  )

  const inspector = (
    <TrainingInspector
      model={model}
      evaluation={evaluation}
      error={error}
      prototypesPerLabel={prototypesPerLabel}
      unknownThreshold={unknownThreshold}
      trainShare={trainShare}
      busy={busy}
      onPrototypes={(value) => setPrototypesPerLabel(value)}
      onThreshold={(value) => setUnknownThreshold(value)}
      onTrainShare={(value) => setTrainShare(value)}
      onTrain={() => void runTrain()}
      onEvaluate={() => void runEvaluate()}
      onExport={exportDataset}
      onImport={importDataset}
      formatNumber={formatNumber}
      formatDate={formatDate}
    />
  )

  return (
    <Workspace inspector={inspector}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>{t('nav.workspaceGroup')}</span>
            <h1>{t('page.training.title')}</h1>
            <p>{t('page.training.lead')}</p>
          </div>
          <div className={styles.headerActions}>
            <Toggle
              checked={recognition.twoHandMode}
              onChange={(twoHandMode) => useSettings.getState().setRecognition({ twoHandMode })}
              label={t('training.twoHandCapture')}
            />
            <Button
              variant="primary"
              icon={<Play aria-hidden="true" />}
              disabled={busy}
              onClick={() => void runTrain()}
            >
              {t('training.train')}
            </Button>
            <Button
              variant="secondary"
              icon={<Camera aria-hidden="true" />}
              disabled={busy}
              onClick={() => void runEvaluate()}
            >
              {t('training.evaluate')}
            </Button>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.layout}>
            <div className={styles.column}>
              <Panel title={t('training.labels')}>
                {labels.length === 0 ? (
                  <p className={styles.note}>{t('training.noLabels')}</p>
                ) : (
                  <ul className={styles.labelList}>
                    {labels.map((label) => {
                      const count = samples.filter((sample) => sample.labelId === label.id).length
                      const active = label.id === selectedLabelId
                      return (
                        <li key={label.id}>
                          <button
                            type="button"
                            className={styles.labelRow}
                            data-active={active}
                            aria-pressed={active}
                            onClick={() => setSelectedLabelId(label.id)}
                          >
                            <span className={styles.labelName}>{label.name}</span>
                            <span className={styles.labelMeta}>
                              {t(categoryKey(label.category))} · {formatNumber(count)}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={t('training.deleteLabel', { name: label.name })}
                            onClick={() => void removeLabel(label.id)}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>

              <Panel title={t('training.newLabel')}>
                <div className={styles.form}>
                  <label className={styles.field}>
                    <span>{t('training.labelName')}</span>
                    <input
                      value={name}
                      maxLength={60}
                      placeholder={t('training.labelNamePlaceholder')}
                      onChange={(event) => setName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void addNewLabel()
                      }}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>{t('training.labelCategory')}</span>
                    <SelectControl
                      ariaLabel={t('training.labelCategory')}
                      value={category}
                      onChange={(value) => setCategory(value as SignCategory)}
                      options={[
                        { value: 'alphabet', label: t('training.categoryAlphabet') },
                        { value: 'number', label: t('training.categoryNumber') },
                        { value: 'vocabulary', label: t('training.categoryVocabulary') },
                        { value: 'custom', label: t('training.categoryCustom') },
                      ]}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>{t('training.description')}</span>
                    <input
                      value={description}
                      maxLength={120}
                      placeholder={t('training.descriptionPlaceholder')}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus aria-hidden="true" />}
                    disabled={!name.trim()}
                    onClick={() => void addNewLabel()}
                  >
                    {t('training.addLabel')}
                  </Button>
                </div>
              </Panel>
            </div>

            <div className={styles.column}>
              <Panel
                title={t('training.capture')}
                action={
                  <span className={styles.badge}>
                    {t('training.samples')}: {formatNumber(selectedSamples.length)}
                  </span>
                }
              >
                <div className={styles.captureGrid}>
                  <CameraPreview compact />

                  <div className={styles.captureControls}>
                    <p className={styles.note}>{t('training.captureHint')}</p>
                    <dl className={styles.detailList}>
                      <div>
                        <dt>{t('training.selectedLabel')}</dt>
                        <dd>
                          {labels.find((label) => label.id === selectedLabelId)?.name ??
                            t('common.notAvailable')}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('training.takes')}</dt>
                        <dd>{formatNumber(takes)}</dd>
                      </div>
                      <div>
                        <dt>{t('training.currentTake')}</dt>
                        <dd>{capturing ? formatNumber(takeCount) : '—'}</dd>
                      </div>
                    </dl>

                    {capturing ? (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Square aria-hidden="true" />}
                        onClick={() => void stopTake()}
                      >
                        {t('training.stopTake')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CircleStop aria-hidden="true" />}
                        disabled={!selectedLabelId || camera !== 'live'}
                        onClick={startTake}
                      >
                        {t('training.startTake')}
                      </Button>
                    )}

                    {camera !== 'live' ? (
                      <p className={styles.note}>{t('training.cameraHint')}</p>
                    ) : null}
                    {takes < 2 ? <p className={styles.note}>{t('training.needsTwoTakes')}</p> : null}
                  </div>
                </div>
              </Panel>

              <Panel
                title={t('training.sampleReview')}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 aria-hidden="true" />}
                    disabled={samples.length === 0}
                    onClick={() => void clearAllSamples()}
                  >
                    {t('training.clearSamples')}
                  </Button>
                }
              >
                {selectedSamples.length === 0 ? (
                  <p className={styles.note}>{t('training.noSamples')}</p>
                ) : (
                  <ul className={styles.sampleList}>
                    {selectedSamples
                      .slice()
                      .reverse()
                      .slice(0, 40)
                      .map((sample) => (
                        <li key={sample.id}>
                          <span className={styles.sampleMeta}>
                            {formatDate(sample.createdAt, { timeStyle: 'medium' })} ·{' '}
                            {sample.handedness}
                          </span>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={t('training.removeSample')}
                            onClick={() => void removeSamples([sample.id])}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </Panel>
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

function categoryKey(category: SignCategory) {
  switch (category) {
    case 'alphabet':
      return 'training.categoryAlphabet' as const
    case 'number':
      return 'training.categoryNumber' as const
    case 'vocabulary':
      return 'training.categoryVocabulary' as const
    default:
      return 'training.categoryCustom' as const
  }
}
