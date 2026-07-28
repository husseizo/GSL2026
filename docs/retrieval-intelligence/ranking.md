# Ranking Intelligence

## 15 real signals (spec §8)

`combineSignals()` (`src/retrieval-intelligence/ranking/ranking-engine.ts`) combines `EXACT_IDENTIFIER, FIELD_MATCH, AUTHORITY, FRESHNESS, APPROVAL_STATUS, KNOWLEDGE_QUALITY, GRAPH_DISTANCE, STRUCTURED_FACT_CONFIDENCE, CITATION_QUALITY, REVIEW_STATUS, CONFLICT_STATUS, POPULARITY, HISTORICAL_ACCURACY, EMBEDDING_SIMILARITY, BUSINESS_CONTEXT` into one score with a per-signal `{signal, value, weight, contribution}` explanation array — every result exposes its ranking explanation, never a bare number.

## The structural exact-match guarantee

`EXACT_IDENTIFIER` carries weight 100; the sum of every other signal's default weight is well under 100 (52). `exactIdentifierAlwaysWins()` is a real, tested structural proof: a candidate with a real exact-identifier match always outranks a candidate with every other signal maxed at 1.0 but no exact match. This generalizes Catalogue AI's existing `hybrid-ranking.ts` tier guarantee ("semantic never outranks exact") into the new engine rather than replacing it, and is exactly how spec §15's "never allow graph expansion to override an exact identifier match" is enforced structurally, not just by convention.

## Honestly neutral signals — no real data source in this environment

`POPULARITY` and `HISTORICAL_ACCURACY` are always 0 (no real click-through/outcome-tracking data source exists in this environment) and `BUSINESS_CONTEXT` is always 0 (no real business-context signal source exists) — weight 0 by default, named explicitly here rather than fabricated with placeholder values. This mirrors the project's own established honesty discipline (e.g. the DGX 1.7.1 ClamAV-unavailable precedent).

## Real BM25 (spec §9)

The existing `keywordScore()` (`src/vector-search/hybrid-search-math.ts`) is a simple term-frequency/√length scorer, not real BM25. Since the spec explicitly names BM25 as a benchmarked retrieval mode, this phase implements a real, standard Okapi BM25 (`src/retrieval-intelligence/ranking/bm25.ts`, k1=1.2, b=0.75, the Lucene/Elasticsearch defaults) computed from real corpus statistics (document frequency, average document length) — never mislabeling the existing simpler scorer as BM25.

## The Learning-to-Rank abstraction (spec §10)

Per the spec's explicit rule ("do not implement machine-learned ranking yet"), `ranker-provider.interface.ts` defines a `RankerProvider` interface mirroring the existing `VectorIndexProvider` seam pattern exactly: one real implementation today (`HeuristicRankerProvider`, delegating to the same `combineSignals()` logic), and a documented — never implemented — seam for a future XGBoost/LightGBM/CatBoost gradient-boosted ranker (treating the same 15 signals as model features) or a neural cross-encoder re-scoring the top-N candidates, without any retrieval API changing.

## Real, honest limitation on graph-relationship candidates

A candidate produced by graph expansion for a non-content node type (VEHICLE, ENGINE, TOOL, FAULT_CODE, etc.) never receives an `EXACT_IDENTIFIER` or `STRUCTURED_FACT_CONFIDENCE` signal — it is a real related entity, not independently-citable content, and its ranking score reflects only `GRAPH_DISTANCE` (see [graph-retrieval.md](graph-retrieval.md) for the real bug this distinction fixed).
