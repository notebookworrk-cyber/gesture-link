import { classify, trainModel, type TrainOptions } from '@/signs/classifier'
import type { Prediction, SignLabel, SignModel, SignSample } from '@/signs/types'
import { TWO_HAND_LENGTH } from './TemporalFeatureExtractor'

/**
 * Two-hand signs are trained and scored as one combined temporal observation.
 * The model refuses a vector that is not a two-hand window, so a one-hand
 * reading can never be silently classified as a two-hand sign.
 */
export function trainTwoHandModel(
  labels: SignLabel[],
  samples: SignSample[],
  options: TrainOptions,
): SignModel {
  return trainModel(labels, samples, options)
}

export function classifyTwoHand(model: SignModel, features: ArrayLike<number>): Prediction {
  if (model.featureKind !== 'two-hand' || features.length !== TWO_HAND_LENGTH) {
    return {
      labelId: '',
      name: '',
      category: 'custom',
      confidence: 0,
      unknown: true,
    }
  }
  return classify(model, features)
}
