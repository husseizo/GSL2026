# DGX Prototype 1 — Automotive Catalogue RAG Architecture

A controlled, source-grounded catalogue retrieval and explanation service, built entirely on top of the Data Validation/Business Baselining/AI Readiness phase's verified data and the Phase 4 AI infrastructure (`AiGatewayService`, `ModelRegistryService`, `PromptRegistryService`, `EmbeddingService`, `VectorSearchService`, `KnowledgeBaseService`, `RagService`, `AiEvaluationService`, `AiFeedbackService`). This is not a new AI platform — it is a new catalogue-specific layer (`src/catalogue-ai/`) that reuses that platform's real seams.

## Hard rule: the DGX is an intelligence service, not a source of truth

Every write path in `src/catalogue-ai/` goes through existing Operational Core services (`ManualReviewService`, `AiFeedbackService`) or creates net-new, additive rows (`CatalogueIndexVersion`, `PartRelationship`, `KnowledgeDocument`/`KnowledgeChunk`). Nothing in this module ever writes to `Part`, `LubricantProduct`, `SalesDocument`, or any other canonical business table. `scripts/verify-dgx-catalogue-rag.ts` step 35 explicitly re-counts `Part`/`LubricantProduct` rows before and after a full verification run and asserts they are unchanged.

## Component map

- **`src/catalogue-ai/search/`** — `CatalogueSearchService` (deterministic, DB-only lookup: exact internal code, OEM, alternate number, TecDoc id, supersession, keyword), `identifier-normalization.ts`, `hybrid-ranking.ts`. Never calls the AI gateway — this is why exact-identifier queries and the DGX-unavailable fallback both work with zero DGX dependency.
- **`src/catalogue-ai/confidence-model.ts`** — catalogue-specific confidence banding (`VERIFIED`/`HIGH`/`MEDIUM`/`LOW`/`CONFLICTING`/`INSUFFICIENT_EVIDENCE`), layered on top of Phase 4's generic `computeRetrievalConfidence()`.
- **`src/catalogue-ai/corpus-eligibility.ts`** — pure classifier deciding which real catalogue records are safe to index, and how (see [catalogue-corpus-contract.md](catalogue-corpus-contract.md)).
- **`src/catalogue-ai/index-lifecycle/`** — `CatalogueIndexVersionService` (blue-green index build/validate/approve/activate/rollback) and `corpus-content-builder.ts` (pure text builders for the embedded corpus).
- **`src/catalogue-ai/relationships/`** — `PartRelationshipService`, the real supersession/kit/replacement graph this phase adds (see [parts-search-ranking.md](parts-search-ranking.md) for why this is scoped narrower than the original 12-relationship-type brief).
- **`src/catalogue-ai/comparison/`** — `ProductComparisonService`, structured part/lubricant comparison with a fixed evidence-graded label set.
- **`src/catalogue-ai/rag/`** — `query-understanding.ts` (deterministic query classifier), `catalogue-rag.service.ts` (the orchestrator — see [rag-answer-contract.md](rag-answer-contract.md)).
- **`src/catalogue-ai/evaluation/`** — pure retrieval/generation metric functions plus `CatalogueEvaluationService`, the real offline evaluation harness (see [offline-evaluation.md](offline-evaluation.md)).
- **`src/catalogue-ai/catalogue-ai.controller.ts`** — the 10 real HTTP endpoints (see [rag-answer-contract.md](rag-answer-contract.md) for the full route list), reusing the existing `PermissionsGuard`/`RequirePermissions`/`getRequestActor` conventions.

## Deterministic-first request flow

`CatalogueRagService.ask(query)`:
1. `classifyQuery()` (pure regex heuristic, no LLM call) tags the query `IDENTIFIER` / `VISCOSITY` / `APPROVAL` / `DESCRIPTION`.
2. If `IDENTIFIER`, `answerFromDeterministicLookup()` tries `CatalogueSearchService`'s internal-code/OEM/alternate/TecDoc lookups concurrently — zero DGX calls. If a real match is found, the answer is returned immediately with `usedDeterministicLookup: true`, `usedGeneration: false`, and no `AiInferenceLog` entry (there was nothing to log — no model was called).
3. Only if that path finds nothing does the query fall through to `answerFromRag()`, which seeds a `CATALOGUE_RAG_ANSWER` prompt template via `RagService.ensurePromptSeeded()` and calls the shared `RagService.retrieveAndGenerate()`, scoped to `sourceTypes: ['PARTS_DOCUMENTATION', 'LUBRICANT_DOCUMENTATION']`.

This directly satisfies the spec's explicit rule: "Do not send obvious exact identifiers to the LLM before deterministic lookup."

## What was reused unchanged vs. genuinely new

Reused as-is: `RagService.retrieveAndGenerate()`, `VectorSearchService.semanticSearch()`, `hybrid-search-math.ts`, `rag-confidence.ts`, `grounding-score.ts`, `KnowledgeBaseService.ingestDocument()`, `AiFeedbackService`, `ManualReviewService`, `PartCompatibility` (Phase 1 vehicle/engine/transmission fitment), `LubricantAlternative` (Phase 2), `PartMatchCandidate` (Phase 1 duplicate detection).

Genuinely new: `CatalogueIndexVersion` + `PartRelationship` Prisma models, `Part.tecdocArticleId`, every file under `src/catalogue-ai/`, and one additive field (`KnowledgeDocument.indexVersionId`).

See [decision-log-catalogue-rag.md](decision-log-catalogue-rag.md) for the reasoning behind each scope-reduction decision, and [final-prototype-report.md](final-prototype-report.md) for the honest readiness verdict.
