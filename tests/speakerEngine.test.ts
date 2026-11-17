import { describe, expect, it, vi } from 'vitest'
import { SignEventManager } from '@/recognition/SignEventManager'
import { defaultRecognitionSettings, type RecognitionEvent } from '@/recognition/types'
import { SpeechEngine } from '@/speech/SpeechEngine'
import { SpeechEventManager } from '@/speech/SpeechEventManager'
import { SentenceCommitManager } from '@/speech/SentenceCommitManager'
import type { SpeechSynthLike, SpeechUtteranceLike } from '@/speech/types'

const event = (id: string, text: string): RecognitionEvent => ({
  id,
  key: `key:${text}`,
  text,
  confidence: 0.9,
  source: 'model',
  hands: ['right'],
  startedAt: 0,
  committedAt: 1,
  durationMs: 1,
})

function fakeSynth() {
  const spoken: SpeechUtteranceLike[] = []
  const synth: SpeechSynthLike = {
    speak: (utterance) => spoken.push(utterance),
    cancel: vi.fn(),
    getVoices: () => [],
    pause: vi.fn(),
    resume: vi.fn(),
  }
  return { synth, spoken }
}

const options = { lang: 'en-US', voiceName: null, rate: 1, pitch: 1, volume: 1 }

function engineWith() {
  const fake = fakeSynth()
  const engine = new SpeechEngine(fake.synth, (speech) => ({
    text: speech.text,
    lang: speech.lang,
    rate: speech.rate,
    pitch: speech.pitch,
    volume: speech.volume,
    onend: null,
    onerror: null,
  }), 0)
  return { ...fake, engine }
}

describe('speaker engine', () => {
  it('test 8: a held sign produces one speech event in auto mode', () => {
    const { engine, spoken } = engineWith()
    const manager = new SpeechEventManager(options)
    const committed = event('evt_hold', 'HELLO')
    const speech = manager.consume(committed, 'auto', true)
    expect(speech).not.toBeNull()
    engine.enqueue(speech!)
    spoken[0]!.onend?.()
    expect(spoken).toHaveLength(1)
    expect(spoken[0]!.text).toBe('HELLO')
  })

  it('test 9: a duplicate recognition id is never spoken twice', () => {
    const { spoken } = engineWith()
    const manager = new SpeechEventManager(options)
    const committed = event('evt_duplicate', 'HELLO')
    expect(manager.consume(committed, 'word', true)).not.toBeNull()
    expect(manager.consume(committed, 'word', true)).toBeNull()
    expect(manager.manual(committed)).toBeNull()
    expect(spoken).toHaveLength(0)
  })

  it('keeps queued phrases ordered and can cancel one by id', () => {
    const { engine, spoken } = engineWith()
    const first = event('evt_1', 'ONE')
    const second = event('evt_2', 'TWO')
    const manager = new SpeechEventManager(options)
    engine.enqueue(manager.consume(first, 'word', true)!)
    engine.enqueue(manager.consume(second, 'word', true)!)
    expect(spoken).toHaveLength(1)
    expect(engine.pendingEvents.map((entry) => entry.text)).toEqual(['TWO'])
    expect(engine.cancel(engine.pendingEvents[0]!.id)).toBe(true)
    spoken[0]!.onend?.()
    expect(spoken).toHaveLength(1)
  })

  it('supports pause, resume, stop and replay', () => {
    const { engine, spoken, synth } = engineWith()
    const manager = new SpeechEventManager(options)
    engine.enqueue(manager.manual(event('evt_replay', 'AGAIN'))!)
    spoken[0]!.onend?.()
    engine.pause()
    expect(engine.state.paused).toBe(true)
    engine.resume()
    expect(engine.state.paused).toBe(false)
    expect(engine.replay()).toBe(true)
    spoken[1]!.onend?.()
    expect(spoken.map((item) => item.text)).toEqual(['AGAIN', 'AGAIN'])
    engine.stop()
    expect(synth.cancel).toHaveBeenCalled()
    expect(engine.state.pending).toBe(0)
  })

  it('auto speech stays off until the preview is enabled', () => {
    const manager = new SpeechEventManager(options)
    expect(manager.consume(event('evt_auto', 'NO'), 'auto', false)).toBeNull()
    expect(manager.consume(event('evt_auto', 'NO'), 'auto', true)).not.toBeNull()
  })
})

describe('sentence commit', () => {
  it('joins committed words into exactly one sentence', () => {
    const sentences = new SentenceCommitManager()
    expect(sentences.push(event('e1', 'HELLO'))).toBe(false)
    expect(sentences.push(event('e2', 'WORLD'))).toBe(false)
    expect(sentences.sentence).toBe('HELLO WORLD')
    expect(sentences.flush()?.text).toBe('HELLO WORLD')
    expect(sentences.flush()).toBeNull()
  })

  it('detects a sentence boundary from punctuation', () => {
    const sentences = new SentenceCommitManager()
    expect(sentences.push(event('e1', 'HELLO.'))).toBe(true)
  })
})

describe('raw predictions cannot become speech', () => {
  it('requires a full recognition event from the event manager', () => {
    const recognizer = new SignEventManager(defaultRecognitionSettings)
    const manager = new SpeechEventManager(options)
    // A raw candidate with no id/committedAt cannot be passed as an event;
    // only the event manager can produce one.
    for (let now = 0; now <= 1000; now += 100) {
      recognizer.update(
        {
          key: '5',
          text: '5',
          confidence: 0.9,
          source: 'count',
          hands: ['right'],
        },
        0.01,
        now,
      )
    }
    const emitted = vi.fn()
    recognizer.subscribe(emitted)
    for (let now = 1100; now <= 2500; now += 100) {
      recognizer.update(
        {
          key: '2',
          text: '2',
          confidence: 0.9,
          source: 'count',
          hands: ['right'],
        },
        0.01,
        now,
      )
    }
    expect(emitted).toHaveBeenCalledTimes(1)
    const speech = manager.consume(emitted.mock.calls[0]![0], 'word', true)
    expect(speech?.text).toBe('2')
  })
})
