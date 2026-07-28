# AI Governance

Every recommendation the spec asks to be traceable — model, prompt, temperature, context, retrieved documents, latency, confidence — is recorded on one table, `AiInferenceLog`, written by the one method every AI-touching call goes through (`AiGatewayService.generate()`/`.embed()`). This is what makes governance structural rather than a policy statement: there is no code path that calls the DGX boundary without producing a log row, success or failure.

## Inference logging

`AiInferenceLog`: `kind`, `modelId`, `promptVersionId`, `actorId`/`actorRole`, `correlationId`, `promptText`/`responseText` (both truncated to 4000 chars), `temperature`, `tokensIn`/`tokensOut`, `latencyMs`, `confidence`, `retrievedDocumentIds`, `success`, `errorMessage`. Verified directly: `ai-gateway.integration-spec.ts` asserts a real log row exists after a real `generate()`/`embed()` call, with the correct `kind`, `success`, `correlationId`, and prompt text — and asserts a log row is created even when the call fails (DGX unreachable scenario).

## Feedback Engine

`src/ai-feedback/` — `AiFeedback` ties an `ACCEPTED`/`REJECTED`/`EDITED` decision to a specific `AiInferenceLog` row. `AiFeedbackService.acceptanceRate()` is the one implementation of "recommendation acceptance / technician acceptance / purchase acceptance" from the spec's evaluation framework — filterable by `kind` and `since`, reused for every assistant's acceptance metric rather than a bespoke tracker per assistant.

## Evaluation Engine

`src/ai-evaluation/` — see [evaluation-framework.md](evaluation-framework.md) for the full write-up. `EvaluationDataset`/`EvaluationCase`/`EvaluationRun` support curated offline test sets; `runRetrievalEvaluation()` measures real retrieval precision/recall against `RagService`, not a mock.

## Model Registry and Prompt Registry as governance primitives

Both are covered in their own documents ([model-registry.md](model-registry.md), [prompt-registry.md](prompt-registry.md)) but are governance mechanisms first: every inference names exactly which model and prompt version produced it, and both are independently versioned so "what changed between last week's answers and this week's" is always answerable from the DB, not from memory.

## Human Approval

Nothing new to build here beyond what already exists: every AI output in this system is advisory. Purchase recommendations still require `PurchaseRecommendationsService.approve()`/`.reject()` (Phase 2, untouched). Technician Assistant suggestions still require a technician to record findings through `DiagnosticsService` themselves — the assistant never writes to `DiagnosticSession`/`SuspectedCause`. Manager Assistant answers are read-only summaries of real analytics. There is no code path anywhere in Phase 4 that turns an AI response directly into a committed business transaction.

## A/B model comparison

`EvaluationRun.modelId`/`promptVersionId` let two runs of the same `EvaluationDataset` be compared side by side — run the same retrieval dataset against two different `promptVersionId`s (or, once a second generation model is pulled in Ollama, two different `modelId`s) and compare `metrics.avgPrecision`/`avgRecall` directly from `AiEvaluationService.listRuns()`.

## Prompt/model versioning recap

Every `AiInferenceLog` row's `promptVersionId` and `modelId` foreign keys mean a query like "which prompt version produced this specific answer" or "how many inferences used the model before we updated it" is always a direct join, not something reconstructed from timestamps.
