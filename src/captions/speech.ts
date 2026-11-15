/**
 * Speech synthesis wrapper. The browser decides which voices exist; the app
 * only asks for one and reports honestly when none is available.
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
}

/** Speaks a text. Returns false when the browser cannot speak. */
export function speak(text: string, options: SpeakOptions = {}): boolean {
  if (!speechSupported() || !text.trim()) return false
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = options.lang ?? 'en-US'
  utterance.rate = options.rate ?? 1
  utterance.pitch = options.pitch ?? 1
  const voices = listVoices()
  const voice =
    voices.find((item) => item.name === options.voiceName) ??
    voices.find((item) => item.lang === utterance.lang)
  if (voice) utterance.voice = voice
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking(): void {
  if (!speechSupported()) return
  window.speechSynthesis.cancel()
}
