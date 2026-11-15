export type CaptionMode = 'live' | 'words' | 'sentences' | 'subtitle' | 'large' | 'bilingual'

export type CaptionPreset =
  | 'minimal'
  | 'classic'
  | 'floating'
  | 'contrast'
  | 'large'
  | 'bilingual'
  | 'transcript'

export type CaptionPosition = 'top' | 'center' | 'bottom'

export type CaptionFont = 'system' | 'mono' | 'serif'

export interface CaptionSettings {
  mode: CaptionMode
  preset: CaptionPreset
  visible: boolean
  fontSize: number
  fontFamily: CaptionFont
  fontWeight: 400 | 600 | 700
  textColor: string
  backgroundColor: string
  backgroundOpacity: number
  outline: boolean
  position: CaptionPosition
  maxLines: number
  maxLineLength: number
  wordSpacing: number
  lineSpacing: number
  /** How long a line stays on screen, in milliseconds. */
  durationMs: number
  /** Adds a full stop at the end of a finished sentence. */
  punctuation: boolean
  capitalize: boolean
  autoScroll: boolean
}

export interface CaptionEvent {
  /** The recognised text, for example a label name. */
  text: string
  labelId: string
  /** Timestamp of the recognition. */
  at: number
  /** Optional translation; only set when a translation is really available. */
  translation?: string
}

export interface CaptionLine {
  id: string
  text: string
  /** The translated line, present only in bilingual mode with a translation. */
  secondary?: string
  at: number
  /** Timestamp when the line expires. */
  expiresAt: number
  /** True for the line that is currently being spoken. */
  final: boolean
}
