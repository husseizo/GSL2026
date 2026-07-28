# Benchmark Architecture — DGX Prototype 1.6

## Scope of this phase

DGX Prototype 1.6 builds no new business feature — it builds the evaluation platform every future AI capability (demand forecasting, predictive maintenance, technician assistants, or any change to Catalogue AI) must pass through before reaching production. Nothing in `src/catalogue-ai/**` business logic was touched; every new file lives under `services/operational-core/src/ai-benchmark/`, a directory deliberately separate from the existing `src/ai-evaluation/` (a real, working Phase 4/5 module over generic `EvaluationDataset`/`EvaluationCase`/`EvaluationRun` and `RagService` — left completely untouched to avoid confusion or redesign).

## The 16-category taxonomy

`src/ai-benchmark/categories/category-taxonomy.ts` mirrors a new Prisma enum, `BenchmarkCategory`, with the literal 16 values from the spec: `RETRIEVAL, GENERATION, SAFETY, SECURITY, PERFORMANCE, SWAHILI, ENGLISH, MIXED_LANGUAGE, REASONING, CONFLICT_DETECTION, PERMISSION_ENFORCEMENT, PROMPT_INJECTION, LATENCY, RELIABILITY, REGRESSION, PRODUCTION_READINESS`.

A real design decision, confirmed with the user during planning: Hallucination (spec §12) and Citation (spec §13) are **not** separate top-level categories, since the spec's own category list (§4) never names them. They get dedicated structs (`HallucinationSubScore`, `CitationSubScore`), dedicated case files (`hallucination-cases.ts`, `citation-cases.ts`), dedicated docs (this directory's `hallucination-benchmark.md`/`citation-benchmark.md`), and dedicated, independently-reported scores — nested inside `GENERATION`'s `CategoryMetrics`, not folded into one number.

## "Never collapse into one average" — enforced in code, not just documented

Three real, checkable layers:

1. **Type contract**: `CategoryMetrics` is a discriminated union (`{ category: 'RETRIEVAL'; metrics: RetrievalCategoryMetrics } | ...`), and the only aggregate shape any pipeline function may return is `Record<BenchmarkCategory, CategoryMetrics | undefined>`. No function in `src/ai-benchmark/` returns a bare number as "the score."
2. **DB-level**: `BenchmarkRun.metrics` (Prisma) is always scoped to exactly one `benchmarkId` (and therefore one category, via `benchmark.category`) — there is structurally no row that spans categories. `BenchmarkSuiteRun` only aggregates by counting gate outcomes (PASS/FAIL/WAIVED), never by averaging `metrics` across categories.
3. **Verified**: `scripts/verify-ai-evaluation-framework.ts` step 9 greps `category-metrics.ts` for a cross-category-averaging pattern (`Object.values(categoryMetrics).reduce(...)`) and asserts it doesn't exist; `src/ai-benchmark/leaderboard/leaderboard.service.ts` returns one ranked list per category, never a blended rank.

## Schema (purely additive)

New Prisma models: `Benchmark` (the registry entry — versioned, append-only, like `PromptVersion`), `BenchmarkCase` (persisted case rows), `BenchmarkRun` (one pipeline execution, one category, real metrics), `BenchmarkSuiteRun` (groups runs under one human decision), `PromptExperiment`/`PromptExperimentArm` (A/B). `AiModel` gained additive nullable columns (`contextLength`, `license`, `hardwareRequirements`, `embeddingDimensions`, `embeddingCompatibleWith`, `approvalState`, `rollbackTargetId`) — no existing column touched. `CatalogueIndexVersion` gained one additive back-relation array field. See `prisma/schema.prisma`'s "DGX Prototype 1.6" section for the full definitions.

## The real evaluation pipeline (spec §5)

`src/ai-benchmark/pipeline/benchmark-pipeline.service.ts`'s per-category `run*Category()` methods implement: load dataset (real `BenchmarkCase` rows, APPROVED-only) → retrieval/generation (real `CatalogueSearchService`/`CatalogueRagService` calls, nothing mocked) → claim verification/citation validation (reused directly from `src/catalogue-ai/rag/{claim-verifier,citation-validator}.ts`) → calculate metrics (reused directly from `src/catalogue-ai/evaluation/{retrieval-metrics,generation-metrics,calibration-metrics}.ts`) → store results (`BenchmarkRun` row) → compare against previous versions (`pipeline/regression-detector.ts`) → generate report (`reports/report-generator.ts`) → approve/reject (`BenchmarkSuiteRun.decision`, gated by `pipeline/quality-gates.ts`).

## What reuses existing code vs. what's new

**Reused directly, never reimplemented**: `retrieval-metrics.ts`, `generation-metrics.ts` (including the already-existing `citationCorrectness`/`citationCompleteness`), `calibration-metrics.ts`, `claim-verifier.ts`, `citation-validator.ts`, `reranker.ts`, `CatalogueSearchService`, `CatalogueRagService`, `PromptRegistryService`'s append-only versioning, `ModelRegistryService`'s real Ollama sync, `ROLE_PERMISSIONS`/`PermissionsGuard`'s real ground truth.

**New this phase**: the Benchmark/BenchmarkCase/BenchmarkRun/BenchmarkSuiteRun/PromptExperiment schema, the category-scoped pipeline orchestration, regression detection, quality gates, the leaderboard, the self-contained static-HTML dashboard, and per-category case generators (see `gold-dataset.md` for the honest dataset-scale accounting).

## Additive update — DGX Prototype 1.7

A 17th category, `KNOWLEDGE`, was added afterward by the Automotive Knowledge Platform phase, nesting 7 sub-scores (retrieval, supersession, applicability, authority-ranking, expired/restricted-exclusion, graph-relation, structured-fact-extraction) the same way Hallucination/Citation nest inside `GENERATION` above — never a bare number, never blended. `BenchmarkPipelineService` gained one new, real DI dependency (`KnowledgeRetrievalService`) for this category's `runKnowledgeCategory()` method. See [docs/knowledge-platform/evaluation-framework-integration.md](../knowledge-platform/evaluation-framework-integration.md) for the full write-up, including a named, honest gap: `CONFLICT_DETECTION`/`PROMPT_INJECTION` were not extended with knowledge-specific cases as originally planned.
