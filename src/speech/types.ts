import type { RecognitionEvent } from '@/recognition/types'
import type { SpeechMode } from '@/settings/settingsStore'

export type SpeechSource = 'word' | 'sentence' | 'manual'

export interface SpeechEvent {
  /** Unique id; identical recognition ids never produce two speech events. */
  id: string
  recognitionId: string
  text: string
  source: SpeechSource
  lang: string
  voiceName: string | null
  rate: number
  pitch: number
  volume: number
  at: number
}

export interface SpeechOptions {
  lang: string
  voiceName?: string | null
  rate?: number
  pitch?: number
  volume?: number
}

export interface SpeechSettingsLike {
  mode: SpeechMode
  preview: boolean
  autoEnabled: boolean
}

export interface SpeechState {
  speaking: boolean
  paused: boolean
  pending: number
  lastText: string
}

export interface SpeechUtteranceLike {
  text: string
  lang: string
  rate: number
  pitch: number
  volume: number
  voice?: SpeechSynthesisVoice | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

export interface SpeechSynthLike {
  speak(utterance: SpeechUtteranceLike): void
  cancel(): void
  getVoices(): SpeechSynthesisVoice[]
  pause(): void
  resume(): void
}

export function eventToSpeech(
  event: RecognitionEvent,
  source: SpeechSource,
  options: SpeechOptions,
): SpeechEvent {
  return {
    id: `sp_${event.id}_${source}`,
    recognitionId: event.id,
    text: event.text,
    source,
    lang: options.lang,
    voiceName: options.voiceName ?? null,
    rate: options.rate ?? 1,
    pitch: options.pitch ?? 1,
    volume: options.volume ?? 1,
    at: event.committedAt,
  }
}
