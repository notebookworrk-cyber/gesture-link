import { distance, windowDistance, WINDOW_LENGTH } from './features'
import { TWO_HAND_LENGTH } from '@/recognition/TemporalFeatureExtractor'
import type {
  ClassScore,
  Evaluation,
  Prediction,
  SignFeatureKind,
  SignLabel,
  SignModel,
  SignSample,
} from './types'

/** Model format version, bumped when the feature layout changes. */
export const MODEL_VERSION = 3

export interface TrainOptions {
  /** Representative vectors kept per label. */
  prototypesPerLabel: number
  /** Distance above which a prediction counts as unknown. */
  unknownThreshold: number
  /** Share of the sample groups used for training, 0…1. */
  trainShare: number
}

/**
 * Chooses one feature kind for the whole model. Window samples are preferred:
 * when any exist, older single-frame samples are ignored rather than mixed into
 * a distance metric that averages over different vector lengths.
 */
export function selectSamples(samples: SignSample[]): {
  kind: SignFeatureKind
  length: number
  selected: SignSample[]
  ignored: SignSample[]
} {
  const twoHanded = samples.filter((sample) => sample.features.length === TWO_HAND_LENGTH)
  if (twoHanded.length > 0) {
    return {
      kind: 'two-hand',
      length: TWO_HAND_LENGTH,
      selected: twoHanded,
      ignored: samples.filter((sample) => sample.features.length !== TWO_HAND_LENGTH),
    }
  }
  const windowed = samples.filter((sample) => sample.features.length === WINDOW_LENGTH)
  if (windowed.length > 0) {
    return {
      kind: 'window',
      length: WINDOW_LENGTH,
      selected: windowed,
      ignored: samples.filter((sample) => sample.features.length !== WINDOW_LENGTH),
    }
  }
  const length = samples[0]?.features.length ?? 0
  return { kind: 'frame', length, selected: samples, ignored: [] }
}

function metricFor(kind: SignFeatureKind): (a: ArrayLike<number>, b: ArrayLike<number>) => number {
  return kind === 'frame' ? distance : windowDistance
}

/**
 * Builds the representative vectors of one label with a greedy farthest-point
 * seeding followed by averaging. It keeps the natural variation of a sign
 * (different angles and distances) without storing every sample in the model.
 */
export function buildPrototypes(
  vectors: number[][],
  count: number,
  metric: (a: ArrayLike<number>, b: ArrayLike<number>) => number = distance,
): number[][] {
  if (vectors.length === 0) return []
  if (vectors.length <= count) return vectors.map((vector) => [...vector])

  const seeds: number[][] = [vectors[0]!]
  while (seeds.length < count) {
    let best = vectors[0]!
    let bestDistance = -1
    for (const vector of vectors) {
      let closest = Infinity
      for (const seed of seeds) {
        const value = metric(seed, vector)
        if (value < closest) closest = value
      }
      if (closest > bestDistance) {
        bestDistance = closest
        best = vector
      }
    }
    seeds.push(best)
  }

  const buckets = seeds.map(() => [] as number[][])
  for (const vector of vectors) {
    let closest = 0
    let closestDistance = Infinity
    for (let index = 0; index < seeds.length; index += 1) {
      const value = metric(seeds[index]!, vector)
      if (value < closestDistance) {
        closestDistance = value
        closest = index
      }
    }
    buckets[closest]!.push(vector)
  }

  return buckets
    .filter((bucket) => bucket.length > 0)
    .map((bucket) => {
      const average = new Array<number>(bucket[0]!.length).fill(0)
      for (const vector of bucket) {
        for (let index = 0; index < average.length; index += 1) {
          average[index]! += vector[index]!
        }
      }
      return average.map((value) => value / bucket.length)
    })
}

/** Trains a model from the given samples. */
export function trainModel(
  labels: SignLabel[],
  samples: SignSample[],
  options: TrainOptions,
): SignModel {
  const chosen = selectSamples(samples)
  const metric = metricFor(chosen.kind)
  const prototypes: Record<string, number[][]> = {}
  for (const label of labels) {
    const vectors = chosen.selected
      .filter((sample) => sample.labelId === label.id)
      .map((sample) => sample.features)
    if (vectors.length === 0) continue
    prototypes[label.id] = buildPrototypes(vectors, options.prototypesPerLabel, metric)
  }
  return {
    version: MODEL_VERSION,
    featureKind: chosen.kind,
    featureLength: chosen.length,
    ignoredSamples: chosen.ignored.length,
    labels: labels.filter((label) => (prototypes[label.id]?.length ?? 0) > 0),
    prototypes,
    prototypesPerLabel: options.prototypesPerLabel,
    unknownThreshold: options.unknownThreshold,
    trainedAt: Date.now(),
    sampleCount: chosen.selected.length,
  }
}

/**
 * Classifies one feature vector. The confidence comes from the margin between
 * the closest prototype of the winning label and the closest prototype of any
 * other label; a large absolute distance means the sign is not in the model.
 */
export function classify(model: SignModel, features: ArrayLike<number>): Prediction {
  const unknownResult: Prediction = {
    labelId: '',
    name: '',
    category: 'custom',
    confidence: 0,
    unknown: true,
  }
  // A model trained on one feature layout must not score a vector from another:
  // the distance would silently compare only a prefix.
  if (model.featureLength !== undefined && features.length !== model.featureLength) {
    return unknownResult
  }
  const metric = metricFor(model.featureKind ?? 'frame')

  let bestLabelId = ''
  let bestName = ''
  let bestCategory: Prediction['category'] = 'custom'
  let bestDistance = Infinity
  let secondDistance = Infinity

  for (const label of model.labels) {
    const prototypes = model.prototypes[label.id] ?? []
    let closest = Infinity
    for (const prototype of prototypes) {
      const value = metric(prototype, features)
      if (value < closest) closest = value
    }
    if (!Number.isFinite(closest)) continue
    if (closest < bestDistance) {
      secondDistance = bestDistance
      bestDistance = closest
      bestLabelId = label.id
      bestName = label.name
      bestCategory = label.category
    } else if (closest < secondDistance) {
      secondDistance = closest
    }
  }

  if (!bestLabelId) return unknownResult

  const unknown = bestDistance > model.unknownThreshold
  const margin = Number.isFinite(secondDistance)
    ? Math.max(0, Math.min(1, (2 * secondDistance) / (bestDistance + secondDistance) - 1))
    : 0
  const quality = Number.isFinite(secondDistance)
    ? Math.max(0, Math.min(1, 1 - bestDistance / (model.unknownThreshold * 2)))
    : 0
  const confidence = unknown ? 0 : Math.max(0, Math.min(1, margin * quality))

  return {
    labelId: bestLabelId,
    name: bestName,
    category: bestCategory,
    confidence,
    unknown,
  }
}

/** Splits samples into a training and a test set, grouped by capture take. */
export function splitByGroup(
  samples: SignSample[],
  trainShare: number,
): { train: SignSample[]; test: SignSample[] } {
  const groups = new Map<string, SignSample[]>()
  for (const sample of samples) {
    const list = groups.get(sample.group) ?? []
    list.push(sample)
    groups.set(sample.group, list)
  }
  const ordered = [...groups.values()].sort((a, b) => a[0]!.createdAt - b[0]!.createdAt)
  const trainGroups = Math.max(1, Math.round(ordered.length * trainShare))
  const train: SignSample[] = []
  const test: SignSample[] = []
  ordered.forEach((group, index) => {
    if (index < trainGroups) train.push(...group)
    else test.push(...group)
  })
  return { train, test }
}

/**
 * Evaluates a model on a held out test set and reports per class precision,
 * recall and the confusion pairs. Adjacent frames never cross the split
 * because the split happens on capture groups.
 */
export function evaluateModel(
  labels: SignLabel[],
  train: SignSample[],
  test: SignSample[],
  options: TrainOptions,
): Evaluation {
  const model = trainModel(labels, train, options)
  // Samples recorded with the other feature layout cannot be scored by this
  // model, so they are excluded and reported instead of counted as unknown.
  const scoredTest = test.filter((sample) => sample.features.length === model.featureLength)
  const ignoredTestCount = test.length - scoredTest.length
  const perClass = new Map<string, ClassScore>()
  for (const label of labels) {
    perClass.set(label.id, {
      labelId: label.id,
      name: label.name,
      correct: 0,
      predicted: 0,
      total: 0,
      recall: 0,
      precision: 0,
    })
  }

  const confusion: Array<[string, string]> = []
  let correct = 0
  let unknown = 0

  for (const sample of scoredTest) {
    const actual = perClass.get(sample.labelId)
    if (actual) actual.total += 1
    const prediction = classify(model, sample.features)
    if (prediction.unknown) {
      unknown += 1
      confusion.push(['', sample.labelId])
      continue
    }
    const predicted = perClass.get(prediction.labelId)
    if (predicted) predicted.predicted += 1
    if (prediction.labelId === sample.labelId) {
      correct += 1
      if (actual) actual.correct += 1
    }
    confusion.push([prediction.labelId, sample.labelId])
  }

  const testCount = scoredTest.length
  const scored = [...perClass.values()]
    .filter((entry) => entry.total > 0 || entry.predicted > 0)
    .map((entry) => {
      const recall = entry.total > 0 ? entry.correct / entry.total : 0
      const precision = entry.predicted > 0 ? entry.correct / entry.predicted : 0
      return { ...entry, recall, precision }
    })

  return {
    testCount,
    trainCount: model.sampleCount,
    ignoredTestCount,
    accuracy: testCount > 0 ? correct / testCount : 0,
    unknownRate: testCount > 0 ? unknown / testCount : 0,
    perClass: scored,
    confusion,
  }
}
