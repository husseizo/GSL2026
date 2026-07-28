# RAG Answer Contract

## The required response shape

`CatalogueRagAnswer` (`src/catalogue-ai/rag/catalogue-rag.service.ts`) implements the spec §17 structure exactly:

```ts
interface CatalogueRagAnswer {
  directAnswer: string;
  matchingProducts: CatalogueSearchResult[];
  matchBasis: string;
  verifiedFitment: string[];
  alternatives: string[];
  conflictsOrWarnings: string[];
  sources: { sourceSystem: string; sourceRecordId: string; canonicalEntityId: string; lastVerifiedDate: string | null }[];
  confidence: CatalogueConfidenceLevel;
  recommendedNextAction: string;
  usedDeterministicLookup: boolean;
  usedGeneration: boolean;
  logId?: string;
}
```

`generation-metrics.ts`'s `isValidStructuredAnswer()` checks all 9 required keys are present on every real answer this phase produces; a real offline evaluation run measured 100% structural validity across 28 real cases.

## Two answer paths, one contract

**Deterministic path** (`answerFromDeterministicLookup`): runs whenever `query-understanding.ts` classifies the query as `IDENTIFIER`. Calls `CatalogueSearchService`'s internal-code/OEM/alternate/TecDoc lookups concurrently — zero DGX calls, so `logId` is `undefined` (there was no model call to log). `matchBasis` explicitly states "Deterministic exact-identifier lookup... no semantic search or LLM generation was needed." If the matched record has a real, live-rechecked conflict, `conflictsOrWarnings` is populated and `recommendedNextAction` routes to manual review instead of presenting it as confirmed.

**Generative path** (`answerFromRag`): everything else. Seeds a `CATALOGUE_RAG_ANSWER` prompt template (once, via `RagService.ensurePromptSeeded()`) whose system prompt explicitly forbids inventing OEM numbers/alternates/supersessions/fitment/lubricant approvals, and forbids claiming a repair will fix a fault or that a part fits a vehicle from description similarity alone. Calls the shared `RagService.retrieveAndGenerate()`, scoped to `sourceTypes: ['PARTS_DOCUMENTATION', 'LUBRICANT_DOCUMENTATION']`.

## Confidence is deliberately capped on the generative path

A `HIGH`-confidence *retrieval* result (Phase 4's `computeRetrievalConfidence()`) is deliberately remapped to `MEDIUM` *catalogue* confidence — never `VERIFIED` or `HIGH` — because those top two catalogue-confidence bands are reserved for exact/verified matches only (see [confidence-model.md](confidence-model.md)). A generative answer, however strong its retrieval score, is still a semantic match, and the spec is explicit that semantic similarity must never be presented with the same certainty as an exact verified identifier match.

## Never-do list, enforced structurally not just by prompt wording

- Never invents an OEM/alternate/supersession/fitment/approval: the deterministic path only ever returns what a real Prisma query found; the generative path's prompt instructs the model not to, and `unsupportedTechnicalClaimRate()` in the offline evaluation harness independently checks whether identifier-shaped tokens in the answer actually appear in the retrieved evidence.
- Never claims vehicle compatibility from description similarity alone: `verifiedFitment` is only ever populated from real `PartRelationship`/`PartCompatibility` verified rows, never inferred from the LLM's free text.
- Never finalizes a review decision: `recommendedNextAction` only ever *suggests* routing to manual review; the actual write goes through the existing `ManualReviewService.enqueue()` (see [manual-review-handoff.md](manual-review-handoff.md)).

## Endpoints

`POST /catalogue/search`, `GET /catalogue/parts/by-oem/:number`, `GET /catalogue/parts/:id/alternatives`, `GET /catalogue/parts/:id/supersessions`, `POST /catalogue/compare-parts`, `POST /catalogue/compare-lubricants`, `POST /catalogue/search-lubricants`, `POST /catalogue/rag/ask`, `POST /catalogue/feedback`, `POST /catalogue/review-handoff` — all behind the existing `PermissionsGuard`, reusing existing permission strings (`parts.read`, `lubricants.read`, `ai.chat`, `reviewQueue.assign`) rather than minting new ones.

Not yet implemented as separate routes (folded into `search`/`compare-parts`/`rag/ask` instead, since the underlying service methods already cover them): `GET /catalogue/parts/:id`, `GET /catalogue/parts/:id/fitment`, `POST /catalogue/resolve-number`, `GET /catalogue/lubricants/:id`. See [decision-log-catalogue-rag.md](decision-log-catalogue-rag.md).
