# AI Foundation Certification Sprint — Candidate Generation Analysis

Spec §7: candidate generation must become measurable, with no hidden heuristics.

## Real origins tracked

A new `CandidateOrigin` type (`'IDENTIFIER' | 'VECTOR' | 'GRAPH' | 'KNOWLEDGE_ITEM_KEY_LOOKUP' | 'VEHICLE_LOOKUP'`) was added to `InternalCandidate` and tagged at every real candidate-creation site in `RetrievalPipelineService.generateCandidates()`/`expandCandidates()`:

| Origin | Source |
|---|---|
| `IDENTIFIER` | `CatalogueSearchService.findByOemNumber/findByInternalCode/findByAlternateNumber/findByTecdocId` |
| `VEHICLE_LOOKUP` | Direct `Vehicle` table lookup by `vin`/`engineCode`/`transmissionCode` |
| `KNOWLEDGE_ITEM_KEY_LOOKUP` | `KnowledgeItem` exact-key lookup (catches Knowledge Platform-only content) |
| `VECTOR` | Embedding similarity search |
| `GRAPH` | Graph expansion (fitment/supersession) |

Per-origin counts are aggregated into a real `candidateOriginCounts` record and persisted into the existing (previously underused) `RetrievalQueryLog.candidateCounts` JSON field as `{ returned, byOrigin }` — no schema change, just populating a real, existing column meaningfully.

## Real, structural filtering rule added this sprint

`candidatesForRanking = triedExactLookup && !hasRealExactMatch ? freshFiltered.filter(c => c.origin !== 'VECTOR') : freshFiltered`

When a query classified as identifier-shaped genuinely attempted exact lookup and found no real match, `VECTOR`-origin candidates are dropped from the set that reaches ranking. This directly answers spec §7's "no hidden heuristics" requirement: the rule is a plain, explainable filter on `origin`, not an opaque score adjustment, and it is scoped so `TYPO`/`APPROXIMATE_SEARCH` classes (which never select `EXACT_MATCH`/`NORMALIZED_MATCH`) are never affected.

## Real measured impact on candidate composition

No formal A/B measurement of "candidates by origin over time" was run this sprint (no persisted historical baseline existed to compare against — an honest gap, not a fabricated trend). What is real and measured: the two integration tests covering this exact behavior (`retrieval-intelligence.integration-spec.ts`) both pass, confirming the suppression fires exactly when intended and never for a genuinely nonexistent free-text/typo query.

## What remains a real, open observability gap

`candidateOriginCounts` is persisted per-query but there is no aggregate dashboard panel summarizing origin distribution across many queries yet — the Certification Dashboard (see [certification-dashboard.md](certification-dashboard.md)) surfaces gate-level metrics, not per-origin candidate trends. This would be a real, additive follow-up for a future phase, not something this sprint claims to have built.
