import { create } from 'zustand'
import {
  clearSamples,
  deleteLabel,
  deleteSamples,
  deleteTranscript,
  listLabels,
  listSamples,
  listTranscripts,
  loadModel,
  saveLabel,
  saveModel,
  saveSamples,
  saveTranscript,
} from './db'
import { evaluateModel, splitByGroup, trainModel, type TrainOptions } from './classifier'
import type { Evaluation, SignLabel, SignModel, SignSample, Transcript } from './types'

export type SignsStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface SignsState {
  labels: SignLabel[]
  samples: SignSample[]
  model: SignModel | null
  transcripts: Transcript[]
  evaluation: Evaluation | null
  status: SignsStatus
  error: string | null
  init: () => Promise<void>
  addLabel: (label: SignLabel) => Promise<void>
  removeLabel: (id: string) => Promise<void>
  addSamples: (samples: SignSample[]) => Promise<void>
  removeSamples: (ids: string[]) => Promise<void>
  clearAllSamples: () => Promise<void>
  train: (options: TrainOptions) => Promise<SignModel | null>
  evaluate: (options: TrainOptions) => Promise<Evaluation | null>
  saveTranscriptEntry: (transcript: Transcript) => Promise<void>
  removeTranscript: (id: string) => Promise<void>
}

let initPromise: Promise<void> | null = null

export const useSigns = create<SignsState>()((set, get) => ({
  labels: [],
  samples: [],
  model: null,
  transcripts: [],
  evaluation: null,
  status: 'idle',
  error: null,

  init: async () => {
    if (get().status === 'ready') return
    if (initPromise) return initPromise
    initPromise = (async () => {
      set({ status: 'loading', error: null })
      try {
        const [labels, samples, model, transcripts] = await Promise.all([
          listLabels(),
          listSamples(),
          loadModel(),
          listTranscripts(),
        ])
        set({ labels, samples, model, transcripts, status: 'ready', error: null })
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'The sign database could not be opened.',
        })
      }
    })()
    return initPromise
  },

  addLabel: async (label) => {
    try {
      await saveLabel(label)
      set({ labels: [...get().labels, label], error: null })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'The sign could not be saved.',
      })
    }
  },

  removeLabel: async (id) => {
    const previous = get().labels
    const samples = get().samples
    set({ labels: previous.filter((label) => label.id !== id) })
    try {
      await deleteLabel(id)
      await deleteSamples(samples.filter((sample) => sample.labelId === id).map((sample) => sample.id))
      set({
        samples: samples.filter((sample) => sample.labelId !== id),
        error: null,
      })
    } catch (error) {
      set({
        labels: previous,
        status: 'error',
        error: error instanceof Error ? error.message : 'The sign could not be deleted.',
      })
    }
  },

  addSamples: async (samples) => {
    if (samples.length === 0) return
    try {
      await saveSamples(samples)
      set({ samples: [...get().samples, ...samples], error: null })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'The samples could not be saved.',
      })
    }
  },

  removeSamples: async (ids) => {
    const previous = get().samples
    set({ samples: previous.filter((sample) => !ids.includes(sample.id)) })
    try {
      await deleteSamples(ids)
      set({ error: null })
    } catch (error) {
      set({
        samples: previous,
        status: 'error',
        error: error instanceof Error ? error.message : 'The samples could not be deleted.',
      })
    }
  },

  clearAllSamples: async () => {
    const previous = get().samples
    set({ samples: [] })
    try {
      await clearSamples()
      set({ error: null })
    } catch (error) {
      set({
        samples: previous,
        status: 'error',
        error: error instanceof Error ? error.message : 'The samples could not be cleared.',
      })
    }
  },

  train: async (options) => {
    const { labels, samples } = get()
    if (labels.length === 0 || samples.length === 0) {
      set({ error: 'Add at least one sign and a few samples before training.' })
      return null
    }
    try {
      const model = trainModel(labels, samples, options)
      await saveModel(model)
      set({ model, evaluation: null, error: null })
      return model
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'The model could not be trained.',
      })
      return null
    }
  },

  evaluate: async (options) => {
    const { labels, samples } = get()
    if (labels.length === 0 || samples.length === 0) {
      set({ error: 'Add at least one sign and a few samples before evaluating.' })
      return null
    }
    try {
      const { train, test } = splitByGroup(samples, options.trainShare)
      if (test.length === 0) {
        set({ error: 'Capture samples in at least two separate takes to evaluate the model.' })
        return null
      }
      const evaluation = evaluateModel(labels, train, test, options)
      set({ evaluation, error: null })
      return evaluation
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'The model could not be evaluated.',
      })
      return null
    }
  },

  saveTranscriptEntry: async (transcript) => {
    try {
      await saveTranscript(transcript)
      const transcripts = get().transcripts.filter((item) => item.id !== transcript.id)
      set({ transcripts: [transcript, ...transcripts], error: null })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'The transcript could not be saved.',
      })
    }
  },

  removeTranscript: async (id) => {
    const previous = get().transcripts
    set({ transcripts: previous.filter((transcript) => transcript.id !== id) })
    try {
      await deleteTranscript(id)
      set({ error: null })
    } catch (error) {
      set({
        transcripts: previous,
        status: 'error',
        error: error instanceof Error ? error.message : 'The transcript could not be deleted.',
      })
    }
  },
}))

/** Test helper: resets the module state between test files. */
export function resetSignsForTests(): void {
  initPromise = null
  useSigns.setState({
    labels: [],
    samples: [],
    model: null,
    transcripts: [],
    evaluation: null,
    status: 'idle',
    error: null,
  })
}
