import { KnowledgeSourceType } from '@prisma/client';

// The seam the spec's §4 asks for: "Support future migration between
// pgvector, Qdrant or Milvus." Everything above this interface (RAG,
// assistants) only ever calls VectorSearchService, which only ever calls a
// VectorIndexProvider — swapping PostgresArrayVectorIndexProvider for a real
// pgvector- or Qdrant-backed implementation later is a DI binding change in
// vector-search.module.ts, not a rewrite of any caller. See
// docs/architecture/vector-search.md.
export interface VectorSearchFilter {
  sourceTypes?: KnowledgeSourceType[];
  vehicleId?: string;
  partId?: string;
  lubricantProductId?: string;
  documentIds?: string[];
}

export interface VectorSearchHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceType: KnowledgeSourceType;
  text: string;
  score: number;
}

export const VECTOR_INDEX_PROVIDER = Symbol('VECTOR_INDEX_PROVIDER');

export interface VectorIndexProvider {
  searchSemantic(queryEmbedding: number[], topK: number, filter?: VectorSearchFilter): Promise<VectorSearchHit[]>;
}
