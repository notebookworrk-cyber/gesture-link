# Feature status

Honest state of GestureLink 2.0. This file is updated at the end of every
milestone. A feature is only listed under **Completed** when it has been run in
a browser; model accuracy that needs a real hand in front of a camera is never
claimed from a headless test.

Last updated: milestone 1 (shell, design system, settings).

## Completed

| Area | What works |
| --- | --- |
| Application shell | Collapsible sidebar (desktop rail), mobile off-canvas drawer with close control, breadcrumb top bar, camera/tracking status chips, context inspector that is inline at ≥1180 px and a drawer below that, skip link, Escape handling, focus return to the menu button. |
| Design system | Token-driven colour, type, spacing, radius, motion and depth. Dark and light themes, five preset accents plus a custom colour, three densities, larger text, higher contrast and reduce-motion overrides applied through `data-*` attributes on `<html>`. No hardcoded colours in page components. |
| Internationalisation | Six complete UI catalogues (English, Hindi, Japanese, Spanish, French, German) typed against the English key set, so a missing key is a compile error. Searchable language picker with native language names. Latin, Devanagari and CJK typography overrides (line height, tracking) verified in screenshots. |
| Appearance persistence | Theme, accent, density, layout flags and language survive a reload (zustand `persist`, versioned key `gesturelink.settings.v1`). An inline pre-paint script applies the saved theme to avoid a flash. |
| Home workspace | Module list driven by the build manifest with honest states, live readiness probes (WebGL renderer string, camera permission state, IndexedDB, storage usage/quota, model file availability), privacy notes. |
| Settings | Appearance, Language, Accessibility, Data and storage, About. Real storage estimate; language note states that changing the UI language does not change recognition. Per-setting explanations. |
| Module placeholders | Sign Reader, Whiteboard, Gesture Camera, Training Studio and Gallery render an explicit "being assembled" state with build status in the inspector. No fake controls or mock recognition. |
| Build and assets | MediaPipe wasm and both model files are copied from `node_modules` / `models` into `public` by `predev`/`prebuild`. No CDN at runtime. Relative base path and hash routing for static hosting. |
| Quality gates | `tsc -b`, ESLint, 23 Vitest unit tests (i18n completeness and placeholders, settings store, formatting), production build, and a Playwright UI check of themes, accent, density, language switching and persistence, inspector drawer, mobile drawer interaction and horizontal overflow at 1440/1280/1024/390 px. |
| Assets | SVG app icon (`public/favicon.svg`), local Inter variable font, Lucide icon set. |

## Implemented but not verified

| Area | State | What is missing |
| --- | --- | --- |
| Model readiness probe | `HEAD` requests report both `.task` files as ready. | The files have not been loaded into a MediaPipe task yet; that lands with the vision engine. |
| Camera permission probe | Reads `navigator.permissions` and reports granted/denied/not requested. | No `getUserMedia` call is made in this milestone. |
| Bundle output | Production build succeeds (≈323 kB app JS + 51 kB React, gzip ≈118 kB total). | Not measured on the target laptop in a real browsing session. |

## Partial

| Area | State |
| --- | --- |
| Settings surface | Camera, Hand tracking and Performance sections are not rendered yet. Their typed defaults already exist in the settings store. |
| Accessibility settings | Large text, contrast and reduce-motion are wired. Caption visibility and caption size exist in the store but have no UI until captions ship. |
| Module status | Statuses come from `src/app/moduleStatus.ts` and currently read "In build" / "Planned". They become "Ready" only when the module passes its own browser test. |

## Not implemented

- Vision engine: camera manager, hand/face landmarkers, one-euro smoothing, feature extraction, gesture state machine, calibration.
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
