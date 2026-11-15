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
import { useI18n, localeMeta } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { useSettings } from '@/settings/settingsStore'
import { classify } from '@/signs/classifier'
import { featuresFromReading } from '@/signs/features'
import {
  appendWord,
  addSpace,
  deleteLast,
  readFrame,
  sentenceText,
  SignStabilizer,
  type ReaderMode,
  type ReaderReading,
  type SentenceToken,
} from '@/signs/reader'
import { useSigns } from '@/signs/store'
import type { Transcript, TranscriptEntry } from '@/signs/types'
import { getVisionEngine } from '@/vision/VisionEngine'
import { useVisionStatus } from '@/vision/visionStatus'
import type { StaticGestureId } from '@/vision/types'
import { ReaderInspector } from './ReaderInspector'
import styles from './signreader.module.css'

interface HistoryEntry {
  id: string
  text: string
  labelId: string
  confidence: number
  at: number
}

/** Frames a reading has to hold before it becomes a word. */
const STABLE_FRAMES = 3

export function SignReaderPage() {
  const { t, formatNumber, formatDate } = useI18n()
  const engine = getVisionEngine()

  const camera = useVisionStatus((state) => state.camera)
  const tracking = useVisionStatus((state) => state.tracking)

  const captions = useSettings((state) => state.captions)
  const captionSize = useSettings((state) => state.accessibility.captionSize)
  const captionsVisible = useSettings((state) => state.accessibility.captionsVisible)
  const setAccessibility = useSettings((state) => state.setAccessibility)

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

  const modeRef = useRef(mode)
  modeRef.current = mode
  const modelRef = useRef(model)
  modelRef.current = model
  const autoAddRef = useRef(autoAdd)
  autoAddRef.current = autoAdd

  const stabilizerRef = useRef(new SignStabilizer(STABLE_FRAMES))
  const committedRef = useRef('')
  const releasedRef = useRef(true)

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
    (result: ReaderReading) => {
      const at = Date.now()
      const entry: HistoryEntry = {
        id: `h_${at.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        text: result.text,
        labelId: result.key,
        confidence: result.confidence,
        at,
      }
      setHistory((current) => [entry, ...current].slice(0, 40))

      const instance = captionEngineRef.current
      if (instance) {
        instance.push({ text: result.text, labelId: result.key, at })
        setCaptionLines([...instance.snapshot.lines])
      }

      if (autoAddRef.current) setTokens((current) => appendWord(current, result.text))
    },
    [],
  )

  // Recognition runs on the shared engine's frames.
  useEffect(
    () =>
      engine.subscribeFrames((frame) => {
        const hand = frame.hands[0] ?? null
        const currentMode = modeRef.current
        const currentModel = modelRef.current
        const modelResult =
          currentMode === 'model' && currentModel && hand
            ? classify(currentModel, featuresFromReading(hand))
            : null
        const result = readFrame(currentMode, hand, modelResult)
        setReading(result)

        if (!hand) {
          releasedRef.current = true
          stabilizerRef.current.reset()
          return
        }
        if (result.unknown) {
          stabilizerRef.current.reset()
          return
        }

        const stable = stabilizerRef.current.push(result.key)
        if (!stable) return
        if (!releasedRef.current && result.key === committedRef.current) return
        committedRef.current = result.key
        releasedRef.current = false
        commit(result)
      }),
    [engine, commit],
  )

  // Switching the mode starts a fresh stabiliser, so a reading from the old
  // mode can never leak into the new one.
  useEffect(() => {
    stabilizerRef.current.reset()
    committedRef.current = ''
    releasedRef.current = true
  }, [mode])

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
              <p className={styles.note}>{t(modeNoteKey(mode))}</p>
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
                  {history.length > 0 ? (
                    <Button size="sm" variant="ghost" onClick={() => setHistory([])}>
                      {t('reader.clearHistory')}
                    </Button>
                  ) : null}
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
