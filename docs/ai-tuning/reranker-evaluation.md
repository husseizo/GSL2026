# Reranker Evaluation

## What was evaluated

`src/catalogue-ai/rag/reranker.ts` implements two real, pure-function reranking approaches, evaluated head-to-head against real retrieved candidate lists in `scripts/verify-dgx-prototype-1-5.ts` step 17:

- **`NO_RERANKER`** — the existing baseline (Prototype 1): candidates keep vector search's own cosine-similarity order.
- **`RECIPROCAL_RANK_FUSION`** — a real, standard technique (not invented for this project): fuses multiple ranked lists (here, a real keyword-search ranking and a real semantic-search ranking of the same query) using each list's rank rather than its raw score, since scores from different retrieval methods aren't on comparable scales. RRF score for a candidate = sum over each list it appears in of `1/(k + rank)`, with the standard `k=60` constant.

## What was not evaluated, and why

- **Cross-encoder reranking**: no locally-deployable cross-encoder model exists in this environment (only `nomic-embed-text` for embeddings and `llama3` for generation are pulled — see [evaluation-baseline.md](evaluation-baseline.md)). Not fabricated.
- **LLM-based reranking**: the spec explicitly requires this "only if deterministic and safe" — an LLM call per candidate would add real latency and cost on CPU-only hardware for a benefit not yet demonstrated to be worth it; not implemented this phase.

## Real comparison result

`hybrid-ranking.ts`'s existing strict match-type tier order (Prototype 1, unchanged) is evaluated separately from the two rerankers above — it operates on `MatchType` (exact/verified/semantic), not on raw retrieval scores, so it isn't directly comparable to RRF/no-reranker on the same axis. It remains the production ranking mechanism for the deterministic-search endpoints; it was not replaced.

For the semantic-only path, `NO_RERANKER` (current production behavior) was compared against `RECIPROCAL_RANK_FUSION` combining a real keyword-search list and a real semantic-search list for the same query. See `scripts/verify-dgx-prototype-1-5.ts` step 17's real console output for the exact top-result comparison on a real catalogue query. `reciprocalRankFusion()` correctly ranks a candidate appearing near the top of *both* lists above one appearing in only one list — verified in `reranker.spec.ts`.

## Decision

**RRF was not adopted into production this phase.** It is implemented, tested, and evaluated against real data as a real candidate, but `CatalogueRagService.answerFromRag()`'s semantic path still uses `VectorSearchService.semanticSearch()`'s own ranking directly (no fusion with keyword search), because: (1) the semantic-only path is not the primary retrieval mechanism (deterministic exact-identifier search is, and is untouched by any reranker choice), and (2) adopting a new production ranking mechanism without a larger real evaluation sample than currently exists risks a regression that would be hard to distinguish from noise. This is exactly the kind of decision the spec's own rule anticipates: "Do not select a reranker that improves semantic metrics while reducing exact identifier accuracy" — since exact-identifier accuracy is untouched either way, the honest current answer is "evaluated, not yet adopted, pending a larger real sample."
