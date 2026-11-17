import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  ClipboardCopy,
  Download,
  Eraser,
  GraduationCap,
  Save,
  Space,
  Trash2,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Segmented, Toggle } from '@/components/ui/Controls'
import { Workspace } from '@/components/layout/Workspace'
import { CameraPreview } from '@/components/vision/CameraPreview'
import { CaptionView } from '@/captions/CaptionView'
import { CaptionEngine } from '@/captions/engine'
import { speak } from '@/captions/speech'
import type { CaptionLine } from '@/captions/types'
import { localeMeta, useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { palmMotion, palmPoints, recognitionSettingsFrom, trackerOptionsFrom } from '@/recognition/config'
import { SignEventManager } from '@/recognition/SignEventManager'
import { TwoHandTracker } from '@/recognition/TwoHandTracker'
import type { RecognitionCandidate, RecognitionEvent, RecognitionPhase } from '@/recognition/types'
import { useSettings } from '@/settings/settingsStore'
import { classify } from '@/signs/classifier'
import { featuresFromReading, windowFrameFromReading } from '@/signs/features'
import { SignWindowBuffer } from '@/signs/windowBuffer'
import {
  appendWord,
  addSpace,
  deleteLast,
  readFrame,
  sentenceText,
  type ReaderMode,
  type ReaderReading,
  type SentenceToken,
} from '@/signs/reader'
import { serializeHistory, type HistoryEntry } from '@/signs/history'
import { useSigns } from '@/signs/store'
import type { Transcript, TranscriptEntry } from '@/signs/types'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import type { StaticGestureId } from '@/vision/types'
import { ReaderInspector } from './ReaderInspector'
import styles from './signreader.module.css'

export function SignReaderPage() {
  const { t, formatNumber, formatDate } = useI18n()
  const engine = getVisionEngine()

  const camera = useVisionStatus((state) => state.camera)
  const tracking = useVisionStatus((state) => state.tracking)

  const captions = useSettings((state) => state.captions)
  const captionSize = useSettings((state) => state.accessibility.captionSize)
  const captionsVisible = useSettings((state) => state.accessibility.captionsVisible)
  const setAccessibility = useSettings((state) => state.setAccessibility)
  const recognition = useSettings((state) => state.recognition)
  const cameraMirror = useSettings((state) => state.camera.mirror)

  const labels = useSigns((state) => state.labels)
  const model = useSigns((state) => state.model)
  const transcripts = useSigns((state) => state.transcripts)
  const saveTranscriptEntry = useSigns((state) => state.saveTranscriptEntry)
  const removeTranscript = useSigns((state) => state.removeTranscript)

  const [mode, setMode] = useState<ReaderMode>('count')
  const [autoAdd, setAutoAdd] = useState(true)
  const [reading, setReading] = useState<ReaderReading>({
    key: 'none',
    text: '',
    confidence: 0,
    unknown: true,
  })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [tokens, setTokens] = useState<SentenceToken[]>([])
  const [captionLines, setCaptionLines] = useState<CaptionLine[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [phase, setPhase] = useState<RecognitionPhase>('idle')
  const [stabilization, setStabilization] = useState(0)
  const [lastEvent, setLastEvent] = useState('')
  const announceAlternateRef = useRef(false)

  const modeRef = useRef(mode)
  modeRef.current = mode
  const modelRef = useRef(model)
  modelRef.current = model
  const autoAddRef = useRef(autoAdd)
  autoAddRef.current = autoAdd

  const eventsRef = useRef<SignEventManager | null>(null)
  if (!eventsRef.current) {
    eventsRef.current = new SignEventManager(recognitionSettingsFrom(recognition))
  }
  const trackerRef = useRef<TwoHandTracker | null>(null)
  if (!trackerRef.current) {
    trackerRef.current = new TwoHandTracker(trackerOptionsFrom(recognition, cameraMirror))
  }
  const palmRef = useRef<ReturnType<typeof palmPoints>>({})
  const windowRef = useRef(new SignWindowBuffer())

  const captionEngineRef = useRef<CaptionEngine | null>(null)
  if (!captionEngineRef.current) captionEngineRef.current = new CaptionEngine(captions)

  useEffect(() => {
    void useSigns.getState().init()
  }, [])

  useEffect(() => {
    captionEngineRef.current?.configure(captions)
  }, [captions])

  // The caption engine advances on a timer: finished sentences close after a
  // pause and expired lines leave the screen.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const instance = captionEngineRef.current
      if (!instance) return
      setCaptionLines(instance.tick(Date.now()))
    }, 200)
    return () => window.clearInterval(timer)
  }, [])

  const commit = useCallback(
    (event: RecognitionEvent) => {
      const entry: HistoryEntry = {
        id: event.id,
        text: event.text,
        labelId: event.key,
        confidence: event.confidence,
        mode:
          event.source === 'two-hand' || event.source === 'number' ? 'model' : event.source,
        at: event.committedAt,
      }
      setHistory((current) => [entry, ...current].slice(0, 40))
      setLastEvent(event.text)
      // Screen readers announce committed signs regardless of the caption
      // preset. The alternating space lets the same sign be announced twice.
      setAnnouncement(
        announceAlternateRef.current ? `${event.text}\u00a0` : event.text,
      )
      announceAlternateRef.current = !announceAlternateRef.current

      const instance = captionEngineRef.current
      if (instance) {
        instance.push({ text: event.text, labelId: event.key, at: event.committedAt })
        setCaptionLines([...instance.snapshot.lines])
      }
      if (autoAddRef.current) setTokens((current) => appendWord(current, event.text))
    },
    [],
  )

  // Only the event manager can produce a sentence entry or a speech event.
  useEffect(() => {
    const manager = eventsRef.current
    if (!manager) return
    return manager.subscribe((event) => commit(event))
  }, [commit])

  // Recognition runs on the shared engine's frames, but commits are owned by
  // the event manager rather than by this component.
  useEffect(
    () =>
      engine.subscribeFrames((frame) => {
        const tracker = trackerRef.current
        const manager = eventsRef.current
        if (!tracker || !manager) return
        const update = tracker.update(frame)
        const motion = palmMotion(update, palmRef.current)
        palmRef.current = palmPoints(update)

        const hand = update.right?.reading ?? update.left?.reading ?? null
        const currentMode = modeRef.current
        const currentModel = modelRef.current
        const buffer = windowRef.current
        let readingResult: ReaderReading

        // A window model scores a time-normalised sequence, so it needs the
        // rolling buffer. A frame model scores the current reading directly.
        if (currentMode === 'model' && currentModel?.featureKind === 'window') {
          const vector = hand
            ? windowFrameFromReading(hand, frame.hands[1] ?? null)
            : null
          const window = buffer.push(frame.timestamp, vector)
          if (!window) {
            if (!hand) {
              setReading({ key: 'none', text: '', confidence: 0, unknown: true })
            }
            return
          }
          const prediction = classify(currentModel, window)
          readingResult = readFrame('model', hand, prediction)
        } else {
          buffer.reset()
          const modelResult =
            currentMode === 'model' && currentModel && hand
              ? classify(currentModel, featuresFromReading(hand))
              : null
          readingResult = readFrame(currentMode, hand, modelResult)
        }

        setReading(readingResult)
        const candidate: RecognitionCandidate | null = readingResult.unknown
          ? null
          : {
              key: readingResult.key,
              text: readingResult.text,
              confidence: readingResult.confidence,
              source: currentMode === 'model' ? 'model' : currentMode,
              hands: update.visible,
            }
        manager.update(candidate, motion, frame.timestamp, {
          lost: update.lost,
          latencyMs: frame.inferenceMs,
        })
        const debug = manager.debug
        setPhase(debug.phase)
        setStabilization(debug.stabilization)
      }),
    [engine],
  )

  // Switching the mode starts a fresh recognition session, so a reading from
  // the old mode can never leak into the new one.
  useEffect(() => {
    eventsRef.current?.reset()
    trackerRef.current?.reset()
    windowRef.current.reset()
    palmRef.current = {}
    setPhase('idle')
  }, [mode])

  // A newly trained model may use a different feature layout, so the window
  // buffer must not carry frames recorded for the previous model.
  useEffect(() => {
    windowRef.current.reset()
    eventsRef.current?.reset()
  }, [model])

  // Reconfigure the pipeline when the advanced recognition settings change.
  useEffect(() => {
    eventsRef.current?.configure(recognitionSettingsFrom(recognition))
    trackerRef.current?.configure(trackerOptionsFrom(recognition, cameraMirror))
    windowRef.current.reset()
    palmRef.current = {}
  }, [recognition, cameraMirror])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const text = useMemo(() => sentenceText(tokens), [tokens])

  const addCurrentToSentence = useCallback(() => {
    if (!reading.text) return
    setTokens((current) => appendWord(current, reading.text))
  }, [reading.text])

  const copySentence = useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setNotice(t('reader.copied'))
    } catch {
      setNotice(t('reader.copyFailed'))
    }
  }, [t, text])

  const saveSentence = useCallback(async () => {
    if (!text) return
    const entries: TranscriptEntry[] = history.slice(0, 30).map((entry) => ({
      id: entry.id,
      text: entry.text,
      at: entry.at,
      labelIds: [entry.labelId],
    }))
    const transcript: Transcript = {
      id: `tr_${Date.now().toString(36)}`,
      title: text.slice(0, 60),
      text,
      createdAt: Date.now(),
      entries,
    }
    await saveTranscriptEntry(transcript)
    setNotice(t('reader.saved'))
  }, [history, saveTranscriptEntry, t, text])

  const readAloud = useCallback(() => {
    if (!text) return
    const language = useSettings.getState().language
    const ok = speak(text, {
      voiceName: language.voice,
      lang: localeMeta[language.captions].tag,
    })
    setNotice(ok ? t('reader.spoken') : t('reader.speechUnavailable'))
  }, [t, text])

  const exportSentence = useCallback(() => {
    if (!text) return
    const blob = new Blob([`${text}\n`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gesturelink-sentence-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, [text])

  const exportHistory = useCallback(() => {
    if (history.length === 0) return
    const blob = new Blob([serializeHistory(history, Date.now())], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `gesturelink-history-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, [history])

  const loadTranscript = useCallback((transcript: Transcript) => {
    const loaded: SentenceToken[] = []
    for (const word of transcript.text.split(/\s+/)) {
      if (!word) continue
      loaded.push({ kind: 'word', text: word })
      loaded.push({ kind: 'space', text: ' ' })
    }
    setTokens(loaded.slice(0, -1))
  }, [])

  const modeOptions = [
    { value: 'count' as const, label: t('reader.modeCount') },
    { value: 'shape' as const, label: t('reader.modeShape') },
    { value: 'model' as const, label: t('reader.modeModel') },
  ]

  const inspector = (
    <ReaderInspector
      mode={mode}
      reading={reading}
      history={history}
      transcripts={transcripts}
      captionMode={captions.mode}
      captionsVisible={captionsVisible}
      labelCount={labels.length}
      hasModel={Boolean(model)}
      debug={{ phase, stabilization, lastEvent }}
      onCaptionMode={(captionMode) => useSettings.getState().setCaptions({ mode: captionMode })}
      onCaptionsVisible={(value) => setAccessibility({ captionsVisible: value })}
      onLoadTranscript={loadTranscript}
      onDeleteTranscript={(id) => void removeTranscript(id)}
    />
  )

  const readingLabel = reading.unknown
    ? t('reader.unknown')
    : mode === 'shape'
      ? t(gestureLabelKey(reading.text as StaticGestureId))
      : reading.text

  return (
    <Workspace inspector={inspector}>
      <div className={styles.page}>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>{t('nav.workspaceGroup')}</span>
            <h1>{t('page.signReader.title')}</h1>
            <p>{t('page.signReader.lead')}</p>
          </div>

          <div className={styles.headerTools}>
            <Segmented
              ariaLabel={t('reader.mode')}
              value={mode}
              onChange={(next) => setMode(next as ReaderMode)}
              options={modeOptions}
            />
            <Toggle
              checked={autoAdd}
              onChange={setAutoAdd}
              label={t('reader.autoAdd')}
            />
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.layout}>
            <section className={styles.previewColumn}>
              <CameraPreview />
              <p className={styles.note}>
                {t(
                  mode === 'model' && model?.featureKind === 'window'
                    ? 'reader.motionNote'
                    : modeNoteKey(mode),
                )}
              </p>
              <p className={styles.note}>{t('reader.stabilityHint')}</p>
            </section>

            <div className={styles.mainColumn}>
              <section className={styles.card} aria-label={t('reader.currentSign')}>
                <div className={styles.cardHead}>
                  <h2>{t('reader.currentSign')}</h2>
                  <span className={styles.state} data-live={camera === 'live' && tracking !== 'loading'}>
                    {camera === 'live'
                      ? tracking === 'loading'
                        ? t('vision.loadingModel')
                        : t('reader.recognised')
                      : t('reader.waitingHand')}
                  </span>
                </div>

                <div className={styles.signArea}>
                  <span className={styles.signValue} data-unknown={reading.unknown}>
                    {reading.unknown ? '—' : readingLabel}
                  </span>
                  {mode === 'count' && !reading.unknown ? (
                    <span className={styles.signHint}>{t('reader.fingers')}</span>
                  ) : null}
                  {mode === 'shape' && !reading.unknown ? (
                    <span className={styles.signHint}>{t('reader.shape')}</span>
                  ) : null}
                </div>

                <div className={styles.confidence}>
                  <div className={styles.confidenceHead}>
                    <span>{t('reader.confidence')}</span>
                    <span className="mono">
                      {formatNumber(Math.round(reading.confidence * 100))}%
                    </span>
                  </div>
                  <div className={styles.meter} role="presentation">
                    <span style={{ width: `${Math.round(reading.confidence * 100)}%` }} />
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Check aria-hidden="true" />}
                    disabled={reading.unknown}
                    onClick={addCurrentToSentence}
                  >
                    {t('reader.addToSentence')}
                  </Button>
                  {mode === 'model' && !model ? (
                    <Link className={styles.linkButton} to="/training">
                      <GraduationCap aria-hidden="true" />
                      {t('reader.openTraining')}
                    </Link>
                  ) : null}
                </div>
              </section>

              <CaptionView
                lines={captionLines}
                settings={captions}
                size={captionSize}
                placeholder={t('caption.placeholder')}
              />

              <section className={styles.card} aria-label={t('reader.sentence')}>
                <div className={styles.cardHead}>
                  <h2>{t('reader.sentence')}</h2>
                  <span className={styles.charCount}>{formatNumber(text.length)}</span>
                </div>

                <p className={styles.sentence} data-empty={tokens.length === 0}>
                  {tokens.length === 0 ? t('reader.sentenceEmpty') : text}
                </p>

                <div className={styles.actions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Space aria-hidden="true" />}
                    disabled={tokens.length === 0}
                    onClick={() => setTokens((current) => addSpace(current))}
                  >
                    {t('reader.addSpace')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Eraser aria-hidden="true" />}
                    disabled={tokens.length === 0}
                    onClick={() => setTokens((current) => deleteLast(current))}
                  >
                    {t('reader.deleteLast')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 aria-hidden="true" />}
                    disabled={tokens.length === 0}
                    onClick={() => setTokens([])}
                  >
                    {t('reader.clear')}
                  </Button>
                  <span className={styles.spacer} />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<ClipboardCopy aria-hidden="true" />}
                    disabled={!text}
                    onClick={() => void copySentence()}
                  >
                    {t('reader.copy')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Save aria-hidden="true" />}
                    disabled={!text}
                    onClick={() => void saveSentence()}
                  >
                    {t('reader.save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Volume2 aria-hidden="true" />}
                    disabled={!text}
                    onClick={readAloud}
                  >
                    {t('reader.readAloud')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Download aria-hidden="true" />}
                    disabled={!text}
                    onClick={exportSentence}
                  >
                    {t('reader.export')}
                  </Button>
                </div>
              </section>

              <section className={styles.card} aria-label={t('reader.history')}>
                <div className={styles.cardHead}>
                  <h2>{t('reader.history')}</h2>
                  <div className={styles.historyActions}>
                    {history.length > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Download aria-hidden="true" />}
                        onClick={exportHistory}
                      >
                        {t('reader.exportHistory')}
                      </Button>
                    ) : null}
                    {history.length > 0 ? (
                      <Button size="sm" variant="ghost" onClick={() => setHistory([])}>
                        {t('reader.clearHistory')}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {history.length === 0 ? (
                  <p className={styles.note}>{t('reader.historyEmpty')}</p>
                ) : (
                  <ul className={styles.historyList}>
                    {history.slice(0, 12).map((entry) => (
                      <li key={entry.id}>
                        <span className={styles.historyText}>{entry.text}</span>
                        <span className={styles.historyMeta}>
                          {formatNumber(Math.round(entry.confidence * 100))}% ·{' '}
                          {formatDate(entry.at, { timeStyle: 'medium' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
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

function modeNoteKey(mode: ReaderMode): MessageKey {
  switch (mode) {
    case 'count':
      return 'reader.countNote'
    case 'shape':
      return 'reader.controlNote'
    case 'model':
      return 'reader.modelNote'
  }
}

export function gestureLabelKey(gesture: StaticGestureId): MessageKey {
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
