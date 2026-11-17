import { describe, expect, it } from 'vitest'
import { buildDictionary } from '@/signs/dictionary'
import type { SignLabel, SignModel, SignSample } from '@/signs/types'

const label = (id: string, name: string): SignLabel => ({
  id,
  name,
  category: 'custom',
  description: '',
  createdAt: 0,
})

const sample = (id: string, labelId: string, createdAt: number): SignSample => ({
  id,
  labelId,
  features: [1, 2, 3],
  handedness: 'Right',
  group: 'group',
  createdAt,
})

const model = (ids: string[]): SignModel => ({
  version: 2,
  featureKind: 'window',
  featureLength: 912,
  labels: ids.map((id) => label(id, id)),
  prototypes: Object.fromEntries(ids.map((id) => [id, [[1]]])),
  prototypesPerLabel: 3,
  unknownThreshold: 0.5,
  trainedAt: 1000,
  sampleCount: 2,
})

describe('sign dictionary', () => {
  const labels = [label('a', 'Alpha'), label('b', 'Beta'), label('c', 'Gamma')]

  it('marks a label without samples as needing recordings', () => {
    const rows = buildDictionary(labels, [], null)
    expect(rows.map((row) => row.status)).toEqual([
      'noSamples',
      'noSamples',
      'noSamples',
    ])
    expect(rows[0]!.lastAt).toBeNull()
  })

  it('distinguishes recorded samples from model coverage', () => {
    const rows = buildDictionary(labels, [sample('s1', 'a', 10), sample('s2', 'a', 20)], model(['a']))
    expect(rows[0]).toMatchObject({ sampleCount: 2, lastAt: 20, inModel: true, status: 'ready' })
    expect(rows[1]!.status).toBe('noSamples')
  })

  it('reports a recorded label that is not in the current model', () => {
    const rows = buildDictionary(labels, [sample('s1', 'b', 30)], model(['a']))
    expect(rows[1]).toMatchObject({ sampleCount: 1, lastAt: 30, inModel: false, status: 'notInModel' })
  })

  it('uses the latest sample timestamp', () => {
    const rows = buildDictionary(
      labels,
      [sample('s1', 'a', 5), sample('s2', 'a', 50), sample('s3', 'a', 20)],
      null,
    )
    expect(rows[0]!.lastAt).toBe(50)
  })

  it('does not treat a label as ready just because samples exist', () => {
    const rows = buildDictionary(labels, [sample('s1', 'c', 1)], null)
    expect(rows[2]!.status).toBe('notInModel')
  })
})
