import type { MessageKey } from '@/localization/locales/en'

/** Photo filters that are implemented as real pixel operations. */
export type FilterId =
  | 'natural'
  | 'warm'
  | 'cool'
  | 'bw'
  | 'vintage'
  | 'soft'
  | 'contrast'
  | 'mono'

/** Sticker families that can be anchored to face landmarks. */
export type StickerId = 'glasses' | 'hat' | 'crown' | 'ears' | 'mustache' | 'sparkles'

export interface PhotoRecord {
  id: string
  name: string
  createdAt: number
  /** Pixel size of the stored image. */
  width: number
  height: number
  filter: FilterId
  filterStrength: number
  stickers: StickerId[]
  /** Full size image, stored as a blob in IndexedDB. */
  blob: Blob
  /** Small preview, also stored as a blob. */
  thumb: Blob
}

export interface FilterDefinition {
  id: FilterId
  /** Translation key for the filter name. */
  labelKey: MessageKey
  /** CSS filter operations applied to the preview and the capture. */
  ops: FilterOp[]
  /** Representative colour used by the tray swatch. */
  swatch: string
}

export interface FilterOp {
  /** CSS filter function name, for example `sepia`. */
  fn: string
  /** Value at strength 0. */
  from: number
  /** Value at strength 1. */
  to: number
  /** Unit appended to the value, for example `deg`. */
  unit?: string
}

export interface StickerDefinition {
  id: StickerId
  labelKey: MessageKey
}

export type PhotoStoreStatus = 'idle' | 'loading' | 'ready' | 'error'
