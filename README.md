# GestureLink 3.0

A local-first gesture workspace for the browser: a sign reader with
motion-aware user-trained recognition, an air whiteboard, a gesture camera, a
training studio, a sign dictionary and a shared MediaPipe tracking engine.

**Status:** the application shell, design system, six-locale interface and
settings are browser-verified. Tracking, training and recognition are unit
tested and implemented, but real-hand accuracy has **not** been measured in
this repository. See [`FEATURE_STATUS.md`](./FEATURE_STATUS.md) for the exact
state and [`MODEL_CARD.md`](./MODEL_CARD.md) for what the model is and is not.

## Principles

- **Local by default.** Camera frames are processed in the tab. No server, no
  upload, no account, no paid API.
- **Honest UI.** No mock recognition, no invented statistics, no decorative
  controls. A module that has not shipped says so.
- **One engine.** Every workspace shares one camera stream, one hand/pose
  pipeline and one set of diagnostics.
- **No bundled sign model.** The vocabulary comes from your recordings. There
  is no ISL dataset or accuracy claim; see the model card.

## What is included

- **Sign Reader** — count, geometric-control-shape and trained-model modes; a
  1.1 s sliding window over hand shape, shoulder-space movement and the
  second-hand offset; stabilised commits, honest unknown state, captions,
  sentence builder, queued speech and JSON history export.
- **Training Studio** — labels in four categories, take recording,
  take-grouped train/test split, prototype training, held-out evaluation,
  dataset export/import and an honest report of samples that cannot be used.
- **Sign Dictionary** — every label with its sample count, last recording and
  whether the current model actually covers it.
- **Air Whiteboard** — six brushes, shapes, text, sticky notes, selection and
  object editing, documents/pages, autosave and PNG/JPEG/SVG/PDF export.
- **Gesture Camera** — eight real filters, face-anchored stickers, remappable
  gesture bindings, countdown, local photo storage and gallery management.
- **Calibration** — a six-step guided reach-box workspace with stored profiles.
- **Settings** — appearance, camera, tracking, performance, language,
  accessibility, data and about; persisted with versioned local storage.

## Requirements

- Node.js 20 or newer, npm 10 or newer.
- A Chromium-based browser (Chrome or Edge) with WebGL and camera access.
- About 60 MB of disk for dependencies, models and the MediaPipe wasm runtime.
- A real webcam is required for any claim about tracking or recognition
  quality. The automated browser checks use a synthetic camera with no hand.

## Getting started

```bash
npm install          # install dependencies
npm run models       # one-time: download the MediaPipe model files
npm run dev          # http://localhost:5173
```

`predev` and `prebuild` copy the MediaPipe wasm runtime from `node_modules` and
the `.task` models from `models/` into `public/`. Both directories are generated
and are not committed; the commands above restore them. At runtime the
landmarker models are requested CDN-first (the same bytes) with the local copy
as an automatic fallback.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server. |
| `npm run build` | Typecheck and build the production bundle into `dist/`. |
| `npm run preview` | Serve the production build on port 4173. |
| `npm run typecheck` | `tsc -b` with project references. |
| `npm run lint` | ESLint over `src`, `tests` and `scripts`. |
| `npm test` | Vitest unit tests (jsdom). |
| `npm run verify` | Typecheck, lint, tests and build in sequence. |
| `npm run models` | Download the MediaPipe hand and face model bundles. |
| `npm run check:ui` | Drive system Chrome against the preview server, assert shell interactions and write screenshots to `.artifacts/`. |
| `npm run check:vision` | Fake-camera vision check against the preview server. |

The browser checks use the locally installed Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` and `playwright-core`,
so no browser download is needed.

## Architecture

```
src/
  app/          routing, navigation model, UI state, module status
  captions/     caption engine, presets, live view, speech queue
  components/   layout primitives and the UI kit
  hooks/        system capability probes, media queries
  localization/ typed message catalogues and the translation hook
  pages/        one folder per workspace
  photos/       capture, filters, sticker anchors and photo store
  settings/     persisted settings store and document-level appearance sync
  signs/        features, sliding window, classifier, stores and dictionaries
  styles/       design tokens and global reset
  utils/        formatting and numeric helpers
  vision/       shared engine, camera, hand/pose/face trackers, calibration
  whiteboard/   structured document model, rendering, gesture and export
scripts/        asset sync, model download, verification and browser checks
tests/          Vitest suites
```

- React 19 + TypeScript, Vite, hash routing for host-agnostic static deploys.
- State: zustand stores for settings, shell UI, vision status, signs, photos
  and whiteboard documents.
- Styling: CSS Modules over a single token layer; no CSS framework.
- Icons: Lucide. Font: Inter Variable, self-hosted.
- Storage: IndexedDB for samples, models, transcripts, photos and boards;
  versioned local storage for preferences.

## Browser support

Chrome and Edge 120+ are the tested targets. Firefox and Safari are not
verified: MediaPipe tasks and `navigator.permissions.query({name:'camera'})`
behaviour differs there.

## Privacy

Video frames, photos, drawings, training samples and models stay in the
browser profile. Clearing site data removes them. Nothing is uploaded; the
only network requests are the optional CDN-first model fetch described above.

## Known limitations

- No pre-trained sign-language model and no ISL accuracy claim.
- Real-hand tracking, window timing and recognition quality need a user-run
  webcam session; the automated checks cannot supply a hand or a face.
- Two-handed signs use only the second hand's offset and presence.
- No translation model; bilingual captions stay single-line without one.
- The main JS chunk is about 1.17 MB (361 kB gzip) and exceeds Vite's default
  900 kB warning; route-level code splitting is still pending.

## Licence

Not yet chosen. Treat the repository as all rights reserved until a licence
file is added.
