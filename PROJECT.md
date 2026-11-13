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
| Hand and face landmarkers only | Two models, about 11.6 MB total, both downloaded once and served locally. |
| Canvas 2D | Sufficient for landmark overlays and the whiteboard; avoids a WebGL rendering layer on a 2 GB GPU. |
| Hand-written classifiers | The training studio uses kNN/MLP implemented in TypeScript. No TensorFlow.js dependency. |
| zustand | Small, no provider tree, persistence middleware for settings. |
| Hash router, `base: './'` | The bundle works from any static host or subpath without rewrite rules. |
| CSS Modules + token layer | The spec forbids hardcoded styling; tokens are the only source of colour, type and spacing. |
| Vitest + jsdom, Playwright driving system Chrome | Fast unit tests plus real-browser verification without a 130 MB browser download. |
| IndexedDB for media, LocalStorage for settings | Settings are tiny and synchronous at first paint; photos, drawings and samples need quota-aware storage. |

## Environment constraints

- Windows 10, i7-6500U (2 cores / 4 threads), 8 GB RAM, Intel HD 520 + NVIDIA 940M.
- Target capture at 640×480 with adaptive inference; never claim GPU delegate
  support without measuring it in the running browser.
- Keep caches, models and build output on `D:`. The npm cache redirect lives in a
  machine-local `.npmrc` that is not committed.

## Milestones

1. **Shell, design system, settings** — complete and browser-verified.
2. **Vision engine** — camera manager, landmarkers, smoothing, feature
   extraction, gesture registry and calibration, wired to the status chips.
3. **Air Whiteboard** — fingertip drawing, toolbar, undo/redo, exports.
4. **Gesture Camera and Gallery** — peace-sign capture, countdown, IndexedDB.
5. **Sign Reader and captions** — trainable classifier, finger counting,
   sentence builder, speech.
6. **Training Studio** — sample collection, training, evaluation, import/export.
7. **Integration and release** — keyboard shortcuts, performance pass,
   documentation, push to `main`.

## Verification policy

- No feature is reported as complete from a successful compilation alone.
- Every milestone runs `npm run verify` plus `scripts/visual-check.mjs` against
  the production build at 1440, 1280, 1024 and 390 px, in at least one non-Latin
  locale.
- Recognition accuracy is only reported from measurements on real recordings,
  never estimated.
