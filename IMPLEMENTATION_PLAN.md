# GestureLink 3.0 — implementation plan

Working branch: `feat/3.0`, branched from `0abf033`.
Rule for every stage: land code, tests and documentation together; only claim a
capability after it ran in this repository with the stated command.

Legend: **Done** = implemented and verified by a command in this repo.
**Built, unverified** = implemented and unit tested, but not exercised with a
real hand/face in front of a webcam. **Pending** = not started.

## Stage 0 — Audit and baseline (Done)

- `PROJECT_AUDIT.md` records architecture, real weaknesses and the measured
  baseline: 126 tests, 1,099 kB bundle, clean typecheck and lint.
- Baseline gate re-run before any 3.0 change.

## Stage 1 — Tracking foundation (Done; real-camera check pending)

Goal: stable identity, body-relative scale, honest measurements, and a
calibration path. This is what every later stage depends on.

Shipped:

- `TemporalBuffer` — fixed-capacity, allocation-free per-hand history.
- `HandIdentityTracker` — nearest-position ids with handedness only as a
  tiebreaker; tracks expire after 1 s. Smoothers, gesture machines and last-palm
  speed now key on `hand-1`/`hand-2`, not on `Left`/`Right`.
- `LandmarkNormalizer` — shoulder frame from pose (origin = shoulder midpoint,
  unit = shoulder width) and `normalizeHand`; falls back to the hand's own wrist
  with `source: 'hand'` when pose is unavailable, and says which was used.
- `PoseTracker` — MediaPipe pose **lite**, CDN first with a local fallback, own
  cadence (8 Hz default), CPU fallback reported; a failed load degrades to
  hand-relative features instead of stopping tracking.
- `FrameScheduler` — one request in flight, latest frame wins, first frame
  always processed, `minIntervalMs` rate limit for low-power mode.
- `TrackingDiagnostics` — hand/pose/face p50 and p95, processed and dropped
  frames, long tasks and longest task, model load time, pipeline latency.
- `calibration.ts` + a six-step Calibration workspace — four recorded edges,
  burst sampling with median retention, save/clear, stored under
  `gesturelink.calibration.v1`.
- `VisionEngine` rewiring: pose pass on its own cadence, canonical hands on every
  reading, per-hand history exposed via `historyFor(id)`, diagnostics in status.
- Settings: `tracking.pose` (`off`/`lite`) and `poseRateHz` (default 8).

Verification: 41 new unit tests in six files (buffer, identity, normaliser,
scheduler, calibration, diagnostics); full suite 167 tests in 22 files;
typecheck, lint and production build clean.

## Stage 2 — Motion-aware recognition (Pending)

Goal: recognise a short window, not one frame, and refuse to guess.

- Feature vector v2: canonical hand points, wrist trajectory over a 0.8–1.2 s
  window, velocity and direction histograms, plus two-hand relative offsets
  when both hands are tracked.
- `SignSegmenter`: start/end a candidate sign from movement energy and hand
  presence, so a moving sign is captured as one event instead of N frames.
- `TemporalClassifier`: per-label prototype sequences (DTW or fixed-length
  resampling) trained in Training Studio; report unknown when the distance
  exceeds the calibrated threshold.
- Reader rewrite: consume all tracked hands, emit one event per segmented sign,
  never re-emit the same sign while it is held, and show "unknown" honestly.
- Acceptance: unit tests for segmentation boundaries, two-hand offsets, unknown
  rejection, and event de-duplication; real-hand check by the user.

## Stage 3 — Training pipeline for the new features (Pending)

- Store v2 samples with canonical landmarks and pose context; migrate v1 samples
  without pretending they are equivalent (label them as static-only).
- Take-grouped split retained; per-label threshold from the held-out distance
  distribution, not a fixed constant.
- Export format v2 with a `features` field and an import migration path.
- Acceptance: held-out evaluation restated honestly, including the small-sample
  caveat; no ISL accuracy claim.

## Stage 4 — Speaker and speech queue (Pending)

- Replace the cancel-every-call `speak()` with a FIFO queue: one utterance at a
  time, explicit stop, pause between words, and a rate/pitch/volume setting.
- Voice availability checked per language; when the browser has no voice the UI
  says so and stays silent rather than falling back to another language.
- Acceptance: unit tests for queue ordering, stop/reset and unavailable voices;
  a browser check confirming a real utterance only with a user-visible voice.

## Stage 5 — Captions, dictionary and history (Pending)

- Captions consume segmented sign events, not raw frames, with per-word timing.
- Dictionary view over the user's labels: sample count, last trained, model
  coverage; a word without samples is marked missing, not "coming soon".
- History with timestamps, replay of the recorded landmark window where
  available, and export.
- All new strings in the six catalogues in the same commit.

## Stage 6 — Interface redesign (Pending)

- Eight main navigation items plus a **Studio** group (Whiteboard, Gesture
  Camera, Gallery, Training, Calibration) to keep the primary rail short.
- One workspace layout with consistent header, inspector and status bar; the
  Calibration workspace already follows it.
- Accessibility pass: focus order, live-region announcements for emitted signs,
  reduced-motion and contrast checks.
- Acceptance: 1440/1280/1024/390 screenshots and a Japanese pass, same as the
  2.0 gate.

## Stage 7 — Documentation and verification (Pending)

- Update `SPEC.md`, `README.md`, `FEATURE_STATUS.md`; new `MODEL_CARD.md` that
  states plainly: vocabulary comes from user recordings, no ISL dataset is
  bundled, no ISL accuracy is claimed.
- Full gate: `npm run verify`, Playwright UI/vision checks, and a user-run
  real-camera session whose measured fps/inference/diagnostics are recorded.

## Explicitly out of scope

- Bundling or claiming an ISL model, dataset or accuracy figure.
- Cloud inference, accounts, telemetry or any upload of video.
- Paid APIs or model downloads that require billing.
- Using the rejected 50×50 silhouette dataset as recognition input.
