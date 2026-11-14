import type { MessageKey } from '@/localization/locales/en'
import type { StaticGestureId } from './types'
import type { VisionErrorCode } from './visionStatus'

const ERROR_KEYS: Record<VisionErrorCode, MessageKey> = {
  unsupported: 'vision.errorUnsupported',
  denied: 'vision.errorDenied',
  'not-found': 'vision.errorNotFound',
  'in-use': 'vision.errorInUse',
  model: 'vision.errorModel',
  unknown: 'vision.errorUnknown',
}

export function visionErrorKey(code: VisionErrorCode): MessageKey {
  return ERROR_KEYS[code]
}

const GESTURE_KEYS: Record<StaticGestureId, MessageKey> = {
  'open-palm': 'gesture.openPalm',
  fist: 'gesture.fist',
  point: 'gesture.point',
  peace: 'gesture.peace',
  'thumbs-up': 'gesture.thumbsUp',
  pinch: 'gesture.pinch',
  three: 'gesture.three',
  none: 'gesture.none',
}

export function gestureKey(id: StaticGestureId): MessageKey {
  return GESTURE_KEYS[id]
}
