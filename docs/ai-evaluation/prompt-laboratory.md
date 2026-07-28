# Prompt Laboratory & Experiments — DGX Prototype 1.6

## Reused, not rebuilt

`PromptRegistryService` (Phase 4/Prototype 1.5, unchanged) already provides real append-only prompt versioning — `publishVersion()` never edits a previously published `PromptVersion`, it always creates `version = latest + 1` and flips `isActive`. This phase's Prompt Laboratory (`src/ai-benchmark/experiments/`) reuses it directly rather than building a parallel versioning mechanism.

## Real A/B mechanism

Since `publishVersion()` has no "reactivate an old version by id" method (a deliberate append-only design), running an experiment arm means:

1. Capture the real currently-active version's content (`PromptRegistryService.getActiveVersion()`).
2. For each arm, `publishVersion()` the arm's content as the new active version, then run the real benchmark pipeline (`BenchmarkPipelineService.runGenerationCategory()` or a language category) against it — a real, capped set of generative cases, real Ollama calls.
3. Record the resulting `CategoryMetrics` snapshot on a `PromptExperimentArm` row.
4. **Always** republish the original captured content as the active version again, even if an arm's run throws (a `finally` block in `PromptExperimentService.runExperiment()`) — an experiment must never leave production pointed at an experimental prompt.

This is the same publish-run-revert pattern DGX Prototype 1.5's `scripts/_tmp_decoding_compare.ts` already used as a one-off script; this phase makes it a real, repeatable, tracked service instead.

## "Select prompts using metrics only" (spec's explicit rule)

`src/ai-benchmark/experiments/metric-selection.ts`'s `selectWinner()` is a pure function: given each arm's metrics snapshot and a single named dotted path (`PromptExperiment.selectionMetric`, e.g. `"avgGroundedness"` or `"citation.correctness"`), it picks the arm with the best real value — no other signal considered. `PromptExperimentService.decideWinner()` is the only way to record a *different* winner, and it requires a non-empty `decisionNotes` explaining why — a manual override without a logged reason is rejected (`BadRequestException`), enforcing "never a manual override without a documented reason" as real code, not a policy.

## Real test coverage

`metric-selection.spec.ts` (pure, no DB): picks the highest value for a HIGHER_IS_BETTER metric, the lowest for a LOWER_IS_BETTER one, reads a nested dotted path, and returns an honest `null` with a stated reason when no arm produced a real value for the requested metric. `scripts/verify-ai-evaluation-framework.ts` step 34 runs a real 2-arm experiment (current active prompt vs. the same prompt at temperature 0.3) against a small real `GENERATION` benchmark and reports the real, metric-selected winner.

## Honest scope

The experiment mechanism is real and reusable for any future prompt comparison. The number of arms compared this phase is small (2), and the benchmark it ran against has a deliberately small case count (matching the same small-sample caveat already documented for DGX Prototype 1.5's decoding-settings comparison) — this proves the mechanism works, not that any particular prompt variant is decisively better.
