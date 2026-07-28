import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { keywordScore, mergeWeightedScores } from './hybrid-search-math';
import { VECTOR_INDEX_PROVIDER, VectorIndexProvider, VectorSearchFilter, VectorSearchHit } from './vector-index.provider';

// "VIN similarity / part similarity / repair similarity / vehicle
// similarity / technician note similarity / document similarity /
// conversation retrieval" from the spec are all the same operation with a
// different filter: semantic search scoped by VectorSearchFilter
// (sourceType + vehicleId/partId/lubricantProductId). One generic search
// surface, not seven bespoke methods that would all do the same cosine
// comparison. See docs/architecture/vector-search.md.
@Injectable()
export class VectorSearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VECTOR_INDEX_PROVIDER) private readonly provider: VectorIndexProvider,
  ) {}

  semanticSearch(queryEmbedding: number[], topK: number, filter?: VectorSearchFilter): Promise<VectorSearchHit[]> {
    return this.provider.searchSemantic(queryEmbedding, topK, filter);
  }

  async keywordSearch(query: string, topK: number, filter: VectorSearchFilter = {}): Promise<VectorSearchHit[]> {
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

    return candidates
      .map((chunk) => ({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.document.title,
        sourceType: chunk.document.sourceType,
        text: chunk.text,
        score: keywordScore(chunk.text, query),
      }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    topK: number,
    filter?: VectorSearchFilter,
    weights?: { semantic: number; keyword: number },
  ): Promise<VectorSearchHit[]> {
    const [semanticHits, keywordHits] = await Promise.all([
      this.semanticSearch(queryEmbedding, topK * 3, filter),
      this.keywordSearch(query, topK * 3, filter),
    ]);

    const merged = mergeWeightedScores(
      semanticHits.map((h) => ({ chunkId: h.chunkId, score: h.score })),
      keywordHits.map((h) => ({ chunkId: h.chunkId, score: h.score })),
      weights,
    );

    const byId = new Map([...semanticHits, ...keywordHits].map((h) => [h.chunkId, h]));
    return merged
      .slice(0, topK)
      .map((m) => ({ ...byId.get(m.chunkId)!, score: m.score }))
      .filter(Boolean);
  }
}
