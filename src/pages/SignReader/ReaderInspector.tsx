import { useI18n } from '@/localization/i18n'
import type { MessageKey } from '@/localization/locales/en'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Controls'
import { Panel } from '@/components/ui/Panel'
import type { CaptionMode } from '@/captions/types'
import type { ReaderMode, ReaderReading } from '@/signs/reader'
import type { Transcript } from '@/signs/types'
import styles from './signreader.module.css'

interface ReaderInspectorProps {
  mode: ReaderMode
  reading: ReaderReading
  history: Array<{ id: string; text: string; confidence: number; at: number }>
  transcripts: Transcript[]
  captionMode: CaptionMode
  captionsVisible: boolean
  labelCount: number
  hasModel: boolean
  debug: { phase: string; stabilization: number; lastEvent: string }
  onCaptionMode: (mode: CaptionMode) => void
  onCaptionsVisible: (visible: boolean) => void
  onLoadTranscript: (transcript: Transcript) => void
  onDeleteTranscript: (id: string) => void
}

export function ReaderInspector({
  mode,
  reading,
  history,
  transcripts,
  captionMode,
  captionsVisible,
  labelCount,
  hasModel,
  debug,
  onCaptionMode,
  onCaptionsVisible,
  onLoadTranscript,
  onDeleteTranscript,
}: ReaderInspectorProps) {
  const { t, formatNumber, formatDate } = useI18n()

  return (
    <>
      <Panel title={t('reader.modelInfo')}>
        <p className={styles.inspectorNote}>{t('reader.modelNote')}</p>
        <dl className={styles.detailList}>
          <div>
            <dt>{t('reader.mode')}</dt>
            <dd>{t(modeKey(mode))}</dd>
          </div>
          <div>
            <dt>{t('training.labels')}</dt>
            <dd>{formatNumber(labelCount)}</dd>
          </div>
          <div>
            <dt>{t('reader.modelInfo')}</dt>
            <dd>{hasModel ? t('reader.modelReady') : t('reader.modelMissing')}</dd>
          </div>
        </dl>
        {!hasModel ? <p className={styles.warning}>{t('reader.modelMissingBody')}</p> : null}
      </Panel>

      <Panel title={t('reader.captions')}>
        <Segmented
          ariaLabel={t('caption.mode')}
          value={captionMode}
          onChange={(value) => onCaptionMode(value as CaptionMode)}
          options={[
            { value: 'live', label: t('caption.modeLive') },
            { value: 'words', label: t('caption.modeWords') },
            { value: 'sentences', label: t('caption.modeSentences') },
            { value: 'subtitle', label: t('caption.modeSubtitle') },
            { value: 'large', label: t('caption.modeLarge') },
            { value: 'bilingual', label: t('caption.modeBilingual') },
          ]}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCaptionsVisible(!captionsVisible)}
          className={styles.inspectorButton}
        >
          {captionsVisible ? t('common.on') : t('common.off')} · {t('caption.visible')}
        </Button>
        <p className={styles.inspectorNote}>{t('caption.bilingualNote')}</p>
      </Panel>

      <Panel title={t('reader.history')}>
        {history.length === 0 ? (
          <p className={styles.inspectorNote}>{t('reader.historyEmpty')}</p>
        ) : (
          <ul className={styles.inspectorList}>
            {history.slice(0, 10).map((entry) => (
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
        {reading.unknown ? null : (
          <p className={styles.inspectorNote}>
            {t('reader.confidence')}: {formatNumber(Math.round(reading.confidence * 100))}%
          </p>
        )}
      </Panel>

      <Panel title={t('debug.title')}>
        <p className={styles.inspectorNote}>{t('debug.note')}</p>
        <dl className={styles.detailList}>
          <div>
            <dt>{t('debug.state')}</dt>
            <dd className="mono">{debug.phase}</dd>
          </div>
          <div>
            <dt>{t('debug.stabilization')}</dt>
            <dd>{formatNumber(Math.round(debug.stabilization * 100))}%</dd>
          </div>
          <div>
            <dt>{t('debug.lastEvent')}</dt>
            <dd>{debug.lastEvent || '—'}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title={t('reader.transcripts')}>
        {transcripts.length === 0 ? (
          <p className={styles.inspectorNote}>{t('reader.transcriptsEmpty')}</p>
        ) : (
          <ul className={styles.inspectorList}>
            {transcripts.map((transcript) => (
              <li key={transcript.id}>
                <span className={styles.historyText}>{transcript.title || transcript.text}</span>
                <span className={styles.historyMeta}>
                  {formatDate(transcript.createdAt, { dateStyle: 'medium' })}
                </span>
                <span className={styles.rowActions}>
                  <Button size="sm" variant="ghost" onClick={() => onLoadTranscript(transcript)}>
                    {t('reader.loadTranscript')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDeleteTranscript(transcript.id)}
                  >
                    {t('reader.deleteTranscript')}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

function modeKey(mode: ReaderMode): MessageKey {
  switch (mode) {
    case 'count':
      return 'reader.modeCount'
    case 'shape':
      return 'reader.modeShape'
    case 'model':
      return 'reader.modeModel'
  }
}
