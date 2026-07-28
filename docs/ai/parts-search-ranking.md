# Parts Search Ranking

> **Update — DGX Prototype 1.7.2.** This tier-order guarantee is still real and unchanged, and still governs `CatalogueSearchService`'s own live ranking. The new Retrieval Intelligence Platform's ranking engine (`src/retrieval-intelligence/ranking/ranking-engine.ts`) generalizes this same guarantee into a 15-signal explainable model — `EXACT_IDENTIFIER` carries a deliberately dominant weight so a real exact match structurally always outranks a non-exact one, exactly like this file's `MATCH_TYPE_PRIORITY` tier order. See [`docs/retrieval-intelligence/ranking.md`](../retrieval-intelligence/ranking.md).

## Strict tier ordering, not a weighted blend

`src/catalogue-ai/search/hybrid-ranking.ts`'s `MATCH_TYPE_PRIORITY` fixes a total order over match types:

```
EXACT_INTERNAL_CODE (1) < EXACT_OEM (2) < EXACT_ALTERNATE (3) < VERIFIED_SUPERSESSION (4)
  < EXACT_TECDOC (5) < VERIFIED_FITMENT (6) < KEYWORD_MATCH (7) < SEMANTIC_MATCH (8)
  < {POSSIBLE_ALTERNATIVE, CONFLICTING_MATCH} (9) < INSUFFICIENT_EVIDENCE (10)
```

`rankHybridResults()` sorts strictly by this tier first; `matchScore` is only ever a tiebreaker *within* the same tier. This is a structural guarantee, not a tuned weight — the spec's rule ("Do not allow semantic similarity to outrank an exact verified OEM-number match") cannot be violated by any cosine-similarity value, because a `SEMANTIC_MATCH` can never even be compared against an `EXACT_OEM` hit on score; it loses on tier before score is considered. Verified in `hybrid-ranking.spec.ts` with a `SEMANTIC_MATCH` scored 0.99 against an `EXACT_OEM` scored 0.5 — the exact match always wins.

## The parts relationship graph

`src/catalogue-ai/relationships/part-relationship.service.ts` adds the `PartRelationship` model, covering exactly the relationship types the platform didn't already have a home for:

`SAME_AS`, `ALTERNATE_NUMBER`, `SUPERSEDES`, `SUPERSEDED_BY`, `COMPATIBLE_WITH`, `PART_OF_KIT`, `REPLACED_WITH`, `RELATED_SERVICE_ITEM`, `MANUAL_REVIEW_LINK`.

`FITS_VEHICLE`/`FITS_ENGINE`/`FITS_TRANSMISSION` from the original 12-type brief were deliberately **not** added — `PartCompatibility` (Phase 1) already models vehicle/engine/transmission fitment with its own confidence and source fields. Adding a second, parallel representation would have created two disagreeing sources of truth for the same real fact.

Every `PartRelationship` carries `source`, `confidence`, `verificationStatus` (`PENDING`/`APPROVED`/`REJECTED`, reusing the existing `MatchCandidateStatus` enum rather than minting a new one), `evidence` (JSON), and `reviewerId`/`verifiedAt` once a human acts on it. `PartRelationshipService.propose()` always creates/updates a relationship as `PENDING` — there is no code path in this service that can set `APPROVED` except `verify()`, which requires a real `reviewerId`.

## Transitivity is never assumed

`SUPERSEDES`/`SUPERSEDED_BY` form a directed chain — "A supersedes B supersedes C" does not imply "A supersedes C" without checking the second hop for real, since a manufacturer can supersede a part twice for unrelated reasons. `SAME_AS` is the one relationship type where transitivity is real-world valid (if A=B and B=C then A=C). `COMPATIBLE_WITH`/`PART_OF_KIT` are never traversed beyond one hop without explicit evidence at each hop. `CatalogueSearchService.findSupersessions()` only ever returns direct, one-hop relationships and marks each `verified: relationshipType === APPROVED` — it never chains.

## Keyword and semantic tiers

`CatalogueSearchService.keywordSearchParts()`/`keywordSearchLubricants()` run a case-insensitive substring match over `standardizedProductName`/`normalizedName` — deterministic, DGX-independent, and always ranked below every exact-identifier tier. `SEMANTIC_MATCH` results only ever originate from `CatalogueRagService.answerFromRag()`'s call into `RagService.retrieveAndGenerate()` → `VectorSearchService.semanticSearch()`, and are capped at `MEDIUM` catalogue confidence even when the underlying retrieval confidence is `HIGH` — see [confidence-model.md](confidence-model.md).
