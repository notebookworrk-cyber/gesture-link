import type { CaptionSettings } from './types'

/** The default caption appearance, used until the user changes it. */
export const defaultCaptionSettings: CaptionSettings = {
  mode: 'sentences',
  preset: 'classic',
  visible: true,
  fontSize: 22,
  fontFamily: 'system',
  fontWeight: 600,
  textColor: '#f2f6f7',
  backgroundColor: '#0b0d0e',
  backgroundOpacity: 0.72,
  outline: false,
  position: 'bottom',
  maxLines: 3,
  maxLineLength: 42,
  wordSpacing: 4,
  lineSpacing: 4,
  durationMs: 4000,
  punctuation: true,
  capitalize: true,
  autoScroll: true,
}

export interface CaptionPresetDefinition {
  id: CaptionSettings['preset']
  settings: Partial<CaptionSettings>
}

/**
 * The presets change the caption treatment, not the recognition. Every preset
 * stays inside the design tokens; only the values below are applied.
 */
export const CAPTION_PRESETS: CaptionPresetDefinition[] = [
  {
    id: 'minimal',
    settings: {
      backgroundOpacity: 0,
      outline: true,
      fontWeight: 600,
      maxLines: 2,
    },
  },
  {
    id: 'classic',
    settings: {
      backgroundOpacity: 0.72,
      outline: false,
      fontWeight: 600,
      maxLines: 3,
    },
  },
  {
    id: 'floating',
    settings: {
      backgroundOpacity: 0.55,
      outline: false,
      fontWeight: 600,
      position: 'center',
      maxLines: 2,
    },
  },
  {
    id: 'contrast',
    settings: {
      backgroundOpacity: 0.95,
      outline: false,
      fontWeight: 700,
      textColor: '#ffffff',
      backgroundColor: '#000000',
      maxLines: 3,
    },
  },
  {
    id: 'large',
    settings: {
      fontSize: 34,
      fontWeight: 700,
      backgroundOpacity: 0.8,
      outline: false,
      maxLines: 3,
    },
  },
  {
    id: 'bilingual',
    settings: {
      backgroundOpacity: 0.72,
      outline: false,
      maxLines: 4,
      fontSize: 20,
    },
  },
  {
    id: 'transcript',
    settings: {
      backgroundOpacity: 0.6,
      outline: false,
      position: 'top',
      maxLines: 6,
      fontSize: 17,
    },
  },
]

const PRESET_MAP = new Map(CAPTION_PRESETS.map((preset) => [preset.id, preset]))

/** Applies a preset on top of the current settings. */
export function applyPreset(
  settings: CaptionSettings,
  id: CaptionSettings['preset'],
): CaptionSettings {
  const preset = PRESET_MAP.get(id)
  if (!preset) return settings
  return { ...settings, ...preset.settings, preset: id }
}

/** Splits a caption into lines of at most the configured length. */
export function wrapCaption(text: string, maxLineLength: number, maxLines: number): string[] {
  if (!text) return []
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= maxLineLength) {
      current += ` ${word}`
    } else {
      lines.push(current)
      current = word
    }
    if (lines.length >= maxLines) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines.slice(0, maxLines)
}
