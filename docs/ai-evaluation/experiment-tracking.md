# Experiment Tracking — DGX Prototype 1.6 (spec §18)

## No separate "Experiment" concept beyond what's already persisted

Every real experiment record already captures exactly the fields spec §18 asks for, without a new denormalized table:

- **Configuration**: `PromptExperimentArm.promptVersionId` → the real `PromptVersion` row (system prompt, user template, temperature, model). `BenchmarkRun.modelId`/`embeddingModelId`/`rerankerName`/`promptVersionId`/`indexVersionId`.
- **Dataset**: `BenchmarkRun.benchmarkId` → the exact `Benchmark` (and therefore its exact version and case set) the run was scored against.
- **Metrics**: `BenchmarkRun.metrics` / `PromptExperimentArm.metrics` — the real, category-scoped `CategoryMetrics` snapshot.
- **Decision**: `PromptExperiment.winnerArmId`, `decidedById`, `decidedAt`, `decisionNotes` — and at the suite level, `BenchmarkSuiteRun.decision`/`decisionNotes`.
- **Rollback**: `AiModel.rollbackTargetId` (model-level) and `PromptRegistryService`'s append-only versioning itself (any prior `PromptVersion` can always be republished as active — see `docs/ai-tuning/prompt-experiments.md`'s "Rollback path" section, unchanged and still valid).

## Why no new `Experiment` entity was created

`BenchmarkRun` already is the real experiment record for anything that isn't specifically an A/B prompt comparison — adding a second, parallel "Experiment" table would duplicate this data rather than track anything new. `PromptExperiment`/`PromptExperimentArm` exist only because prompt A/B testing has a genuinely distinct shape (multiple arms sharing one dataset and one selection metric, with a single declared winner) that a bare `BenchmarkRun` doesn't capture on its own.

## Real verification

`scripts/verify-ai-evaluation-framework.ts` step 34's real prompt experiment produces exactly this trail: two `PromptExperimentArm` rows, each with a real `promptVersionId` and a real metrics snapshot, one `winnerArmId` selected by `selectionMetric` alone. `evaluationHistory()` on `ModelRegistryService` (see `model-registry.md`) is the model-scoped equivalent — a live query over every `BenchmarkRun` that ever used a given model.
