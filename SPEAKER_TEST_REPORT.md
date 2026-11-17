# Speaker test report — GestureLink 4.0

The speaker layer was rebuilt so it can only receive committed recognition
events. `tests/speakerEngine.test.ts` uses an injected fake speech synthesis,
so results are deterministic and do not depend on a browser voice.

| Requirement | Test | Result |
| --- | --- | --- |
| One speech event per committed sign | Auto-mode held sign | Passed: one utterance with the event text |
| Hold a sign for three seconds → no repeated speech | Duplicate recognition id is rejected on the second delivery | Passed |
| Duplicate recognition event id → no duplicate speech | Same id via `consume` and `manual` | Passed: null on both repeat paths |
| Ordered queue | Two words enqueued in order | Passed: second remains queued until the first ends |
| Cancel a queued phrase | `cancel(id)` on the pending event | Passed: removed without speaking |
| Pause / resume | `pause()` and `resume()` | Passed: state transitions and synth calls |
| Stop | `stop()` | Passed: queue cleared, `cancel()` called |
| Replay | `replay()` after a completed utterance | Passed: same text with a fresh id |
| Manual playback | `manual()` on a committed event | Passed |
| Sentence completion | `SentenceCommitManager` joins only received words | Passed |
| Sentence boundary from punctuation | Trailing `.` triggers flush | Passed |
| Auto speech gate | Auto mode refused while preview is disabled | Passed |
| No raw predictions reach speech | A raw candidate cannot be passed to the speech layer; only a `RecognitionEvent` from `SignEventManager` is accepted | Passed |

## Manual verification still required

The fake synth proves queueing and deduplication logic, not audio output. With
a real browser voice, check that:

- enabling automatic speech requires the visible preview;
- a held sign speaks once, not continuously;
- queued phrases can be cancelled while an earlier phrase is speaking;
- pause/resume/stop behave as expected for the chosen browser voice.

Browser speech synthesis support for pause/resume varies; the preview reports
the engine state from the real synth, not an assumed one.
