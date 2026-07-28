# Continuous Evaluation — DGX Prototype 1.6 (spec §19)

## Honest scope

No scheduler or queue library (`@nestjs/schedule`, `bull`/`bullmq`, `node-cron`, or similar) is installed in this repository — confirmed by grepping `package.json`. This phase does not fabricate a live scheduled job. "No deployment without evaluation" is implemented as a **real, directly callable mechanism** rather than a live cron trigger:

- Every `BenchmarkPipelineService.run*Category()` method is a plain injectable-service method, callable from anywhere in the codebase (a controller endpoint, a script, a future CI step) — demonstrated live by `scripts/verify-ai-evaluation-framework.ts`'s steps 20-30, each of which calls a real pipeline method and persists a real `BenchmarkRun`.
- `BenchmarkRunTrigger` (the enum on every `BenchmarkRun`) includes `MANUAL`, `CI`, `PRE_DEPLOYMENT`, and `SCHEDULED_DOC_ONLY` — the last one exists specifically so a future real scheduled trigger can be recorded honestly once a scheduler is actually wired in, without needing a schema change at that point.

## The documented, mechanical CI/cron wiring path (not executed this phase)

1. Add `@nestjs/schedule` (or wire a GitHub Actions / CI cron step) that calls a new thin controller endpoint wrapping `BenchmarkPipelineService.run*Category()` for whichever categories should run continuously.
2. Set `trigger: 'CI'` or `'PRE_DEPLOYMENT'` on the resulting `BenchmarkRun`, matching how "new prompt / new model / new embedding / new reranker / new corpus / new index" events would each be a real caller of the pipeline (a `PromptRegistryService.publishVersion()` call, a `ModelRegistryService.syncFromDgx()` call, a `CatalogueIndexVersionService` blue-green activation, etc.) — see `experiment-tracking.md` for how `PromptExperimentService` already does exactly this pattern for prompt changes.
3. Use `pipeline/regression-detector.ts`'s `detectRegressions()` to compare the new run against the most recent prior run of the same benchmark, and `pipeline/quality-gates.ts`'s `evaluateGates()` to decide whether the change may proceed — both already real, tested, callable functions (see `quality-gates.md`).

## Real verification

`scripts/verify-ai-evaluation-framework.ts` step 39 states this scope explicitly as part of its recorded step outcome, rather than claiming a live scheduler exists.
