# Retrieval Optimization

## The architectural change: retrieval decomposed into real stages

Prototype 1's `CatalogueRagService.answerFromRag()` called `RagService.retrieveAndGenerate()` as one opaque step — embed, search, build context, render prompt, generate, all inside one method with no seam for a caller to inspect or influence. This phase reimplements the semantic-answer path in `CatalogueRagService` itself, composing the same lower-level primitives (`AiGatewayService`, `VectorSearchService`, `PromptRegistryService`) directly. `RagService` itself is completely unchanged and still serves every other assistant in the platform (technician/parts/lubricant/manager assistants) exactly as before — this is a catalogue-specific refinement, not a platform-wide redesign.

Real stages now exposed as distinct, measurable steps in `answerFromRag()`:

1. **Query normalization/classification** — `query-understanding.ts` (unchanged mechanism, expanded categories — see [query-routing.md](query-routing.md)).
2. **Exact identifier search** — `CatalogueSearchService` (unchanged from Prototype 1).
3. **Vector search** — `VectorSearchService.semanticSearch()`, now retrieving a wider top-8 (`DEFAULT_RETRIEVAL_TOP_K`) instead of Prototype 1's fixed top-5, so context-size experiments (see [context-optimization.md](context-optimization.md)) have real candidates to select among.
4. **Real per-candidate evidence-quality metadata fetch** — a genuinely new stage: for every retrieved chunk, `KnowledgeDocument.confidence`/`isApproved`/`partId` is fetched, and a real conflict check (`CatalogueSearchService.checkRealConflict()`, the same live signal deterministic search uses) is run per unique `partId`.
5. **Candidate union + evidence grouping** — `context-builder.ts` classifies each candidate into `VERIFIED_FACTS`/`CANDIDATE_MATCHES`/`LUBRICANT_APPROVAL_EVIDENCE`/`CONFLICT_EVIDENCE`.
6. **Context selection (minimization)** — a configurable `maxCandidates` parameter, defaulting to 5.
7. **Answer generation** — a narrow, JSON-constrained prompt (see [prompt-experiments.md](prompt-experiments.md)).
8. **Claim verification** — see [claim-verification.md](claim-verification.md).
9. **Citation validation** — see [citation-quality.md](citation-quality.md).

Each stage's real output is logged or directly inspectable in the returned `CatalogueRagAnswer` (`verifiedFacts`, `possibleMatches`, `missingInformation`, `claims`, `claimsRemovedCount`).

## A real confidence bug found and fixed by this phase's own integration test

The first implementation of the rewritten confidence logic used a retrieved candidate's own `isApproved`/`confidence` metadata as a proxy for "this retrieval is relevant to the query" — but cosine-similarity search always returns its best-available match, even for a completely unrelated query, against a small corpus. The existing integration test (`catalogue-rag.integration-spec.ts`, "honestly declines an unrelated query") caught this immediately: a query about "spaceship landing gear tyre pressure" against a tiny fixture corpus got `confidence: MEDIUM` instead of the expected `LOW`/`INSUFFICIENT_EVIDENCE`, because the fixture's one real document happened to be `isApproved: true, confidence: 1.0`.

Fixed by reusing Phase 4's `computeRetrievalConfidence()` (calibrated against real measured nomic-embed-text baseline-noise scores — the exact "spaceship tyre pressure" example is documented in that function's own comments) on the raw retrieval scores as the **primary** confidence signal; document-level verification metadata can only ever leave confidence unchanged or lower it (via conflict/claim-removal), never raise it above what real retrieval relevance supports. Re-running the test after the fix: passes.

## Exact-identifier retrieval is unchanged

`CatalogueSearchService`'s deterministic methods were not modified this phase (beyond adding the `checkRealConflict()` public wrapper and a short-TTL cache on `findByOemNumber()` — see [performance-optimization.md](performance-optimization.md)). Recall@1/3/5 = 1.0 on the self-consistency dataset, same as Baseline A.

## What was not changed

Hybrid ranking's strict match-type tier order (`hybrid-ranking.ts`) is untouched — it already structurally guarantees an exact match outranks a semantic one, which was already correct in Prototype 1 and re-verified unchanged (`hybrid-ranking.spec.ts` still passes). Deterministic lubricant-viscosity/approval routing from natural-language queries (rather than only via the dedicated `/catalogue/search-lubricants` endpoint) was not added this phase — see [query-routing.md](query-routing.md).
