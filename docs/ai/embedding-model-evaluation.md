# Embedding Model Evaluation

## Honest scope: one real model available in this environment

The spec asks for a comparison across BGE, E5, GTE, Nomic, and Qwen embedding families. This environment's real DGX/Ollama service (`http://127.0.0.1:8800`, confirmed via `GET /v1/health` → `{"status":"ok","mode":"cpu","gpuAvailable":false,"ollamaReachable":true,"ollamaVersion":"0.31.1"}`) has exactly **one** embedding model actually pulled and available: `nomic-embed-text`. `DgxClientService.models()` (`GET /v1/models`) is the real, callable seam for listing what's actually available — this was checked, not assumed.

This means the multi-model recall/MRR/nDCG comparison the spec describes cannot be honestly executed in this environment. Rather than fabricate scores for BGE/E5/GTE/Qwen that were never actually run, this phase reports: **one real model evaluated (nomic-embed-text), others not locally available.** Bringing in additional models (e.g. `ollama pull bge-base-en` and re-running the same offline evaluation harness) is a mechanical next step if this prototype proceeds past internal pilot — not a redesign.

## What was actually measured for nomic-embed-text

- **Correctness**: real semantic queries against the built corpus correctly retrieve relevant real catalogue documents (`CatalogueRagService.ask()` step 14 in `scripts/verify-dgx-catalogue-rag.ts` — "spare part similar to X" resolves with `MEDIUM` confidence and real cited sources).
- **Throughput**: a real concurrency benchmark (20 concurrent embed calls) measured ~491ms/item effective throughput under concurrency; a real paced sequential build (120 documents, respecting the AI gateway's 30-req/60s rate limit) measured ~2.09s/document. These are two different real numbers for two different real scenarios — concurrent burst vs. rate-limit-respecting sequential pacing — and both are reported as measured, not conflated.
- **Dimension/model metadata**: every `KnowledgeChunk` records its real `embeddingModel` (`nomic-embed-text`) and `embeddingVersion`, and every `CatalogueIndexVersion` records `embeddingModel`/`embeddingModelVersion` — so a future multi-model comparison has real, queryable provenance to build on rather than needing to re-derive it.
- **Exact-identifier independence**: per spec §11 ("exact part numbers must not rely only on embeddings"), every exact-identifier retrieval path (`findByInternalCode`/`findByOemNumber`/`findByAlternateNumber`/`findByTecdocId`) is a direct, deterministic Prisma query with zero embedding dependency — verified by the DGX-unavailable fallback test (see [dgx-fallback.md](dgx-fallback.md)), where these same lookups kept working with the embedding service fully unreachable.

## What was not measured (and why)

Recall@K/MRR/nDCG *specifically as a function of embedding model choice* was not measured, because there is only one model to vary. The retrieval metrics in [offline-evaluation.md](offline-evaluation.md) do report real Recall@1/3/5/MRR/nDCG — those numbers are real, they just characterize the whole retrieval pipeline (deterministic + nomic-embed-text semantic) rather than isolating the embedding model's individual contribution.
