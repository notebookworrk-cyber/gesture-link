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

## Stage 2 — Motion-aware recognition (Built, unverified with a real hand)

Goal: recognise a short window, not one frame, and refuse to guess.

Shipped:

- Window feature layout in `features.ts`: 69 hand-shape values, a weighted
  primary-hand position in shoulder space (×3), the second-hand offset and a
  presence flag — 76 values per frame, resampled to 12 time-normalised frames =
  912 values. `windowFromFrames` resamples by linear interpolation, so the same
  gesture at two speeds is comparable; `windowDistance` is an RMS metric.
- `SignWindowBuffer`: rolling 1.1 s of frames, emits at most one window per
  350 ms, needs at least a 600 ms span and four frames, clears after two
  consecutive frames without a hand, and ignores out-of-order timestamps.
- `windowsFromTake` turns a recorded take into overlapping training windows with
  the same length and stride; the end of the take is always scored and a short
  take still yields one window.
- Reader: a window model feeds the buffer and classifies the resampled window;
  a frame model keeps the old one-reading path. Both go through one
  `applyReading` commit path, so stabilisation, release and history behaviour are
  identical. The mode note explains that the model compares one second of shape
  and movement.
- The window buffer resets on mode and model changes so a new layout never mixes
  with old frames.

Deliberate deviations from the plan above:

- There is no energy-based segmenter. A sliding window handles static signs
  (which have no movement energy to segment on) and moving signs on one path.
- Two-handed support is the second hand's offset and presence, not the second
  hand's full landmark shape.
- The unknown threshold stays a configurable constant; the per-label threshold
  in Stage 3 was not built.

Verification: 10 window-feature tests, 11 window-buffer/take tests and 11
classifier-v2 tests; full suite 208 tests in 26 files; typecheck, lint and
production build clean. No real hand has been in front of the camera, so
recognition quality and the 1.1 s/350 ms timing are **not** verified.

## Stage 3 — Training pipeline for the new features (Built, unverified)

- The Training Studio records a take frame by frame (max 300 frames), then
  converts it into window samples on stop and reports the saved count. A take
  that produced no window is reported as too short instead of silently saving
  nothing.
- `selectSamples` chooses one feature layout for the whole model: window samples
  win, and older single-frame samples are ignored and counted in
  `model.ignoredSamples`; the inspector shows that count.
- Model v2 stores `featureKind` and `featureLength`; `classify` refuses a vector
  whose length differs from the model instead of comparing a prefix. Version-1
  models still load and score as frame models.
- The take-grouped split is retained, and the evaluator excludes
  other-layout test samples and reports them through `ignoredTestCount` instead
  of counting them as unknown.
- Not done: sample migration (old frame samples stay in IndexedDB and are
  ignored rather than converted); export/import format version bump and a
  per-label threshold. Held-out evaluation is restated as measured, with the
  small-sample caveat; no ISL accuracy claim.

## Stage 4 — Speaker and speech queue (Partially done)

- Queue done: `speak()` no longer cancels the current utterance. Utterances play
  one at a time with a configurable gap, advance on `end`/`error`, and
  `stopSpeaking()` clears both the active utterance and the queue. A language
  the browser has no voice for is refused before queueing, and an empty voice
  list is treated as "not known yet" rather than "missing".
- Pending: rate/pitch/volume controls in Settings, and a caption-level voice
  picker. Acceptance for the remainder: unit tests for the controls and a
  browser check confirming a real utterance only with a user-visible voice.

## Stage 5 — Captions, dictionary and history (Built, dictionary browser-checked)

- Captions already consumed one committed (stabilised) sign event per reading
  with a timestamp, not raw frames; no raw-frame caption path was introduced.
  Per-word timing is recorded on the history entry and in the transcript, but
  the caption engine uses its own sentence timing rather than word durations.
- Added a **Sign Dictionary** workspace (`/dictionary`) in the Library group:
  category, description, sample count and last recording date per label, an
  all/in-model/needs-work filter and category picker, and honest empty states.
  “In model” only means the current classifier has prototypes for that label;
  the page explicitly refuses to present it as an accuracy claim. Backed by a
  pure `buildDictionary` helper with five unit tests.
- Reader history entries now carry the recognition mode alongside confidence and
  time, and can be exported as a real JSON file through `serializeHistory`
  (three unit tests). Raw landmark-window replay was not built and is listed as
  such in `FEATURE_STATUS.md`.
- All new strings ship in the six catalogues in the same commit.

Verification: 216 tests in 28 files; typecheck, ESLint and production build
clean (1,168 kB, 360 kB gzip). The dictionary page was checked in headless
Chrome at 1440 and 390 px: empty state, no-model note, filter, sidebar link, no
page errors and no horizontal overflow.

## Stage 6 — Interface redesign (Built, browser-checked; two deviations)

- Navigation is grouped as Workspace (Home, Sign Reader, Dictionary), Studio
  (Whiteboard, Gesture Camera, Gallery, Training, Calibration) and System
  (Settings). The sidebar shows 3.0. **Deviation:** the plan called for eight
  main items; the app only has nine real workspaces, so no placeholder pages were
  invented to reach that number.
- A shared status strip is rendered below every workspace by `AppShell`. It
  reads the sign store and vision status directly, so it reports actual model
  coverage, hands/fps and pose state — including honest "none"/"off" states.
- Accessibility: committed signs are announced through an always-on polite
  live region (the caption preset no longer controls announcements). The
  existing skip link, Escape handling, focus return and responsive inspector
  drawer were re-checked. **Deferred:** a dedicated reduced-motion/contrast
  screenshot pass and a formal focus-order audit; those settings already exist
  and are exercised by the settings store tests, not by a visual assertion.
- No new route-level header rewrite: the pages keep their existing headers,
  which already share the same token-driven surface. A full per-page header
  rewrite was not worth the regression risk at this stage.

Verification: 216 tests in 28 files; typecheck, ESLint and production build
clean (1,172 kB, 361 kB gzip); `npm run check:ui` passed (1440/1280/1024/390,
Japanese and Hindi). A separate headless check confirmed the Studio group, its
five links, the status strip and no mobile overflow at 1440 and 390 px.

## Stage 7 — Documentation and verification (Done; user hardware check pending)

- README rewritten for 3.0 with setup, scripts, workspaces, architecture and
  limits. SPEC.md keeps the original 2.0 brief and gains a 3.0 delta note
  instead of rewriting user-authored requirements. FEATURE_STATUS.md is updated
  with every stage and the gate results. New `MODEL_CARD.md` states plainly:
  the vocabulary comes from user recordings, no ISL dataset or model is
  bundled, no ISL accuracy is claimed, and why the silhouette dataset was
  rejected.
- Version is 3.0.0 in `package.json`, the lockfile, the module status and the
  About/version displays.
- Full gate: `npm run verify` — typecheck, ESLint, 216 tests in 28 files and
  production build (1,172 kB, 361 kB gzip) — passed. `npm run check:ui`,
  `npm run check:vision` (on rerun after a transient model-reload timeout),
  `scripts/whiteboard-check.mjs` and `scripts/camera-check.mjs` passed against
  the production preview. The camera harness now ignores `net::ERR_ABORTED`
  when a navigation cancels an in-flight CDN model fetch.
- Still pending and explicitly not claimed: the user-run real-camera session
  recorded in `FEATURE_STATUS.md` → “User verification needed”. No fps,
  inference or accuracy figure from real hardware is published here.

## GestureLink 4.0 — recognition and stability engine (Done; hardware pending)

- Recognition is a stateful event pipeline: `TwoHandTracker`,
  `PredictionStabilizer`, `SignSegmenter`, `DuplicateSuppressor` and
  `SignEventManager`. A held sign or small movement cannot create a second
  word; only a neutral release or a verified different sign re-arms.
- Two-hand reading is independent per hand with explicit number operations, and
  two-hand signs are trained as combined model-v3 sequences that refuse a
  missing hand. Training Studio can capture paired takes.
- Speech is event-only: `SpeechQueue`, `SpeechDeduplicator`,
  `SentenceCommitManager`, `SpeechEventManager` and `SpeechEngine`, with a
  preview gate before auto speech, cancellation, pause/resume/stop/replay.
- Tracking indicators, slot-coloured overlays, a recognition debug panel and a
  Recognition settings section with presets were added.
- Hand model loading now times out after 8 s so the bundled copy is used when
  the CDN stalls; browser harnesses ignore the resulting aborted requests.
- Verification: `npm run verify` passed (250 tests, 1,223 kB / 376 kB gzip);
  UI, vision, whiteboard and camera Playwright checks passed; a separate 4.0 UI
  smoke check passed. See `RECOGNITION_UPGRADE.md`, `TWO_HAND_TEST_REPORT.md`
  and `SPEAKER_TEST_REPORT.md`. Real-hand accuracy and real-voice playback
  remain explicitly pending.

## Explicitly out of scope

- Bundling or claiming an ISL model, dataset or accuracy figure.
- Cloud inference, accounts, telemetry or any upload of video.
- Paid APIs or model downloads that require billing.
- Using the rejected 50×50 silhouette dataset as recognition input.
