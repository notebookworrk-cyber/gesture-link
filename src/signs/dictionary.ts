import type { SignLabel, SignModel, SignSample } from './types'

export type DictionaryStatus = 'ready' | 'notInModel' | 'noSamples'

export interface DictionaryRow {
  label: SignLabel
  sampleCount: number
  lastAt: number | null
  inModel: boolean
  status: DictionaryStatus
}

/**
 * Joins the user's labels with recorded samples and the current model.
 * `ready` only means the model has prototypes for the label; accuracy is a
 * separate, measured question and is never inferred from this state.
 */
export function buildDictionary(
  labels: SignLabel[],
  samples: SignSample[],
  model: SignModel | null,
): DictionaryRow[] {
  const stats = new Map<string, { count: number; lastAt: number }>()
  for (const sample of samples) {
    const entry = stats.get(sample.labelId)
    if (!entry) {
      stats.set(sample.labelId, { count: 1, lastAt: sample.createdAt })
      continue
    }
    entry.count += 1
    entry.lastAt = Math.max(entry.lastAt, sample.createdAt)
  }

  const modelIds = new Set(model?.labels.map((label) => label.id) ?? [])
  return labels.map((label) => {
    const stat = stats.get(label.id)
    const inModel = modelIds.has(label.id)
    return {
      label,
      sampleCount: stat?.count ?? 0,
      lastAt: stat?.lastAt ?? null,
      inModel,
      status: inModel ? 'ready' : stat ? 'notInModel' : 'noSamples',
    }
  })
}
