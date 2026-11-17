/**
 * Speech synthesis wrapper.
 *
 * The browser decides which voices exist; the app only asks for one and reports
 * honestly when none is available. Output is queued instead of cancelled: the
 * previous version called `cancel()` before every utterance, so two signs in a
 * row silently cut each other off. One utterance plays at a time and the queue
 * advances on `end` or `error`.
 */
export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Lists the voices the browser offers, with the current setting applied. */
export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return []
  return window.speechSynthesis.getVoices()
}

export interface SpeakOptions {
  /** Preferred voice name from the settings. */
  voiceName?: string | null
  /** Language tag of the caption language. */
  lang?: string
  rate?: number
  pitch?: number
  /** Silence between two queued utterances, in ms. */
  gapMs?: number
}

interface QueueEntry {
  text: string
  options: SpeakOptions
}

const DEFAULT_GAP_MS = 120

let queue: QueueEntry[] = []
let active = false
let gapTimer: number | null = null
/** Bumped by `stopSpeaking()` so a stale `end` cannot restart the queue. */
let generation = 0

/**
 * Finds a voice for the requested language. A browser that has not populated
 * `getVoices()` yet returns an empty list; that is not proof the language is
 * missing, so the utterance is still allowed to speak.
 */
function voiceFor(options: SpeakOptions): SpeechSynthesisVoice | null {
  const voices = listVoices()
  if (voices.length === 0) return null
  const byName = options.voiceName
    ? voices.find((item) => item.name === options.voiceName)
    : undefined
  if (byName) return byName
  const lang = options.lang?.toLowerCase()
  if (!lang) return null
  return (
    voices.find((item) => item.lang.toLowerCase() === lang) ??
    voices.find((item) => item.lang.toLowerCase().startsWith(`${lang}-`)) ??
    voices.find((item) => item.lang.toLowerCase().split('-')[0] === lang.split('-')[0]) ??
    null
  )
}

/** True when the browser has voices but none for this language. */
export function voiceAvailable(options: SpeakOptions = {}): boolean {
  if (!speechSupported()) return false
  const voices = listVoices()
  if (voices.length === 0) return true
  return voiceFor(options) !== null
}

/** Speaks a text. Returns false when the browser cannot speak it. */
export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!speechSupported() || !text.trim()) return false
  // With voices present but none for this language, speaking would fall back to
  // another language, so the caller is told the truth instead.
  if (!voiceAvailable(options)) return false

  queue.push({ text: text.trim(), options })
  if (!active) void playNext()
  return true
}

function playNext(): void {
  if (active) return
  const entry = queue.shift()
  if (!entry) return

  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(entry.text)
  utterance.lang = entry.options.lang ?? 'en-US'
  utterance.rate = entry.options.rate ?? 1
  utterance.pitch = entry.options.pitch ?? 1
  const voice = voiceFor(entry.options)
  if (voice) utterance.voice = voice

  const current = generation
  active = true
  const finish = () => {
    if (current !== generation) return
    active = false
    if (queue.length === 0) return
    const gap = entry.options.gapMs ?? DEFAULT_GAP_MS
    if (gap <= 0) {
      playNext()
      return
    }
    gapTimer = window.setTimeout(() => {
      gapTimer = null
      if (current !== generation) return
      playNext()
    }, gap)
  }

  utterance.onend = finish
  utterance.onerror = finish
  synth.speak(utterance)
}

export function stopSpeaking(): void {
  generation += 1
  queue = []
  active = false
  if (gapTimer !== null) {
    window.clearTimeout(gapTimer)
    gapTimer = null
  }
  if (speechSupported()) window.speechSynthesis.cancel()
}

/** True while an utterance is playing or waiting in the queue. */
export function isSpeaking(): boolean {
  return active || queue.length > 0
}

/** Number of utterances still waiting. Exposed for the UI and for tests. */
export function pendingSpeech(): number {
  return queue.length
}
