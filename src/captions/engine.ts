import type { CaptionEvent, CaptionLine, CaptionMode, CaptionSettings } from './types'

/** Pause after which a sentence is considered finished, in milliseconds. */
export const SENTENCE_PAUSE_MS = 1200

export interface CaptionEngineState {
  /** The word that was recognised most recently. */
  current: string
  currentTranslation: string | null
  /** Words of the sentence that is being built. */
  buffer: string[]
  bufferTranslation: string[]
  /** Finished lines that are still on screen. */
  lines: CaptionLine[]
  /** Everything the engine has produced, for the transcript view. */
  history: CaptionLine[]
}

function initialState(): CaptionEngineState {
  return {
    current: '',
    currentTranslation: null,
    buffer: [],
    bufferTranslation: [],
    lines: [],
    history: [],
  }
}

/**
 * The caption engine turns recognition events into on-screen lines. It is
 * independent of the reader: any workspace that produces text can feed it.
 *
 * Modes:
 * - `live` shows only the newest word.
 * - `words` keeps every word on screen until it expires.
 * - `sentences` accumulates words into a sentence and shows it when finished.
 * - `subtitle` shows the finished sentence along the bottom of the workspace.
 * - `large` behaves like `sentences` with the accessibility presentation.
 * - `bilingual` shows a second line, but only when a translation exists.
 */
export class CaptionEngine {
  private state: CaptionEngineState = initialState()
  private sequence = 0
  private lastEventAt = 0
  private settings: CaptionSettings

  constructor(settings: CaptionSettings) {
    this.settings = settings
  }

  configure(settings: CaptionSettings): void {
    this.settings = settings
  }

  get snapshot(): CaptionEngineState {
    return {
      ...this.state,
      buffer: [...this.state.buffer],
      bufferTranslation: [...this.state.bufferTranslation],
      lines: [...this.state.lines],
      history: [...this.state.history],
    }
  }

  reset(): void {
    this.state = initialState()
    this.lastEventAt = 0
  }

  /** Feeds one recognised word into the engine. */
  push(event: CaptionEvent): void {
    this.lastEventAt = event.at
    const word = this.settings.capitalize ? capitalise(event.text) : event.text
    const translation = event.translation
      ? this.settings.capitalize
        ? capitalise(event.translation)
        : event.translation
      : null

    this.state.current = word
    this.state.currentTranslation = translation
    this.sequence += 1

    switch (this.settings.mode) {
      case 'live':
        this.state.lines = [this.line(word, translation, event.at, false)]
        this.state.history.push(...this.state.lines)
        break
      case 'words':
        this.state.lines = [
          ...this.state.lines,
          this.line(word, translation, event.at, false),
        ]
        this.state.history.push(this.state.lines[this.state.lines.length - 1]!)
        break
      case 'sentences':
      case 'subtitle':
      case 'large':
      case 'bilingual':
        this.state.buffer.push(word)
        this.state.bufferTranslation.push(translation ?? '')
        break
    }
  }

  /**
   * Advances the engine. Finished sentences are closed when the recogniser
   * pauses, and expired lines are removed.
   */
  tick(now: number): CaptionLine[] {
    if (
      this.state.buffer.length > 0 &&
      now - this.lastEventAt >= SENTENCE_PAUSE_MS
    ) {
      this.flushSentence(now)
    }

    const expires = now + this.settings.durationMs
    this.state.lines = this.state.lines
      .map((line) => ({ ...line, expiresAt: Math.min(line.expiresAt, expires) }))
      .filter((line) => line.expiresAt > now)
    return [...this.state.lines]
  }

  /** Closes the current sentence and shows it as a line. */
  flushSentence(now = Date.now()): CaptionLine | null {
    if (this.state.buffer.length === 0) return null
    const text = this.state.buffer.join(' ')
    const finished = this.settings.punctuation ? `${text}.` : text
    const translationParts = this.state.bufferTranslation.filter((part) => part.length > 0)
    const secondary = translationParts.length > 0 ? translationParts.join(' ') : undefined
    this.sequence += 1
    const line: CaptionLine = {
      id: `line-${this.sequence}`,
      text: finished,
      secondary: this.settings.mode === 'bilingual' ? secondary : undefined,
      at: now,
      expiresAt: now + this.settings.durationMs,
      final: true,
    }
    this.state.buffer = []
    this.state.bufferTranslation = []
    this.state.lines = [...this.state.lines, line]
    this.state.history.push(line)
    return line
  }

  private line(
    text: string,
    translation: string | null,
    at: number,
    final: boolean,
  ): CaptionLine {
    this.sequence += 1
    return {
      id: `line-${this.sequence}`,
      text,
      secondary: this.settings.mode === 'bilingual' ? (translation ?? undefined) : undefined,
      at,
      expiresAt: at + this.settings.durationMs,
      final,
    }
  }
}

function capitalise(value: string): string {
  if (!value) return value
  return value[0]!.toUpperCase() + value.slice(1)
}

/** Text shown in the caption area for a mode without any recognition yet. */
export function captionPlaceholder(mode: CaptionMode): string {
  switch (mode) {
    case 'words':
      return 'Words appear here as they are recognised.'
    case 'sentences':
    case 'subtitle':
    case 'large':
    case 'bilingual':
      return 'Recognised words build up into a sentence here.'
    default:
      return 'The recognised sign appears here.'
  }
}
