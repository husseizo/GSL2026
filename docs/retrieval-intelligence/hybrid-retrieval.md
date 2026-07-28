# Hybrid Retrieval Modes and Strategies

## 13 retrieval strategies (spec §7)

`RetrievalStrategyName` (`src/retrieval-intelligence/strategy/strategy-catalog.ts`): `EXACT_MATCH, FIELD_MATCH, PREFIX_MATCH, NORMALIZED_MATCH, ALIAS_MATCH, GRAPH_EXPANSION, HYBRID_SEARCH, VECTOR_SEARCH, SEMANTIC_SEARCH, HISTORICAL_SEARCH, CONFLICT_AWARE_SEARCH, PERMISSION_AWARE_SEARCH, FRESHNESS_AWARE_SEARCH`.

## Strategy selection — never "run everything" (spec §7's explicit rule)

`selectRetrievalStrategy()` (`src/retrieval-intelligence/strategy/strategy-selector.ts`) is a pure decision table:

- **Identifier-shaped classes** (11 of the 21 query classes) → `EXACT_MATCH, NORMALIZED_MATCH, ALIAS_MATCH, PREFIX_MATCH, GRAPH_EXPANSION` + the 3 always-on compliance strategies. Never includes `SEMANTIC_SEARCH`/`VECTOR_SEARCH` for the primary path.
- **TYPO/APPROXIMATE_SEARCH** → `NORMALIZED_MATCH, ALIAS_MATCH, FIELD_MATCH, VECTOR_SEARCH` (a fuzzy fallback family).
- **Free-text/language/mixed classes** → `FIELD_MATCH, HYBRID_SEARCH, VECTOR_SEARCH, SEMANTIC_SEARCH, GRAPH_EXPANSION, HISTORICAL_SEARCH`.
- **UNKNOWN** → plain `VECTOR_SEARCH` only — never a targeted guess.

`PERMISSION_AWARE_SEARCH`, `FRESHNESS_AWARE_SEARCH`, and `CONFLICT_AWARE_SEARCH` are always included regardless of query class — these are compliance-critical pipeline stages, never optional relevance strategies to skip.

## 10 hybrid retrieval modes (spec §9)

`RetrievalStrategyMode` (Prisma enum + `HybridRetrievalMode` TS union): `IDENTIFIER_ONLY, BM25, VECTOR, HYBRID, HYBRID_GRAPH, HYBRID_GRAPH_AUTHORITY, HYBRID_GRAPH_AUTHORITY_FRESHNESS, HYBRID_GRAPH_AUTHORITY_FIELD_BOOST, HYBRID_GRAPH_AUTHORITY_STRUCTURED_FACTS, HYBRID_GRAPH_AUTHORITY_LTR`. `MODE_ACTIVATIONS` defines each mode declaratively (which candidate-generation sources and ranking signals are active) — a real, inspectable table, not an assumption.

## Benchmarked, not assumed (spec §9's own words)

`RetrievalLabService.compareStrategies()` (the Query Lab, spec §13) runs the same real queries through the pipeline and groups real results by the mode each query was actually classified into — real recall/confidence/latency per mode, not a synthetic comparison. See [evaluation-results.md](evaluation-results.md) for real measured numbers.
