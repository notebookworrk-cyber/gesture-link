import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSpeaking,
  pendingSpeech,
  speak,
  speechSupported,
  stopSpeaking,
  voiceAvailable,
} from '@/captions/speech'

class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  pitch = 1
  voice: SpeechSynthesisVoice | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

const voices = [
  { name: 'Test English', lang: 'en-US' },
  { name: 'Test Hindi', lang: 'hi-IN' },
] as SpeechSynthesisVoice[]

const spoken: FakeUtterance[] = []
const synth = {
  speak: vi.fn((utterance: FakeUtterance) => {
    spoken.push(utterance)
  }),
  cancel: vi.fn(),
  getVoices: vi.fn(() => voices),
}

function installSpeech(): void {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: synth,
  })
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: FakeUtterance,
  })
}

describe('speech queue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    spoken.length = 0
    synth.speak.mockClear()
    synth.cancel.mockClear()
    synth.getVoices.mockReturnValue(voices)
    installSpeech()
    stopSpeaking()
    spoken.length = 0
    synth.speak.mockClear()
    synth.cancel.mockClear()
  })

  afterEach(() => {
    stopSpeaking()
    vi.useRealTimers()
  })

  it('reports support only when the API exists', () => {
    expect(speechSupported()).toBe(true)
    Reflect.deleteProperty(window, 'speechSynthesis')
    expect(speechSupported()).toBe(false)
    expect(speak('hello')).toBe(false)
    installSpeech()
  })

  it('plays one utterance at a time and queues the rest', () => {
    expect(speak('first', { lang: 'en-US' })).toBe(true)
    expect(speak('second', { lang: 'en-US' })).toBe(true)

    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(spoken[0]!.text).toBe('first')
    expect(pendingSpeech()).toBe(1)
    expect(isSpeaking()).toBe(true)

    spoken[0]!.onend?.()
    expect(pendingSpeech()).toBe(1)
    vi.advanceTimersByTime(120)

    expect(synth.speak).toHaveBeenCalledTimes(2)
    expect(spoken[1]!.text).toBe('second')
    expect(pendingSpeech()).toBe(0)
  })

  it('ignores blank text', () => {
    expect(speak('   ')).toBe(false)
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('refuses a language the browser has no voice for', () => {
    expect(voiceAvailable({ lang: 'ja-JP' })).toBe(false)
    expect(speak('こんにちは', { lang: 'ja-JP' })).toBe(false)
    expect(synth.speak).not.toHaveBeenCalled()
    expect(pendingSpeech()).toBe(0)
  })

  it('allows speech before the voice list has populated', () => {
    synth.getVoices.mockReturnValue([])
    expect(voiceAvailable({ lang: 'ja-JP' })).toBe(true)
    expect(speak('こんにちは', { lang: 'ja-JP' })).toBe(true)
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('prefers the voice picked in settings', () => {
    speak('नमस्ते', { voiceName: 'Test Hindi', lang: 'hi-IN' })
    expect(spoken[0]!.voice).toBe(voices[1])
  })

  it('falls back to the language prefix', () => {
    speak('hello', { lang: 'en-GB' })
    expect(spoken[0]!.voice).toBe(voices[0])
  })

  it('clears the queue on stop and ignores the old completion', () => {
    speak('first', { lang: 'en-US' })
    speak('second', { lang: 'en-US' })
    stopSpeaking()

    expect(synth.cancel).toHaveBeenCalled()
    expect(pendingSpeech()).toBe(0)
    expect(isSpeaking()).toBe(false)

    spoken[0]!.onend?.()
    vi.advanceTimersByTime(500)
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('advances when an utterance fails', () => {
    speak('first', { lang: 'en-US' })
    speak('second', { lang: 'en-US' })
    spoken[0]!.onerror?.()
    vi.advanceTimersByTime(120)
    expect(synth.speak).toHaveBeenCalledTimes(2)
  })
})
