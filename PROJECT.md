# Project record

- **Remote:** https://github.com/notebookworrk-cyber/gesture-link
- **Local path:** `D:\gesture link`
- **Specification:** [`SPEC.md`](./SPEC.md) (verbatim copy of the product brief)
- **Current state:** see [`FEATURE_STATUS.md`](./FEATURE_STATUS.md)

## Stack decisions

| Decision | Reason |
| --- | --- |
| React 19 + TypeScript + Vite, npm | The spec requires React and TypeScript. pnpm crashed on this machine (`UV_HANDLE_CLOSING` assertion) and its registry fetch failed repeatedly, so npm is the package manager. The npm cache lives on `D:` because the system drive is nearly full. |
| `@mediapipe/tasks-vision` **0.10.35** | Pinned to the last stable 0.10 line. The 1.x releases changed the wasm layout and were not needed for landmark detection. |
| No Gesture Recognizer task | MediaPipe's recogniser only knows seven generic gestures (thumbs up, victory, etc.). Presenting those as ISL would be dishonest, so it is not used. |
| Hand and face landmarkers only | Two models, about 11.6 MB total. They are bundled into `public/models` for offline use and requested from Google's MediaPipe model store first, because the GitHub Pages copy of the hand model was measured at roughly 60 s on a phone connection against about 1 s from Google storage; the local file is the fallback. |
| Canvas 2D | Sufficient for landmark overlays, the whiteboard and the photo studio composition; avoids a WebGL rendering layer on a 2 GB GPU. |
| Hand-written classifiers | The training studio uses kNN/MLP implemented in TypeScript. No TensorFlow.js dependency. |
| zustand | Small, no provider tree, persistence middleware for settings. |
| Hash router, `base: './'` | The bundle works from any static host or subpath without rewrite rules. |
| CSS Modules + token layer | The spec forbids hardcoded styling; tokens are the only source of colour, type and spacing. |
| Vitest + jsdom, Playwright driving system Chrome | Fast unit tests plus real-browser verification without a 130 MB browser download. |
| IndexedDB for media, LocalStorage for settings | Settings are tiny and synchronous at first paint; photos, drawings and samples need quota-aware storage. |
| Photo filters as CSS filter operations | The preview and the capture run through the same `ctx.filter` string, so what the user sees is exactly what is stored. |

## Environment constraints

- Windows 10, i7-6500U (2 cores / 4 threads), 8 GB RAM, Intel HD 520 + NVIDIA 940M.
- Target capture at 640×480 with adaptive inference; never claim GPU delegate
  support without measuring it in the running browser.
- Keep caches, models and build output on `D:`. The npm cache redirect lives in a
  machine-local `.npmrc` that is not committed.

## Milestones

1. **Shell, design system, settings** — complete and browser-verified.
2. **Vision engine** — camera manager, hand landmarker, smoothing, feature
   extraction, gesture state machine and camera/tracking/performance settings —
   implemented and browser-verified with a synthetic camera. Real-hand accuracy
   is explicitly unverified.
3. **Air Whiteboard** — brushes, shapes, text, notes, images, selection and
   history, per-board documents, presentation mode, PNG/JPEG/SVG/PDF export and
   gesture drawing — implemented and browser-verified at 1440, 1280, 1024 and
   390 px in English and Japanese, including four real export downloads. Real-hand
   air drawing is explicitly unverified.
4. **Gesture Camera and Gallery** — one composited studio canvas with eight real
   filters, six face-anchored sticker families, camera switching, a three second
   gesture countdown, remappable gesture bindings and an IndexedDB photo store;
   gallery with a thumbnail grid, full-size preview, rename, download, delete
   behind a confirmation and a date filter — implemented and browser-verified at
   1440, 1280, 1024 and 390 px in English and Japanese, including a real photo
   download. Real-hand triggering and sticker placement on a real face are
   explicitly unverified.
5. **Sign Reader and captions** — three recognition modes (finger count, control
   shapes, locally trained classifier) with a temporal stabiliser; sentence
   builder with copy, `.txt` export, IndexedDB transcript saving and speech
   output; a caption engine with six modes and presets, surfaced in the reader
   inspector — implemented and typechecked. Real-hand recognition, speech and
   browser behaviour are explicitly unverified.
6. **Training Studio** — labels with categories, take-based sample capture into
   IndexedDB, prototype training, held-out evaluation with per-label precision
   and recall, and JSON dataset export/import — implemented and typechecked. The
   browser run and any real accuracy measurement are still outstanding.
7. **Integration and release** — keyboard shortcuts, performance pass, bundle
   splitting, documentation, push to `main`. The Global Gesture Intelligence
   Engine dashboard is the remaining shared-engine work.

## Verification policy

- No feature is reported as complete from a successful compilation alone.
- Every milestone runs `npm run verify` plus `scripts/visual-check.mjs` against
  the production build at 1440, 1280, 1024 and 390 px, in at least one non-Latin
  locale. Camera work also runs `scripts/vision-check.mjs`, which uses Chrome's
  synthetic capture device (`--use-fake-device-for-media-stream`). The whiteboard
  runs `scripts/whiteboard-check.mjs`, which draws, selects, renames, reloads,
  downloads every export format, enters presentation mode and opens the gesture
  dock with the same synthetic camera. The camera studio runs
  `scripts/camera-check.mjs`, which starts the synthetic camera, checks the
  rendered preview pixels, switches filters and proves the filter reaches the
  canvas, captures two photographs, renames, downloads and deletes one of them,
  checks the binding conflict warning and walks the responsive layouts.
- Synthetic-camera results prove wiring, lifecycle and status reporting only.
  They are always reported separately from real-webcam validation.
- Recognition accuracy is only reported from measurements on real recordings,
  never estimated.
