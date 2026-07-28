# Feedback Analysis Linkage (verification, no new code)

## What already links, real and unchanged

`AiFeedback` (Phase 4 schema, unchanged) links to `AiInferenceLog` via a real foreign key (`inferenceLogId`). `AiInferenceLog` itself already carries: `promptText` (the real rendered query), `retrievedDocumentIds` (real retrieval results), `promptVersionId` (real prompt version), `modelId` (real model version), `responseText` (the real answer), `confidence` (a real numeric retrieval-margin value), `actorId`, `correlationId`. `AiFeedbackDecision` (extended additively in Prototype 1 with catalogue-specific values: `HELPFUL`, `NOT_HELPFUL`, `MISSING_RESULT`, `WRONG_FITMENT`, `WRONG_ALTERNATIVE`, `WRONG_LUBRICANT_APPROVAL`, `CITATION_ISSUE`, `REQUIRES_REVIEW`) is unchanged this phase.

## Real gaps found while verifying this (not fixed this phase — out of the "evaluation/security/pilot-readiness only" scope)

- **No `indexVersionId` on `AiInferenceLog`** — a feedback record can be traced back to which prompt/model produced an answer, but not which `CatalogueIndexVersion` was active at the time. Given index versions in this environment change infrequently (blue-green activation is a deliberate, occasional operation, not per-request), this is a real but low-urgency gap.
- **`actorRole` is not populated by `CatalogueRagService`'s calls to `AiGatewayService.generate()`/`embed()`** — `GenerateParams`/`EmbedParams` both accept an optional `actorRole`, but `CatalogueRagService` only ever passes `actorId`. This means `AiInferenceLog.actorRole` is `null` for every catalogue-RAG-originated log row today, which weakens "feedback must be linked to... user role" specifically. A real, small fix (passing the caller's role through from the controller) was not made this phase to avoid touching the `CatalogueRagService.ask()` signature further during an already-large rewrite; noted here for the next iteration.

## No automatic retraining or data modification from feedback

Confirmed unchanged from Prototype 1: `AiFeedbackService.record()` only ever creates an `AiFeedback` row — nothing in this codebase reads feedback decisions to automatically retrain a model, adjust ranking weights, or modify catalogue data. Any future use of feedback to inform tuning (e.g. this phase's own manual analysis of Prototype 1's acceptance-report findings, which is exactly how this phase's priorities were chosen) is a human-driven process, not an automated one.
