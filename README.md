# GestureLink 2.0

A local-first gesture workspace for the browser: sign reading, an air
whiteboard, a gesture-driven camera and a training studio, all running on one
shared MediaPipe pipeline inside the tab.

**Status: in active development.** The application shell, design system,
internationalisation and settings are complete and browser-verified. The vision
engine and workspaces are being built milestone by milestone; see
[`FEATURE_STATUS.md`](./FEATURE_STATUS.md) for the exact state and
[`SPEC.md`](./SPEC.md) for the product specification.

## Principles

- **Local by default.** Camera frames are processed in the tab. There is no
  server, no upload, no account and no paid API.
- **Honest UI.** No mock recognition, no invented statistics, no decorative
  controls. A module that has not shipped says so.
- **One engine.** Every workspace reads from a single camera stream and a single
  tracking loop, so opening a second workspace does not start a second camera.
- **No bundled sign model.** GestureLink does not pretend MediaPipe's generic
  seven-gesture recogniser is a sign language model. Recognised signs come from
  classes trained on this device.

## Requirements

- Node.js 20 or newer, npm 10 or newer.
- A Chromium-based browser (Chrome or Edge) with WebGL and camera access.
- About 60 MB of disk for dependencies, models and the MediaPipe wasm runtime.

## Getting started

```bash
npm install          # install dependencies
npm run models       # one-time: download the two MediaPipe model files (~12 MB)
npm run dev          # http://localhost:5173
```

`predev` and `prebuild` copy the MediaPipe wasm runtime from `node_modules` and
the `.task` models from `models/` into `public/`. Both directories are generated
and are not committed; running the commands above is enough to restore them.

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
| `node scripts/visual-check.mjs` | Drive system Chrome against the preview server, assert the main interactions and write screenshots to `.artifacts/`. Requires `npm run preview` in another terminal. |

The UI check uses the locally installed Chrome at
`C:\Program Files\Google\Chrome\Application\chrome.exe` and `playwright-core`,
so no browser download is needed.

## Architecture

```
src/
  app/          routing, navigation model, UI state, module status manifest
  components/   layout primitives (shell, workspace, page header) and UI kit
  hooks/        system capability probes, media queries
  localization/ typed message catalogues and the translation hook
  pages/        one folder per workspace
  settings/     persisted settings store and document-level appearance sync
  styles/       design tokens and global reset
  utils/        formatting and numeric helpers
  vision/       engine status store (engine itself lands next)
scripts/        asset sync, model download, verification and browser UI check
tests/          Vitest suites
```

- React 19 + TypeScript, Vite, hash routing for host-agnostic static deploys.
- State: zustand stores for settings, shell UI and vision status.
- Styling: CSS Modules over a single token layer; no CSS framework.
- Icons: Lucide. Font: Inter Variable, self-hosted.

## Browser support

Chrome and Edge 120+ are the tested targets. Firefox and Safari are not verified:
MediaPipe tasks and `navigator.permissions.query({name:'camera'})` behaviour
differs there.

## Privacy

Video frames, photos, drawings and training samples stay in the browser profile.
Clearing site data removes them. Nothing is sent to a third party; the only
network requests are the one-time model download performed by `npm run models`.

## Licence

Not yet chosen. Treat the repository as all rights reserved until a licence file
is added.
