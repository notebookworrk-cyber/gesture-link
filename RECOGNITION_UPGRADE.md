# Recognition upgrade — GestureLink 4.0

This document describes the architectural change that fixes repeated sign
recognition. The short version: **a prediction is no longer a word**. A
prediction feeds a temporal pipeline; only a committed event from that pipeline
may enter the sentence builder or the speech engine.

## The bug being fixed

In 3.0 the reader committed a reading after a three-frame streak and re-armed
when the hand disappeared. A hand that moved slightly, or a classifier that
flickered between two readings, could therefore produce the same word twice.
Speech, captions and the sentence all consumed that duplicate. Raising a
confidence threshold does not fix this: it only makes some flickers rarer.

## New pipeline

```
CAMERA
  ↓ TwoHandTracker (identity + per-hand state + loss/reacquisition)
  ↓ TemporalFeatureExtractor (single-hand windows / combined two-hand windows)
  ↓ SignSegmenter (IDLE → CANDIDATE → STABILIZING → CONFIRMED →
  │               COMMITTED → WAITING_FOR_RELEASE → IDLE)
  ↓ PredictionStabilizer (weighted voting, hysteresis, stability score)
  ↓ DuplicateSuppressor (event identity, neutral release, verified transition)
  ↓ SignEventManager (the only producer of RecognitionEvent)
  ↓ sentence / captions / SpeechEventManager → SpeechEngine
```

Modules live in `src/recognition/` and `src/speech/`. The React page subscribes
to events; it does not own commit logic.

## Recognition modules

| Module | Responsibility |
| --- | --- |
| `HandIdentityManager.ts` | Maps stable MediaPipe ids to physical left/right slots using handedness and temporal association, never detection order. Handles mirrored previews. |
| `TwoHandTracker.ts` | Independent `HandState` for each hand: landmarks, wrist, palm history, scale, confidence, status. A missing hand is held briefly as `lost`, then dropped; the same id reappearing becomes `reacquired`. |
| `TemporalFeatureExtractor.ts` | Single-hand windows (912 values) and combined two-hand windows (1,920 values) with relative distance, orientation, presence and interaction. A missing hand yields no frame. |
| `SignSegmenter.ts` | The explicit state machine, min/max duration, movement boundaries, transition sensitivity and release rules. |
| `PredictionStabilizer.ts` | Weighted temporal voting with confidence hysteresis and an exposed stability score. |
| `DuplicateSuppressor.ts` | Consumes each committed event. Small movement cannot re-arm; only a neutral release or a genuinely different, stable sign can. |
| `SignEventManager.ts` | Creates typed, uniquely identified `RecognitionEvent`s and notifies subscribers. Manual confirmation uses the same guard. |
| `NumberRecognizer.ts` | Per-hand numbers; an unknown or missing hand is never zero. |
| `NumberComposer.ts` | Explicit addition, subtraction, concatenation or independent display. |
| `TwoHandSignClassifier.ts` | Model v3 two-hand classes; refuses single-hand vectors and missing hands. |

## Speech modules

`SpeechQueue`, `SpeechDeduplicator`, `SentenceCommitManager`,
`SpeechEventManager` and `SpeechEngine` live in `src/speech/`. The engine
accepts only `SpeechEvent`s built from committed recognition events. A browser
speech synthesis wrapper is injected, which makes tests deterministic.
Duplicate recognition ids are rejected before a speech event is created, and
speech ids are deduplicated again in the queue. Modes: manual, each confirmed
word, completed sentences and auto after a sentence boundary. Automatic speech
requires the visible preview to be enabled. Pause, resume, stop, replay and
per-phrase cancellation are supported.

## Settings and UI

A new Recognition settings section provides BEGINNER / BALANCED / RESPONSIVE
presets plus minimum confidence, stability duration, minimum sign duration,
release pause, hand-loss tolerance, jitter distance, duplicate suppression,
two-hand mode, number operation and speech controls. The camera preview shows
separate left/right/face/body status with measured confidence; the overlay
colours each hand by physical slot and labels palms. The reader inspector shows
the live recognition state, stabilization progress and last committed event.

## Compatibility

- MediaPipe, the shared engine, whiteboard, gesture camera, gallery, captions,
  training studio, dictionary, calibration and 3.0's model formats keep working.
- Version 1 and 2 models still load and score as single-hand models. New
  combined two-hand recordings train a version 3 model; feature layouts are
  never mixed in one model.
- No pre-trained ISL model is bundled. The vocabulary is still the user's own
  recordings, including any ISL signs they choose to teach.

## Verification

See `TWO_HAND_TEST_REPORT.md` and `SPEAKER_TEST_REPORT.md`. Logic is covered by
deterministic unit tests; real-hand accuracy and hardware timing remain a user
verification task and are not claimed here.
