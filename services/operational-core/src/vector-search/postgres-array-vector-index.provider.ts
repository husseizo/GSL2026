import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cosineSimilarity } from './cosine-similarity';
import { VectorIndexProvider, VectorSearchFilter, VectorSearchHit } from './vector-index.provider';

// The deliberate interim backend: embeddings live in a plain Postgres
// `Float[]` column (KnowledgeChunk.embedding); similarity is computed in
// application code, not in SQL. This is the same trade-off Phase 2's
// inventory analytics made (aggregate in JS, not SQL) — fine at this
// dataset's size, not built for millions of chunks. pgvector isn't
// available on this portable Postgres build (confirmed via
// pg_available_extensions — see decision-log entries), and Qdrant/Milvus
// aren't deployed. Only approved documents' chunks are ever candidates —
// "never allow AI to answer from unverified documents" is enforced here,
// not left to the caller to remember.
@Injectable()
export class PostgresArrayVectorIndexProvider implements VectorIndexProvider {
  constructor(private readonly prisma: PrismaService) {}

  async searchSemantic(queryEmbedding: number[], topK: number, filter: VectorSearchFilter = {}): Promise<VectorSearchHit[]> {
    const candidates = await this.prisma.knowledgeChunk.findMany({
      where: {
        document: {
          isApproved: true,
          sourceType: filter.sourceTypes ? { in: filter.sourceTypes } : undefined,
          vehicleId: filter.vehicleId,
          partId: filter.partId,
          lubricantProductId: filter.lubricantProductId,
          id: filter.documentIds ? { in: filter.documentIds } : undefined,
        },
      },
      include: { document: true },
    });

    const scored = candidates.map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.document.title,
      sourceType: chunk.document.sourceType,
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
