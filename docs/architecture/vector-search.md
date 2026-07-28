# Vector Search

`src/vector-search/` — semantic, keyword, and hybrid search over `KnowledgeChunk` embeddings, built behind an interface specifically so the backend can change without touching any caller.

## Why a plain Postgres array, not pgvector

`pg_available_extensions` was queried directly against this environment's portable PostgreSQL 16 build — `pgvector` isn't in the list, and installing it would require compiling a native extension against this exact Postgres build, which isn't practical here. Qdrant/Milvus aren't deployed either. Rather than block Phase 4 on infrastructure that doesn't exist, `KnowledgeChunk.embedding` is a plain `Float[]` column, and similarity is computed in application code (`cosine-similarity.ts`) — the same "aggregate in JS, not SQL" trade-off Phase 2's inventory analytics already made deliberately, at a documented scale limitation.

## The seam that makes migration real, not aspirational

```ts
export interface VectorIndexProvider {
  searchSemantic(queryEmbedding, topK, filter?): Promise<VectorSearchHit[]>;
}
```

`VectorSearchService` depends only on this interface, injected via a NestJS custom provider token (`VECTOR_INDEX_PROVIDER`). `PostgresArrayVectorIndexProvider` is the only implementation today. A real pgvector/Qdrant/Milvus backend later is a single binding change in `vector-search.module.ts` — `{ provide: VECTOR_INDEX_PROVIDER, useClass: QdrantVectorIndexProvider }` — with zero changes to `RagService`, the AI assistants, or any controller. This is the literal implementation of the spec's §4 instruction, not a design intention documented and then ignored.

## Search modes

- **Semantic** (`searchSemantic`) — cosine similarity over real embeddings, filtered to `isApproved` documents (and optionally `sourceType`/`vehicleId`/`partId`/`lubricantProductId`/`documentIds`). This is the only mode `RagService` uses for confidence-bearing answers (see [rag-architecture.md](rag-architecture.md) for why).
- **Keyword** (`keywordSearch`) — term-frequency scoring (`hybrid-search-math.ts`'s `keywordScore()`), normalized by chunk length so a short chunk repeating a term doesn't automatically outrank a longer, more thorough one.
- **Hybrid** (`hybridSearch`) — merges semantic and keyword result sets via `mergeWeightedScores()`, min-max normalizing each list before combining with configurable weights (default 70% semantic / 30% keyword). **This normalized score is relative ranking only** — it is not, and must not be used as, an absolute confidence signal (see the real bug this caused, documented in [rag-architecture.md](rag-architecture.md)).

## One generic filter, not seven bespoke methods

"VIN similarity / part similarity / repair similarity / vehicle similarity / technician-note similarity / document similarity / conversation retrieval" from the spec are all the same underlying operation — semantic search scoped by `VectorSearchFilter` (`sourceTypes` + `vehicleId`/`partId`/`lubricantProductId`/`documentIds`). A `KnowledgeDocument` tagged `sourceType: VEHICLE_HISTORY` with `vehicleId` set makes "VIN similarity" a filtered `searchSemantic()` call, not a separate index or method.

## Access control at the query, not the response

`isApproved: true` is filtered inside `searchSemantic()`/`keywordSearch()` themselves — an unapproved document's chunks are never candidates for retrieval in the first place, verified directly in `rag.integration-spec.ts` ("an unapproved document is never returned by semantic search").
