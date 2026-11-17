# Project audit — GestureLink 2.0 baseline

Audit taken at commit `0abf033` (branch `main`) before any 3.0 work. Every claim
below was checked against the repository and the recorded build output; nothing
is estimated from the UI text alone.

## What the application is

A single-page React 19 + TypeScript application that runs entirely in the
browser. A webcam stream feeds MediaPipe Tasks Vision landmarks, which drive
three workspaces (Sign Reader, Whiteboard, Gesture Camera) plus a Training
Studio. There is no server, no account and no upload path. Routing is hash based
for static hosting; state is zustand with persisted settings and IndexedDB for
photographs, samples, models and transcripts.

Measured size at the audit point: 99 TypeScript modules, ~21.9k lines in `src`,
`dist` app bundle 1,099 kB (338 kB gzip), 126 tests in 16 files, clean typecheck,
lint and production build.

## Architecture

| Layer | Modules | Notes |
| --- | --- | --- |
| Shell | `src/app/*`, `src/components/layout/*` | Hash router, collapsible sidebar, mobile drawer, top bar, context inspector. |
| Vision | `src/vision/*` | `VisionEngine` owns one `MediaStream` and one hand landmarker; `CameraManager` handles devices; `faceTracker` is lazy; `oneEuro` smooths; `gestureStateMachine` de-duplicates held shapes. |
| Recognition | `src/signs/*` | `features.ts` extracts 69 features from one hand; `classifier.ts` is a kNN over prototypes; `reader.ts` maps readings to words; `store.ts` persists labels, samples, models and transcripts. |
| Output | `src/captions/*` | `CaptionEngine` line timing and modes; `speech.ts` wraps `speechSynthesis`. |
| Studio | `src/photos/*`, `src/pages/GestureCamera/*` | Canvas composition of video, filter and stickers; blob storage in IndexedDB. |
| Whiteboard | `src/whiteboard/*` | Object model, tools, selection, history, documents, export. |
| Settings | `src/settings/*` | Persisted store, appearance sync, vision sync. |
| i18n | `src/localization/*` | Six catalogues typed against the English key set. |

## What is genuinely working

- One shared camera session with error mapping, device selection, stop/retry and
  auto-release. The preview reports the delegate that actually ran.
- Hand landmarking with GPU request and CPU fallback, adaptive inference width,
  visibility pause and low-power throttling.
- Whiteboard, Gesture Camera and Gallery behaviour recorded in
  `FEATURE_STATUS.md` and exercised by the Playwright checks.
- Training pipeline with take-grouped held-out evaluation; the reported accuracy
  is measured, not asserted.
- The persistence layer survives reloads (settings, photographs, transcripts).

## Structural weaknesses found

1. **Hand identity was keyed on handedness.** `VisionEngine` held one smoother,
   one gesture machine and one last-palm position per `Left`/`Right` label.
   MediaPipe flips that label when hands cross or a palm turns over, so a flip
   reset smoothing and the hold timer in the middle of a sign. This is the main
   cause of "the app loses the hand mid-gesture".
2. **Features were image-normalised, not body-normalised.** `featuresFromReading`
   uses image coordinates. Stepping back or turning sideways changes every
   distance, so the same sign lands in a different place in feature space.
3. **Only `frame.hands[0]` is consumed by the reader.** Two-handed signs cannot
   be represented at all, and the second hand is silently ignored.
4. **No temporal model.** Recognition is a static frame classification with a
   3-frame stabiliser. There is no velocity, trajectory or pose context, so
   movement-based signs are out of reach.
5. **No measured diagnostics.** The UI showed fps, inference time and hand count,
   but no percentiles, dropped frames or long tasks, and no way to attach a
   number to a performance complaint.
6. **Speech restarts on every call.** `speak()` cancels the current utterance
   before speaking, so queued output cuts itself off.
7. **Recognition vocabulary is only what the user recorded.** There is no ISL
   dataset in the build and no ISL model. Any interface that implies otherwise
   would be false.
8. **Calibration did not exist.** Hand position mapped directly to workspace
   coordinates, so reach differed per person and per seating position.

## Honest limits of the baseline

- No ISL accuracy exists or can exist without signer recordings.
- Real-hand behaviour was never verified: the synthetic browser camera has no
  hand, so every "tracking works" claim beyond unit tests is still pending a
  person in front of a webcam.
- The local Python installation is broken (no `Lib`, no `pip`), so no Python
  toolchain can be assumed for training or evaluation.
- fps and inference baselines cannot be measured headlessly on this machine;
  SwiftShader numbers do not predict the Intel GPU path.

## Baseline verification (actual commands, actual results)

| Check | Result |
| --- | --- |
| `npx tsc -b` | clean |
| `npm run lint` | clean |
| `npx vitest run` | 126 passed / 16 files |
| `npm run build` | success, 1,099 kB app JS (338 kB gzip) |

## Consequence for 3.0

The tracking foundation is the first thing to fix, because recognition quality
cannot improve while identity and scale invariance are broken. The staged plan
is in `IMPLEMENTATION_PLAN.md`.
