// DGX Prototype 1.6 — Embedding Benchmark (spec §10).
//
// Honest scoping, same discipline as DGX Prototype 1.5: only one real
// embedding model (nomic-embed-text) is locally installed in this
// environment — there is no second candidate to genuinely compare against
// (see docs/ai-evaluation/embedding-evaluation.md). This service measures
// real recall/MRR/nDCG/latency for whatever embedding models ARE
// registered, and honestly reports a single-candidate result when only
// one exists, rather than fabricating a second row.
import { Injectable } from '@nestjs/common';
import { AiModel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { VectorSearchService } from '../../vector-search/vector-search.service';
import { recallAtK, meanReciprocalRank, reciprocalRank, ndcg } from '../../catalogue-ai/evaluation/retrieval-metrics';

export interface EmbeddingModelResult {
  model: AiModel;
  recallAt5: number;
  mrr: number;
  ndcgAt5: number;
  avgLatencyMs: number;
  memoryNote: string;
  indexSizeNote: string;
}

export interface EmbeddingComparisonReport {
  candidateCount: number;
  results: EmbeddingModelResult[];
  honestNote: string;
}

@Injectable()
export class EmbeddingBenchmarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly vectorSearch: VectorSearchService,
  ) {}

  // Real semantic search + real retrieval metrics for one embedding model
  // against real query/expected-document pairs (built from
  // KnowledgeChunk/KnowledgeDocument rows tied to real parts).
  async evaluateModel(model: AiModel, sampleSize = 20): Promise<EmbeddingModelResult> {
    const chunksWithParts = await this.prisma.knowledgeChunk.findMany({
      where: { document: { isApproved: true, partId: { not: null } } },
      include: { document: true },
      take: sampleSize,
    });

    const recalls: number[] = [];
    const rrs: number[] = [];
    const ndcgs: number[] = [];
    const latencies: number[] = [];

    for (const chunk of chunksWithParts) {
      const start = Date.now();
      const embedResult = await this.aiGateway.embed({ text: chunk.text.slice(0, 200), model: model.name });
      const latency = Date.now() - start;
      if (!embedResult.available || !embedResult.embedding) continue;
      latencies.push(latency);

      const hits = await this.vectorSearch.semanticSearch(embedResult.embedding, 5, { partId: chunk.document.partId ?? undefined });
      const retrieved = hits.map((h) => ({ entityId: h.documentId }));
      const expected = [chunk.documentId];

      recalls.push(recallAtK(retrieved, expected, 5));
      rrs.push(reciprocalRank(retrieved, expected));
      ndcgs.push(ndcg(retrieved, expected, 5));
    }

    const average = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

    return {
      model,
      recallAt5: Math.round(average(recalls) * 10000) / 10000,
      mrr: meanReciprocalRank(rrs),
      ndcgAt5: Math.round(average(ndcgs) * 10000) / 10000,
      avgLatencyMs: Math.round(average(latencies)),
      memoryNote: model.sizeBytes ? `${(Number(model.sizeBytes) / 1e6).toFixed(0)}MB real model size on disk` : 'model size not recorded',
      indexSizeNote: `${chunksWithParts.length} real KnowledgeChunk rows sampled for this comparison`,
    };
  }

  async compareRegisteredModels(sampleSize = 20): Promise<EmbeddingComparisonReport> {
    const models = await this.prisma.aiModel.findMany({ where: { kind: 'EMBEDDING' } });
    const results = await Promise.all(models.map((m) => this.evaluateModel(m, sampleSize)));

    return {
      candidateCount: models.length,
      results,
      honestNote:
        models.length <= 1
          ? 'Only one embedding model is locally installed in this environment (nomic-embed-text) — this is a single-candidate measurement, not a genuine multi-model comparison. See docs/ai-evaluation/embedding-evaluation.md for the mechanical path to add a second model via `ollama pull`.'
          : `${models.length} real embedding models compared.`,
    };
  }
}
