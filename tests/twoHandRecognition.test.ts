import { describe, expect, it } from 'vitest'
import { composeNumbers } from '@/recognition/NumberComposer'
import { NumberRecognizer } from '@/recognition/NumberRecognizer'
import { TwoHandTracker } from '@/recognition/TwoHandTracker'
import { classifyTwoHand, trainTwoHandModel } from '@/recognition/TwoHandSignClassifier'
import { TWO_HAND_FRAME_LENGTH, TWO_HAND_LENGTH, twoHandFrameFromUpdate } from '@/recognition/TemporalFeatureExtractor'
import { FEATURE_LENGTH } from '@/signs/features'
import type { SignLabel, SignSample } from '@/signs/types'
import { frame, makeReading } from './helpers/recognition'

const label = (id: string, name: string): SignLabel => ({
  id,
  name,
  category: 'custom',
  description: '',
  createdAt: 0,
})

const sample = (id: string, labelId: string, value: number, group: string): SignSample => ({
  id,
  labelId,
  features: Array.from({ length: TWO_HAND_LENGTH }, (_, index) => value + (index % 5) * 0.01),
  handedness: 'Right',
  group,
  createdAt: 1,
})

const options = { prototypesPerLabel: 2, unknownThreshold: 0.5, trainShare: 0.5 }

describe('two-hand numbers', () => {
  const tracker = () => new TwoHandTracker({ mirrorLabels: true, handLossMs: 250 })

  it('test 4: reads both hands independently as 5 and 2', () => {
    const instance = tracker()
    const recognizer = new NumberRecognizer()
    let result = recognizer.update(instance.update(frame(0, [])), 0)
    for (let t = 100; t <= 1000; t += 100) {
      result = recognizer.update(
        instance.update(
          frame(t, [
            makeReading('h1', 'Left', ['thumb', 'index', 'middle', 'ring', 'pinky']),
            makeReading('h2', 'Right', ['index', 'middle']),
          ]),
        ),
        t,
      )
    }
    expect(result.left.value).toBe(5)
    expect(result.right.value).toBe(2)
    expect(result.bothKnown).toBe(true)
  })

  it('test 7: a missing hand is never fabricated as zero', () => {
    const instance = tracker()
    const recognizer = new NumberRecognizer()
    for (let t = 0; t <= 600; t += 100) {
      recognizer.update(
        instance.update(frame(t, [makeReading('h1', 'Right', ['index'])])),
        t,
      )
    }
    const update = instance.update(frame(700, []))
    const result = recognizer.update(update, 700)
    expect(result.left.value).toBeNull()
    expect(result.left.known).toBe(false)
    expect(result.right.known).toBe(false)
  })

  it('test 5: addition combines 5 and 2 into 7', () => {
    const numbers = {
      left: { slot: 'left' as const, value: 5, confidence: 1, known: true },
      right: { slot: 'right' as const, value: 2, confidence: 1, known: true },
      bothKnown: true,
    }
    const result = composeNumbers(numbers, 'addition')
    expect(result.result).toBe(7)
    expect(result.text).toContain('7')
  })

  it('test 6: concatenation produces 52', () => {
    const numbers = {
      left: { slot: 'left' as const, value: 5, confidence: 1, known: true },
      right: { slot: 'right' as const, value: 2, confidence: 1, known: true },
      bothKnown: true,
    }
    expect(composeNumbers(numbers, 'concatenation').result).toBe(52)
  })

  it('reports an incomplete result when a hand is unknown', () => {
    const numbers = {
      left: { slot: 'left' as const, value: null, confidence: 0, known: false },
      right: { slot: 'right' as const, value: 2, confidence: 1, known: true },
      bothKnown: false,
    }
    expect(composeNumbers(numbers, 'addition').incomplete).toBe(true)
    expect(composeNumbers(numbers, 'independent').text).toContain('—')
  })
})

describe('two-hand sign classification', () => {
  it('test 10: uses the combined two-hand vector, not separate hands', () => {
    const labels = [label('a', 'Together'), label('b', 'Apart')]
    const samples = [
      sample('a1', 'a', 0, 'g1'),
      sample('b1', 'b', 1, 'g2'),
      sample('a2', 'a', 0.01, 'g3'),
      sample('b2', 'b', 0.99, 'g4'),
    ]
    const model = trainTwoHandModel(labels, samples, options)
    expect(model.featureKind).toBe('two-hand')
    expect(model.featureLength).toBe(TWO_HAND_LENGTH)
    expect(classifyTwoHand(model, samples[0]!.features).labelId).toBe('a')
  })

  it('refuses a single-hand vector and an untrained kind', () => {
    const labels = [label('a', 'Together')]
    const model = trainTwoHandModel(labels, [sample('a1', 'a', 0, 'g1')], options)
    expect(classifyTwoHand(model, new Array(FEATURE_LENGTH).fill(0)).unknown).toBe(true)
    expect(classifyTwoHand({ ...model, featureKind: 'window' }, model.prototypes.a![0]!).unknown).toBe(true)
  })

  it('produces no combined frame when either hand is missing', () => {
    const tracker = new TwoHandTracker({ mirrorLabels: true, handLossMs: 250 })
    expect(twoHandFrameFromUpdate(tracker.update(frame(0, [])))).toBeNull()
    const one = tracker.update(frame(100, [makeReading('h1', 'Right')]))
    expect(twoHandFrameFromUpdate(one)).toBeNull()
    const both = tracker.update(
      frame(200, [makeReading('h1', 'Right'), makeReading('h2', 'Left')]),
    )
    expect(twoHandFrameFromUpdate(both)).toHaveLength(TWO_HAND_FRAME_LENGTH)
  })
})
