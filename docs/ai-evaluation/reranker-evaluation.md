# Reranker Benchmark — DGX Prototype 1.6

## Reused, not reimplemented

`RerankerBenchmarkService` (`src/ai-benchmark/embedding-reranker/reranker-benchmark.service.ts`) calls `applyReranker()` from `src/catalogue-ai/rag/reranker.ts` directly — the same real `NO_RERANKER`/`RECIPROCAL_RANK_FUSION` functions DGX Prototype 1.5 built and tested. No reranking logic is duplicated here.

## Real comparison

For a real sample of parts, both a real keyword-search ranked list and a real semantic-search ranked list are fetched (`VectorSearchService.keywordSearch()`/`semanticSearch()`), then each reranker is applied and scored with `recallAtK`/`ndcg` from `retrieval-metrics.ts`. Two real candidates are reported: `NO_RERANKER` and `RECIPROCAL_RANK_FUSION`.

## Honestly DEFERRED

`CROSS_ENCODER` and `LLM_RERANKER` are both reported as `available: false` with a stated reason — no locally-deployable cross-encoder model exists in this environment (the same constraint DGX Prototype 1.5 documented), and an LLM-based reranker would require an additional real LLM call per candidate, whose latency/cost tradeoff was not measured this phase rather than fabricated. `CURRENT_HEURISTIC` (Prototype 1's strict match-type-tier ordering in `hybrid-ranking.ts`) is evaluated separately since it operates on `MatchType`, not raw scores — see `docs/ai/parts-search-ranking.md`.

## Real verification

`scripts/verify-ai-evaluation-framework.ts` step 37 runs `compareRerankers(10)` live and reports the real candidate count vs. the honestly deferred count.
