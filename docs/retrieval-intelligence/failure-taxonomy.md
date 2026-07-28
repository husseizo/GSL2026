# Failure Taxonomy

## The 11 real failure types (spec §19)

`classifyRetrievalFailure()` (`src/retrieval-intelligence/failure-analysis/failure-classifier.ts`) is a pure, ordered classification of a completed retrieval outcome against its expected answer: `WRONG_IDENTIFIER, WRONG_RANKING, MISSING_EMBEDDING, MISSING_GRAPH, WRONG_SNAPSHOT, WRONG_CITATION, PERMISSION_ERROR, CONFLICT_ERROR, FRESHNESS_ERROR, NO_RESULT, FALSE_RESULT`. Every failure becomes a benchmark candidate (spec's own words) — the classification never silently discards a real failure.

## Ordering, most-specific-cause-first

1. `PERMISSION_ERROR` / `FRESHNESS_ERROR` / `CONFLICT_ERROR` — compliance-critical exclusions checked first, since these are never "the ranking's fault."
2. `WRONG_SNAPSHOT` / `WRONG_CITATION` — infrastructure-level real failures.
3. `FALSE_RESULT` (a no-answer case that returned something) / `NO_RESULT` (an answer-expected case that returned nothing).
4. `WRONG_IDENTIFIER` (identifier-class query, wrong top result) / `MISSING_GRAPH` (graph expansion expected but didn't run) / `MISSING_EMBEDDING` (non-identifier class, no real embedding score available).
5. `WRONG_RANKING` — the real, correct entity was present but not ranked first; the residual, catch-all real ranking-quality failure.

## Real use

`RetrievalQueryLog.failureType` persists this classification per logged query (spec §4 stage 16/§18), feeding both live observability and the Query Lab's failure-replay feature (spec §13).
