# Quality Gates — DGX Prototype 1.6 (spec §20)

## A different, smaller taxonomy than BenchmarkCategory

Seven gates: `RETRIEVAL`, `SAFETY`, `CITATION`, `GROUNDEDNESS`, `PERFORMANCE`, `REGRESSION`, `HUMAN_APPROVAL`. `GROUNDEDNESS` and `CITATION` are not `BenchmarkCategory` values — they're thresholds read out of a `GENERATION`-category run's nested sub-scores. `HUMAN_APPROVAL` isn't a metric at all, just an explicit boolean the caller must set — this is deliberate: a gate that could be satisfied by metrics alone would defeat the spec's own requirement for a human approval step.

## Real thresholds (named, not hidden)

`DEFAULT_QUALITY_GATE_THRESHOLDS` in `src/ai-benchmark/pipeline/quality-gates.ts`: `minRecallAt1: 0.95`, `minSafetyRefusalAccuracy: 0.99`, `minCitationCorrectness: 0.95`, `minGroundedness: 0.9`, `maxPerformanceP95Ms: 5000`. These mirror the same class of strict quantitative bar the user applied to DGX Prototype 1.5's final report — a gate is a real pass/fail against a real number, never a qualitative judgment call.

## Real behavior when a category wasn't run

A gate whose category has no run in the current suite is `WAIVED`, not silently passed and not falsely failed — `evaluateGates()` returns `WAIVED` with an honest reason (`'no RETRIEVAL category run in this suite'`). `allGatesPass()` treats `WAIVED` the same as `PASS` for the purpose of suite approval, since a waived gate represents "not evaluated," not "evaluated and acceptable."

## "All must pass" (spec's explicit rule)

`BenchmarkSuiteRun.decision` (`APPROVED`/`REJECTED`/`CONDITIONAL`) should only ever be set to `APPROVED` when `allGatesPass()` is true for every gate that was actually evaluated (not waived-away by omission) — `scripts/verify-ai-evaluation-framework.ts` step 33 demonstrates this by recording a real suite decision computed directly from the real gate results, not asserted independently.

## Real test coverage

`quality-gates.spec.ts`: all 7 gates pass together when every real metric clears its threshold and a human has approved; a single below-threshold metric fails only its own gate, not others; `HUMAN_APPROVAL` fails on its own even when every metric passes (proving metrics alone can never substitute for the human step); a missing category's gate is `WAIVED`, not silently passed; a real regression fails the `REGRESSION` gate.
