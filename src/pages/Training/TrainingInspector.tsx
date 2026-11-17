import { useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/Controls'
import { Panel } from '@/components/ui/Panel'
import { useI18n } from '@/localization/i18n'
import type { Evaluation, SignModel } from '@/signs/types'
import styles from './training.module.css'

interface TrainingInspectorProps {
  model: SignModel | null
  evaluation: Evaluation | null
  error: string | null
  prototypesPerLabel: number
  unknownThreshold: number
  trainShare: number
  busy: boolean
  onPrototypes: (value: number) => void
  onThreshold: (value: number) => void
  onTrainShare: (value: number) => void
  onTrain: () => void
  onEvaluate: () => void
  onExport: () => void
  onImport: (file: File) => void
  formatNumber: (value: number) => string
  formatDate: (value: number | Date, options?: Intl.DateTimeFormatOptions) => string
}

export function TrainingInspector({
  model,
  evaluation,
  error,
  prototypesPerLabel,
  unknownThreshold,
  trainShare,
  busy,
  onPrototypes,
  onThreshold,
  onTrainShare,
  onTrain,
  onEvaluate,
  onExport,
  onImport,
  formatNumber,
  formatDate,
}: TrainingInspectorProps) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <Panel title={t('training.model')}>
        {model ? (
          <>
            <dl className={styles.detailList}>
              <div>
                <dt>{t('training.modelSamples')}</dt>
                <dd>{formatNumber(model.sampleCount)}</dd>
              </div>
              <div>
                <dt>{t('training.prototypes')}</dt>
                <dd>{formatNumber(model.prototypesPerLabel)}</dd>
              </div>
              <div>
                <dt>{t('training.modelSigns')}</dt>
                <dd>{formatNumber(model.labels.length)}</dd>
              </div>
              <div>
                <dt>{t('training.modelTrained')}</dt>
                <dd>{formatDate(model.trainedAt, { dateStyle: 'medium' })}</dd>
              </div>
            </dl>
            {model.ignoredSamples ? (
              <p className={styles.note}>
                {t('training.ignoredSamples', { count: formatNumber(model.ignoredSamples) })}
              </p>
            ) : null}
          </>
        ) : (
          <p className={styles.note}>{t('training.noModel')}</p>
        )}
      </Panel>

      <Panel title={t('training.options')}>
        <Slider
          label={t('training.prototypes')}
          value={prototypesPerLabel}
          min={1}
          max={12}
          step={1}
          format={(value) => formatNumber(value)}
          onChange={onPrototypes}
        />
        <Slider
          label={t('training.unknownThreshold')}
          value={Math.round(unknownThreshold * 100)}
          min={20}
          max={150}
          step={5}
          format={(value) => `${formatNumber(value)}%`}
          onChange={(value) => onThreshold(value / 100)}
        />
        <Slider
          label={t('training.trainShare')}
          value={trainShare}
          min={40}
          max={90}
          step={5}
          format={(value) => `${formatNumber(value)}%`}
          onChange={onTrainShare}
        />
        <div className={styles.inspectorActions}>
          <Button size="sm" variant="primary" disabled={busy} onClick={onTrain}>
            {t('training.train')}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onEvaluate}>
            {t('training.evaluate')}
          </Button>
        </div>
        <p className={styles.note}>{t('training.splitNote')}</p>
      </Panel>

      <Panel title={t('training.evaluation')}>
        {!evaluation ? (
          <p className={styles.note}>{t('training.noEvaluation')}</p>
        ) : (
          <>
            <dl className={styles.detailList}>
              <div>
                <dt>{t('training.accuracy')}</dt>
                <dd>{formatNumber(Math.round(evaluation.accuracy * 100))}%</dd>
              </div>
              <div>
                <dt>{t('training.unknownRate')}</dt>
                <dd>{formatNumber(Math.round(evaluation.unknownRate * 100))}%</dd>
              </div>
              <div>
                <dt>{t('training.trainSamples')}</dt>
                <dd>{formatNumber(evaluation.trainCount)}</dd>
              </div>
              <div>
                <dt>{t('training.testSamples')}</dt>
                <dd>{formatNumber(evaluation.testCount)}</dd>
              </div>
            </dl>

            {evaluation.perClass.length > 0 ? (
              <table className={styles.metricsTable}>
                <thead>
                  <tr>
                    <th scope="col">{t('training.labelName')}</th>
                    <th scope="col">{t('training.precision')}</th>
                    <th scope="col">{t('training.recall')}</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.perClass.map((entry) => (
                    <tr key={entry.labelId}>
                      <th scope="row">{entry.name}</th>
                      <td>{formatNumber(Math.round(entry.precision * 100))}%</td>
                      <td>{formatNumber(Math.round(entry.recall * 100))}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <p className={styles.note}>{t('training.evaluationNote')}</p>
            {evaluation.ignoredTestCount ? (
              <p className={styles.note}>
                {t('training.ignoredSamples', {
                  count: formatNumber(evaluation.ignoredTestCount),
                })}
              </p>
            ) : null}
          </>
        )}
        {error ? (
          <p className={styles.warning} role="alert">
            {error}
          </p>
        ) : null}
      </Panel>

      <Panel title={t('training.dataset')}>
        <div className={styles.inspectorActions}>
          <Button size="sm" variant="secondary" icon={<Download aria-hidden="true" />} onClick={onExport}>
            {t('training.export')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Upload aria-hidden="true" />}
            onClick={() => fileRef.current?.click()}
          >
            {t('training.import')}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className={styles.fileInput}
          aria-label={t('training.import')}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
        <p className={styles.note}>{t('training.datasetNote')}</p>
      </Panel>
    </>
  )
}
