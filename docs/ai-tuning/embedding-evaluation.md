# Embedding Model Evaluation (Prototype 1.5 re-check)

## Honest, unchanged environment constraint

`GET /v1/models` against the real local DGX/Ollama service still lists exactly `nomic-embed-text:latest` — the same single embedding model available during Prototype 1's evaluation ([docs/ai/embedding-model-evaluation.md](../ai/embedding-model-evaluation.md)). No second embedding model (BGE/E5/GTE/Qwen) was pulled into this environment during this tuning phase. The multi-model comparison the spec asks for remains genuinely out of reach here, not skipped by choice.

## What changed this phase regarding embeddings

Nothing in the embedding pipeline itself changed — `EmbeddingService`, `CatalogueIndexVersionService`'s real pacing fix, and the checksum-based chunk-dedup are all unchanged from Prototype 1. `VectorSearchService.semanticSearch()`'s call site in `CatalogueRagService` now requests a wider top-8 candidates (previously top-5, via `RagService.retrieveAndGenerate()`'s hardcoded limit) to support context-size experiments — this is a retrieval-width change, not an embedding-model change.

## What a real second model would add, if pulled

`ModelRegistryService.syncFromDgx()` already discovers and registers whatever models are actually present in Ollama — adding a second embedding model requires no code change, only `ollama pull <model>` and re-running the same offline evaluation harness (`CatalogueEvaluationService`) against both. This remains true and unexecuted this phase, exactly as it was after Prototype 1.
