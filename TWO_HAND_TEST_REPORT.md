# Two-hand test report — GestureLink 4.0

Status legend: **Unit passed** = deterministic synthetic frames in Vitest.
**Hardware pending** = needs a real webcam and a real signer. No hardware claim
is made from a unit test.

| # | Requirement | Coverage | Result |
| --- | --- | --- | --- |
| 1 | Hold the same sign for five seconds → exactly one event | `tests/recognitionEvents.test.ts`: 5 s of identical frames through `SignEventManager` | Unit passed: 1 event |
| 2 | Slight movement while holding → no duplicate | Same suite: high palm motion with the same key for 6 s | Unit passed: 1 event, no re-arm |
| 3 | Genuinely different sign → two events | Same suite: sign A, then stable sign B | Unit passed: 2 events with distinct ids |
| 4 | Left = 5, right = 2, read independently | `tests/twoHandRecognition.test.ts`: per-hand readings through `TwoHandTracker` + `NumberRecognizer` | Unit passed: 5 and 2 |
| 5 | Addition → 7 | `tests/twoHandRecognition.test.ts`: `NumberComposer` | Unit passed: 7 |
| 6 | Concatenation → 52 | Same suite | Unit passed: 52 |
| 7 | One hand disappears → no fabricated result | Same suite: hand removed and loss tolerance exceeded | Unit passed: no zero, no fabricated hand |
| 8 | Held sign with auto-speak → one speech event | `tests/speakerEngine.test.ts` | Unit passed (see speaker report) |
| 9 | Duplicate recognition id → no duplicate speech | `tests/speakerEngine.test.ts` | Unit passed (see speaker report) |
| 10 | Dynamic two-hand sign uses the combined temporal sequence | `tests/twoHandRecognition.test.ts`: model v3 refuses single-hand vectors; combined frame requires both hands | Unit passed for the refusal and combined-vector path |

Additional unit coverage: handedness/identity assignment (including mirrored
preview and label flips), temporary loss and reacquisition, confidence
hysteresis, neutral release re-arming, event subscription/unsubscription, and
the debug-state snapshot.

## Reproduce

```bash
npm run typecheck
npm run lint
npx vitest run tests/twoHandTracker.test.ts tests/recognitionEvents.test.ts tests/twoHandRecognition.test.ts
npm run verify
```

## Real-camera session still required

The automated browser camera is synthetic and contains no hands, so items 1–4,
7 and 10 must also be performed with real hands. Record:

- the number of committed events for a five-second hold and for slight movement;
- whether a genuine A → B transition produces exactly two words;
- left/right number readings and the selected operation result;
- under temporary occlusion, whether the reader reports lost rather than a new sign;
- fps, inference latency, delegate and the per-hand indicators on the target machine.

Until that session is done, these items are **hardware pending**, not passed.
Recorded video replay is not available; a JSON landmark replay harness would be
the next step for reproducible hardware regression tests.
