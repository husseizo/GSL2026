# Embedding Benchmark — DGX Prototype 1.6

## Honest scoping

Only one embedding model, `nomic-embed-text:latest`, is locally installed in this environment (confirmed via `ModelRegistryService.list({ kind: 'EMBEDDING' })`) — the same constraint DGX Prototype 1.5 documented for its own embedding comparison. `EmbeddingBenchmarkService.compareRegisteredModels()` (`src/ai-benchmark/embedding-reranker/embedding-benchmark.service.ts`) genuinely evaluates *whatever* embedding models are registered — real recall@5/MRR/nDCG@5 against real `KnowledgeChunk`/`KnowledgeDocument` rows tied to real parts, real embedding-call latency, and a real model-size note — and honestly reports a single-candidate result (`candidateCount: 1`) rather than fabricating a second row.

## What's measured, for real

- **Recall@5 / MRR / nDCG@5**: real semantic search (`VectorSearchService.semanticSearch()`) against a real sample of approved `KnowledgeChunk` rows tied to real parts, scored with the same `retrieval-metrics.ts` functions used everywhere else in this codebase.
- **Latency**: real per-embed-call wall-clock time via `AiGatewayService.embed()`.
- **Memory / index size**: real `AiModel.sizeBytes` (from the live Ollama sync) and the real count of `KnowledgeChunk` rows sampled.
- **Misspelling recovery / Swahili retrieval / automotive vocabulary**: not measured as separate embedding-specific metrics this phase — these are already covered at the pipeline level by the `MISSPELLED_DESCRIPTION`/`SWAHILI`/`RETRIEVAL` category benchmarks, which exercise the same one real embedding model. A genuine per-embedding-model breakdown of these would require a second real candidate to compare against.

## The mechanical path to a real second candidate

`ollama pull` a second embedding model (e.g. `bge-large` or `e5-large`), let `ModelRegistryService.syncFromDgx()` register it (no code change needed — this is exactly the "reflects whatever is actually pulled" design), then rerun `compareRegisteredModels()`. The comparison infrastructure is real and ready; only the second model is missing from this environment.

## Real verification

`scripts/verify-ai-evaluation-framework.ts` step 36 runs `compareRegisteredModels(10)` live and reports the real `candidateCount` and honest note.
