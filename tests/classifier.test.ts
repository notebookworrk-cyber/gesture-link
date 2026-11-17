import { describe, expect, it } from 'vitest'
import { FEATURE_LENGTH, WINDOW_LENGTH } from '@/signs/features'
import { classify, evaluateModel, selectSamples, splitByGroup, trainModel } from '@/signs/classifier'
import type { SignLabel, SignSample } from '@/signs/types'

const label = (id: string, name: string): SignLabel => ({
  id,
  name,
  category: 'custom',
  description: '',
  createdAt: 0,
})

const windowVector = (value: number, noise = 0): number[] =>
  Array.from({ length: WINDOW_LENGTH }, (_, index) => value + (index % 3) * noise)

const sample = (
  id: string,
  labelId: string,
  features: number[],
  group: string,
  createdAt: number,
): SignSample => ({
  id,
  labelId,
  features,
  handedness: 'Right',
  group,
  createdAt,
})

const options = { prototypesPerLabel: 3, unknownThreshold: 0.5, trainShare: 0.5 }

describe('window model training', () => {
  const labels = [label('a', 'Alpha'), label('b', 'Beta')]
  const samples = [
    sample('a1', 'a', windowVector(0), 'g1', 1),
    sample('b1', 'b', windowVector(1), 'g1', 2),
    sample('a2', 'a', windowVector(0.01), 'g2', 3),
    sample('b2', 'b', windowVector(0.99), 'g2', 4),
  ]

  it('detects the window layout and records its length', () => {
    const model = trainModel(labels, samples, options)
    expect(model.version).toBe(3)
    expect(model.featureKind).toBe('window')
    expect(model.featureLength).toBe(WINDOW_LENGTH)
    expect(model.sampleCount).toBe(4)
    expect(model.ignoredSamples).toBe(0)
  })

  it('classifies a window that matches a trained sign', () => {
    const model = trainModel(labels, samples, options)
    expect(classify(model, windowVector(0.01)).labelId).toBe('a')
    expect(classify(model, windowVector(0.99)).labelId).toBe('b')
  })

  it('reports a distant window as unknown instead of guessing', () => {
    const model = trainModel(labels, samples, options)
    const far = classify(model, windowVector(40))
    expect(far.unknown).toBe(true)
    expect(far.confidence).toBe(0)
  })

  it('refuses a vector from another feature layout', () => {
    const model = trainModel(labels, samples, options)
    const wrong = classify(model, new Array(FEATURE_LENGTH).fill(0))
    expect(wrong.unknown).toBe(true)
  })

  it('ignores older frame samples rather than mixing layouts', () => {
    const mixed = [...samples, sample('old', 'a', Array(FEATURE_LENGTH).fill(0), 'g3', 5)]
    const model = trainModel(labels, mixed, options)
    expect(model.featureKind).toBe('window')
    expect(model.sampleCount).toBe(4)
    expect(model.ignoredSamples).toBe(1)
  })

  it('still trains a frame model when only frame samples exist', () => {
    const frames = [
      sample('a1', 'a', new Array(FEATURE_LENGTH).fill(0), 'g1', 1),
      sample('b1', 'b', new Array(FEATURE_LENGTH).fill(1), 'g1', 2),
    ]
    const model = trainModel(labels, frames, options)
    expect(model.featureKind).toBe('frame')
    expect(model.featureLength).toBe(FEATURE_LENGTH)
    expect(classify(model, new Array(FEATURE_LENGTH).fill(0.01)).labelId).toBe('a')
  })

  it('selectSamples prefers windows and reports the rest', () => {
    const mixed = [...samples, sample('old', 'a', Array(FEATURE_LENGTH).fill(0), 'g3', 5)]
    const chosen = selectSamples(mixed)
    expect(chosen.kind).toBe('window')
    expect(chosen.selected).toHaveLength(4)
    expect(chosen.ignored).toHaveLength(1)
  })
})

describe('grouped evaluation', () => {
  const labels = [label('a', 'Alpha'), label('b', 'Beta')]
  const samples = [
    sample('a1', 'a', windowVector(0), 'g1', 1),
    sample('b1', 'b', windowVector(1), 'g1', 2),
    sample('a2', 'a', windowVector(0.01), 'g2', 3),
    sample('b2', 'b', windowVector(0.99), 'g2', 4),
  ]

  it('keeps a take wholly on one side of the split', () => {
    const { train, test } = splitByGroup(samples, 0.5)
    const trainGroups = new Set(train.map((entry) => entry.group))
    const testGroups = new Set(test.map((entry) => entry.group))
    for (const group of testGroups) expect(trainGroups.has(group)).toBe(false)
    expect(train).toHaveLength(2)
    expect(test).toHaveLength(2)
  })

  it('reports accuracy only on the held-out windows', () => {
    const { train, test } = splitByGroup(samples, 0.5)
    const evaluation = evaluateModel(labels, train, test, options)
    expect(evaluation.testCount).toBe(2)
    expect(evaluation.accuracy).toBe(1)
    expect(evaluation.ignoredTestCount).toBe(0)
  })

  it('reports only the samples actually used for training', () => {
    const { train, test } = splitByGroup(samples, 0.5)
    const withOld = [...train, sample('old', 'a', Array(FEATURE_LENGTH).fill(0), 'g1', 1)]
    const evaluation = evaluateModel(labels, withOld, test, options)
    expect(evaluation.trainCount).toBe(2)
  })

  it('does not count other-layout test samples as unknowns', () => {
    const { train, test } = splitByGroup(samples, 0.5)
    const withOld = [...test, sample('old', 'a', Array(FEATURE_LENGTH).fill(0), 'g3', 5)]
    const evaluation = evaluateModel(labels, train, withOld, options)
    expect(evaluation.testCount).toBe(2)
    expect(evaluation.ignoredTestCount).toBe(1)
    expect(evaluation.unknownRate).toBe(0)
  })
})
