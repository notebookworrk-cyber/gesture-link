import { SpeechEngine } from './SpeechEngine'
import type { SpeechEvent, SpeechSynthLike, SpeechUtteranceLike } from './types'

let engine: SpeechEngine | null = null

function browserSynth(): SpeechSynthLike | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return {
    speak: (utterance) => {
      window.speechSynthesis.speak(utterance as unknown as SpeechSynthesisUtterance)
    },
    cancel: () => window.speechSynthesis.cancel(),
    getVoices: () => window.speechSynthesis.getVoices(),
    pause: () => window.speechSynthesis.pause(),
    resume: () => window.speechSynthesis.resume(),
  }
}

function pickVoice(event: SpeechEvent): SpeechSynthesisVoice | null {
  const voices = typeof window === 'undefined' ? [] : window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const byName = event.voiceName
    ? voices.find((voice) => voice.name === event.voiceName)
    : undefined
  if (byName) return byName
  const lang = event.lang.toLowerCase()
  return (
    voices.find((voice) => voice.lang.toLowerCase() === lang) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${lang}-`)) ??
    null
  )
}

/** Lazily created singleton using the browser's real speech synthesis. */
export function getSpeechEngine(): SpeechEngine | null {
  if (engine) return engine
  const synth = browserSynth()
  if (!synth) return null
  engine = new SpeechEngine(synth, (event): SpeechUtteranceLike => {
    const utterance = new SpeechSynthesisUtterance(event.text)
    utterance.lang = event.lang
    utterance.rate = event.rate
    utterance.pitch = event.pitch
    utterance.volume = event.volume
    const voice = pickVoice(event)
    if (voice) utterance.voice = voice
    return utterance as unknown as SpeechUtteranceLike
  })
  return engine
}
