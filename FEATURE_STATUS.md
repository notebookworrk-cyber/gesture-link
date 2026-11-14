# Feature status

Honest state of GestureLink 2.0. This file is updated at the end of every
milestone. A feature is only listed under **Completed** when it has been run in
a browser; model accuracy that needs a real hand in front of a camera is never
claimed from a headless test.

Last updated: milestone 2 (vision engine, camera and tracking settings).

## Completed

| Area | What works |
| --- | --- |
| Application shell | Collapsible sidebar (desktop rail), mobile off-canvas drawer with close control, breadcrumb top bar, camera/tracking status chips, context inspector that is inline at ≥1180 px and a drawer below that, skip link, Escape handling, focus return to the menu button. |
| Design system | Token-driven colour, type, spacing, radius, motion and depth. Dark and light themes, five preset accents plus a custom colour, three densities, larger text, higher contrast and reduce-motion overrides applied through `data-*` attributes on `<html>`. No hardcoded colours in page components. |
| Internationalisation | Six complete UI catalogues (English, Hindi, Japanese, Spanish, French, German) typed against the English key set, so a missing key is a compile error. Searchable language picker with native language names. Latin, Devanagari and CJK typography overrides (line height, tracking) verified in screenshots. |
| Appearance persistence | Theme, accent, density, layout flags and language survive a reload (zustand `persist`, versioned key `gesturelink.settings.v1`). An inline pre-paint script applies the saved theme to avoid a flash. |
| Home workspace | Module list driven by the build manifest with honest states, live readiness probes (WebGL renderer string, camera permission state, IndexedDB, storage usage/quota, model file availability), privacy notes. |
| Settings | Appearance, Camera, Hand tracking, Performance, Language, Accessibility, Data and storage, About. Real storage estimate; language note states that changing the UI language does not change recognition. Per-setting explanations on every row. |
| Camera management | One shared `MediaStream` for the whole app (`CameraManager`), device/resolution/frame-rate selection, error mapping for denied, missing, busy and unsupported cameras, stop/retry, release when the tab is hidden, optional auto-release 1.2 s after the last workspace detaches. |
| Hand tracking pipeline | MediaPipe Tasks Vision 0.10.35 hand landmarker loaded lazily from local files, GPU request with reported CPU fallback. Inference runs on an offscreen canvas at 640/480/320 px; adaptive quality steps down only, with warmup and cooldown. One rAF/`requestVideoFrameCallback` loop with visibility pause and low-power throttling. |
| Tracking math | One Euro smoothing per handedness, finger state detection with adjustable PIP and reach thresholds, geometric shape classification (open palm, fist, point, peace, thumbs up, pinch, three, none), pinch distance normalised by palm span, palm speed for future gestures, hold/cooldown/dropout state machine that fires a held shape exactly once. |
| Camera preview | Mirrored preview with a letterbox-aware landmark overlay drawn at device pixel ratio, live capture size, frame rate, inference time, hand count, inference width and the delegate that actually ran. Honest empty, starting, paused and error states. |
| Performance controls | Quality preset, adaptive step-down, delegate (auto/GPU/CPU; the preview always reports what ran) and low-power mode. Capture settings restart the stream, landmarker options reload the model, thresholds and timings apply without a restart. |
| Module placeholders | Sign Reader, Whiteboard, Gesture Camera, Training Studio and Gallery render an explicit "being assembled" state with build status in the inspector. No fake controls or mock recognition. |
| Build and assets | MediaPipe wasm and both model files are copied from `node_modules` / `models` into `public` by `predev`/`prebuild`. No CDN at runtime. Relative base path and hash routing for static hosting. |
| Quality gates | `tsc -b`, ESLint, 58 Vitest unit tests (i18n completeness and placeholders, settings store, formatting, One Euro, geometry and shape classification, feature extraction, gesture state machine, vision config), production build, the Playwright UI check, and a fake-camera pipeline check asserting a live stream, a loaded model, real frame rate and inference values, reported delegate, overlay canvas sizing, stop/start, resolution restart, mirror toggle, persisted frame rate, responsive layouts, auto-release and honest zero-hand reporting. |
| Assets | SVG app icon (`public/favicon.svg`), local Inter variable font, Lucide icon set. |

## Implemented but not verified

| Area | State | What is missing |
| --- | --- | --- |
| Recognition with a real hand | The pipeline runs end to end with the synthetic browser camera. | No real hand was in front of the webcam. Shape classification, smoothing feel and hold timing need a person to move a hand in front of a camera. The synthetic device has no hand, so "No hand" in the stats is correct. |
| GPU delegate | The preview reported `GPU` in headless Chrome with SwiftShader. | The 940M path was not measured. The reported delegate in a real session is the only claim that will be made. |
| Adaptive quality | It stepped 480 → 320 px when inference exceeded the budget under SwiftShader. | Behaviour on the Intel HD 520 / 940M pair is unmeasured; thresholds may need adjustment after real use. |
| Face landmarker | `models/face_landmarker.task` ships and is served locally. | Nothing in the UI uses it yet; face-based features land with the workspaces that need them. |
| Bundle output | Production build succeeds: 398 kB app JS (gzip 121 kB), 136 kB vision chunk (gzip 41 kB), 51 kB React chunk. | Not measured on the target laptop in an interactive real-webcam session. |

## Partial

| Area | State |
| --- | --- |
| Settings surface | Camera, Hand tracking and Performance are implemented. Caption visibility and caption size still have no UI until captions ship. |
| Accessibility settings | Large text, contrast and reduce-motion are wired. Captions remain store-only. |
| Module status | Statuses come from `src/app/moduleStatus.ts` and currently read "In build" / "Planned". They become "Ready" only when the module passes its own browser test. |
| Gesture events | The engine emits one event per held shape with cooldown, and workspaces can subscribe; no workspace consumes them yet. |

## Not implemented

- Sign Language Reader: trainable kNN classifier, finger-count mode, sentence builder, captions, speech output.
- Air Whiteboard: drawing, smoothing, undo/redo, export (PNG/SVG/PDF).
- Gesture Camera: photo capture with a peace sign, countdown, gallery persistence.
- Training Studio: sample collection, class management, training, evaluation, export/import.
- Gallery and persistent storage (IndexedDB) for photos, drawings and training data.
- Speech synthesis and translation. The translation selector only stores a preference; no translation model is bundled.
- Keyboard shortcut overlay behind the top-bar help affordance.
- Deployment workflow (GitHub Pages or other host).

## Explicit non-goals for this build

- No pre-trained Indian Sign Language model is bundled. MediaPipe ships a
  seven-gesture generic recogniser, which is not a sign language model, so it is
  not used as one. Recognition will run on classes trained locally.
- No accuracy figure will be published without a measured evaluation on real
  recordings.
