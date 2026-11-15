import type { Handedness } from '@/vision/types'

/** The recognition categories the reader keeps strictly separate. */
export type SignCategory = 'alphabet' | 'number' | 'vocabulary' | 'custom'

export interface SignLabel {
  id: string
  name: string
  category: SignCategory
  /** What the sign means, in the user's own words. */
  description: string
  createdAt: number
}

export interface SignSample {
  id: string
  labelId: string
  /** Flattened, normalised feature vector (see `features.ts`). */
  features: number[]
  handedness: Handedness
  /**
   * Samples captured in one continuous take share a group id. The train/test
   * split happens on groups, so neighbouring frames never leak across the
   * split and the evaluation stays honest.
   */
  group: string
  createdAt: number
}

export interface SignModel {
  version: number
  labels: SignLabel[]
  /** Representative feature vectors per label id. */
  prototypes: Record<string, number[][]>
  /** How many prototypes per label the model was built with. */
  prototypesPerLabel: number
  /** Distance above which a prediction is reported as unknown. */
  unknownThreshold: number
  trainedAt: number
  /** Number of training samples the model was built from. */
  sampleCount: number
}

export interface Prediction {
  labelId: string
  name: string
  category: SignCategory
  /** 0…1 estimate derived from the distance margin. */
  confidence: number
  /** True when nothing matched closely enough. */
  unknown: boolean
}

export interface ClassScore {
  labelId: string
  name: string
  correct: number
  predicted: number
  total: number
  /** Share of the actual samples of this class that were recognised. */
  recall: number
  /** Share of the predictions for this class that were correct. */
  precision: number
}

export interface Evaluation {
  /** Samples used for testing. */
  testCount: number
  /** Samples used for training. */
  trainCount: number
  /** Overall share of correct predictions, 0…1. */
  accuracy: number
  /** Share of predictions reported as unknown, 0…1. */
  unknownRate: number
  perClass: ClassScore[]
  /** `[predictedLabelId, actualLabelId]` pairs for the confusion matrix. */
  confusion: Array<[string, string]>
}

export interface TranscriptEntry {
  id: string
  text: string
  at: number
  /** Label ids that produced the text, in order. */
  labelIds: string[]
}

export interface Transcript {
  id: string
  title: string
  text: string
  createdAt: number
  entries: TranscriptEntry[]
}
