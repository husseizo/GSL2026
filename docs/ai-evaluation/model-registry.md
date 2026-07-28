# Model Registry — DGX Prototype 1.6 additions

## What already existed (Phase 4/Prototype 1.5, unchanged)

`ModelRegistryService`/`AiModel` — real `kind`/`provider`/`family`/`version`/`quantization`/`parameterSize`/`sizeBytes`/`status`/`isDefault`, synced live from Ollama via `syncFromDgx()` (never hand-typed). Only two real rows have ever existed in this environment: `llama3:latest` (generation) and `nomic-embed-text:latest` (embedding) — no second candidate of either kind is locally installed.

## What this phase adds (purely additive nullable columns)

`contextLength`, `license`, `hardwareRequirements` (JSON), `embeddingDimensions`, `embeddingCompatibleWith` (JSON), `approvalState` (new `ModelApprovalState` enum: `UNREVIEWED | UNDER_EVALUATION | APPROVED | REJECTED | DEPRECATED`), `rollbackTargetId` (self-relation to another `AiModel`). New service methods on the existing `ModelRegistryService` (not a shadow service): `setApprovalState()`, `setRollbackTarget()`, `updateHardwareMetadata()`, `evaluationHistory()`.

`evaluationHistory(id)` is deliberately **not** a stored column — it's a live query over `BenchmarkRun.modelId`/`embeddingModelId`, so it can never drift from the real run history the way a denormalized counter could.

## What "every model must pass through the Evaluation Framework" actually enforces

`approvalState` itself does not block deployment — nothing in this codebase currently gates a live model swap on it. The actual enforcement point is the Quality Gates' `HUMAN_APPROVAL` and `REGRESSION` gates (`src/ai-benchmark/pipeline/quality-gates.ts`), which every `BenchmarkSuiteRun` decision passes through. `approvalState` is the recorded, auditable outcome of that process, not a separate technical lock. This is an honest distinction worth stating plainly rather than overclaiming a gate that doesn't exist yet.

## Real verification

`scripts/verify-ai-evaluation-framework.ts` step 35 sets real `contextLength`/`license`/`hardwareRequirements` on the real `llama3:latest` row, transitions its `approvalState` to `UNDER_EVALUATION`, and queries its real `evaluationHistory()` — showing however many real `BenchmarkRun` rows from this same verify run reference it.

## Honest scope

Multi-model comparison (spec §9) stays scoped to what's actually installed — see `embedding-evaluation.md` and `reranker-evaluation.md` for the equivalent embedding/reranker constraint. Adding a second generation model (`ollama pull qwen2.5` or similar) is a mechanical, documented path, not attempted this phase to avoid fabricating a comparison against a model that was never genuinely evaluated end-to-end in this environment.
