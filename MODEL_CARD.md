# GestureLink model card

## What this is

GestureLink 3.0 ships a **user-trained local classifier**, not a pre-trained
sign-language model. The vocabulary is whatever labels you create in the
Training Studio and record with your own hands. If you have not recorded
anything, the model knows nothing.

There is **no Indian Sign Language (ISL) dataset, ISL model, or ISL accuracy
figure** in this repository or in the released bundle. MediaPipe's generic
seven-gesture recogniser is not treated as a sign-language model and is not used
for recognition.

## Model versions

| Version | Feature kind | Input | Used for |
| --- | --- | --- | --- |
| 1 | `frame` | 69 values (63 hand-relative landmarks + 6 shape values) | Legacy single-reading models. Still load and score, but cannot represent movement. |
| 2 | `window` | 912 values: 76 values × 12 time-normalised frames | Single-hand movement windows. Still load and score. |
| 3 | `two-hand` | 1,920 values: 160 values × 12 time-normalised frames | Current combined two-hand model. Both hands in fixed left/right slots plus relative distance, orientation, presence and interaction. |

The model stores `featureKind` and `featureLength`. `classify()` refuses a
vector whose length differs from the trained layout instead of silently
comparing only a prefix. Feature layouts are never mixed: `selectSamples()`
prefers two-hand samples, then window samples, then frame samples, and reports
everything it ignored through `ignoredSamples` / `ignoredTestCount`. A v3 model
refuses a single-hand vector, and a two-hand frame is rejected when either hand
is missing.

## Inputs

- **Hand landmarks:** 21 points per hand from MediaPipe Hand Landmarker,
  normalised relative to the wrist and palm span.
- **Shape features:** finger extension flags and a pinch ratio (6 values).
- **Body reference:** when pose lite produces a usable shoulder frame, the
  primary wrist is expressed in shoulder space (origin = shoulder midpoint,
  unit = shoulder width). Its x/y/z values are weighted ×3 so a trajectory is
  not drowned by 69 shape values. Without pose, the position block is zero and
  the window is shape-only — no body position is invented.
- **Second hand:** in a v2 single-hand window, only the offset from the primary
  wrist and a presence flag. In a v3 two-hand window, both hands' full 76-value
  frames plus relative distance, orientation, presence and interaction.
- **Time:** frames are linearly resampled to 12 slots, so the same sign at two
  speeds produces comparable vectors. Direction and ordering are preserved.

All values are clamped to a finite range so a bad pose frame cannot dominate
the distance metric.

## Training procedure

1. Record a take: up to 300 frames of one sign, with the hand in view.
2. Convert the take into overlapping windows with a 1.1 s length and a 350 ms
   stride. A take shorter than 600 ms still produces one window; fewer than
   four frames produces nothing and is reported to the user.
3. Split by take group: windows from one recording never appear in both the
   training set and the held-out test set.
4. Build up to 12 prototypes per label with greedy farthest-point seeding and
   averaging, so variation in angle and distance is retained without storing
   every frame.
5. Store the model in IndexedDB with its feature kind, length, threshold and
   training time.

## Decision rule

A reading is the label whose nearest prototype has the smallest RMS distance.
If that distance exceeds the configurable `unknownThreshold`, the reader
reports **unknown**: it does not guess. Confidence combines the margin to the
second-best label and the absolute distance; geometric count/shape modes
report a fixed, explicitly non-statistical confidence. Committing a sign
requires a short stable hold, and the same sign is not emitted again until it
has been released.

## Evaluation

`evaluateModel()` reports accuracy, unknown rate, per-label precision and
recall and a confusion list, computed **only on held-out take groups**. Samples
recorded with the other feature layout are excluded and reported, not counted
as unknowns. A small test set gives a rough figure, not a promise. No accuracy
number is published by this repository; any number you see was measured on
your own recordings on your own device.

## Known limitations

- No real hand has been used to verify recognition in this repository. The
  browser checks use a synthetic camera that contains no hand, so the honest
  "No hand" state is what was exercised.
- No ISL vocabulary, no fingerspelling dataset and no translation model.
- A v2 single-hand window still represents the other hand only by offset and
  presence. The v3 two-hand model includes both hands but is only as good as
  the paired recordings used to train it.
- A single global unknown threshold; no per-label distance calibration.
- Older single-frame samples are ignored by a window model rather than
  migrated. They remain in local storage until deleted.
- Motion timing (1.1 s window, 350 ms stride, 4-frame minimum) is an
  engineering choice that has not been tuned against real signers.

## Data and privacy

Hand/pose inference, samples, models, transcripts, photographs and drawings
stay in the browser profile (IndexedDB). There is no account, server, upload
or telemetry. The only external model request is the optional CDN-first fetch
of the MediaPipe `.task` files, with bundled local copies as the automatic
fallback. Dataset export writes a JSON file you control; import validates it.

## Evaluated and rejected

The Kaggle dataset `aryarishabh/hand-gesture-recognition-dataset` (CC0) was
tested on 2026-11-16. A small dense network reached 99.87 % on its 50×50
silhouettes, but the classes are only numbers `0`–`19` with no sign meaning,
the images need background removal to match a webcam frame, and silhouettes
cannot provide MediaPipe's 21 landmarks. Nothing from it ships.
