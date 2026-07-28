// DGX Prototype 1.6 — Reranker Benchmark (spec §11).
//
// Reuses reranker.ts's real RRF/no-reranker functions directly — no
// reimplementation. Honest scoping: no cross-encoder or LLM-reranker model
// is locally deployable in this environment (same constraint
// docs/ai-tuning/reranker-evaluation.md already documented for Prototype
// 1.5) — those two comparison rows are reported as DEFERRED, not
// fabricated.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogueSearchService } from '../../catalogue-ai/search/catalogue-search.service';
import { VectorSearchService } from '../../vector-search/vector-search.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { applyReranker, RerankCandidate, RerankerName } from '../../catalogue-ai/rag/reranker';
import { recallAtK, ndcg } from '../../catalogue-ai/evaluation/retrieval-metrics';

export interface RerankerResult {
  reranker: RerankerName;
  recallAt5: number;
  ndcgAt5: number;
  available: true;
}

export interface DeferredReranker {
  reranker: 'CROSS_ENCODER' | 'LLM_RERANKER';
  available: false;
  reason: string;
}

export interface RerankerComparisonReport {
  results: (RerankerResult | DeferredReranker)[];
}

@Injectable()
export class RerankerBenchmarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogueSearch: CatalogueSearchService,
    private readonly vectorSearch: VectorSearchService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async compareRerankers(sampleSize = 20): Promise<RerankerComparisonReport> {
    const realParts = await this.prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', productName: { not: '' } }, take: sampleSize });
    const rerankerNames: RerankerName[] = ['NO_RERANKER', 'RECIPROCAL_RANK_FUSION'];
    const scoresByReranker: Record<RerankerName, { recalls: number[]; ndcgs: number[] }> = {
      NO_RERANKER: { recalls: [], ndcgs: [] },
      RECIPROCAL_RANK_FUSION: { recalls: [], ndcgs: [] },
      CURRENT_HEURISTIC: { recalls: [], ndcgs: [] },
    };

    for (const part of realParts) {
      const keywordHits = await this.vectorSearch.keywordSearch(part.productName, 10, { partId: part.id });
      const embedResult = await this.aiGateway.embed({ text: part.productName });
      if (!embedResult.available || !embedResult.embedding) continue;
      const semanticHits = await this.vectorSearch.semanticSearch(embedResult.embedding, 10, { partId: part.id });

      const keywordList: RerankCandidate[] = keywordHits.map((h) => ({ id: h.documentId, score: h.score }));
      const semanticList: RerankCandidate[] = semanticHits.map((h) => ({ id: h.documentId, score: h.score }));
      const expected = [...new Set([...keywordHits, ...semanticHits].map((h) => h.documentId))].slice(0, 1); // the top real document for this part is the expected relevant one

      for (const name of rerankerNames) {
        const fused = applyReranker(name, [semanticList, keywordList]);
        const retrieved = fused.map((c) => ({ entityId: c.id }));
        scoresByReranker[name].recalls.push(recallAtK(retrieved, expected, 5));
        scoresByReranker[name].ndcgs.push(ndcg(retrieved, expected, 5));
      }
    }

    const average = (values: number[]) => (values.length === 0 ? 0 : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10000) / 10000);

    const results: (RerankerResult | DeferredReranker)[] = rerankerNames.map((name) => ({
      reranker: name,
      recallAt5: average(scoresByReranker[name].recalls),
      ndcgAt5: average(scoresByReranker[name].ndcgs),
      available: true as const,
    }));

    results.push(
      { reranker: 'CROSS_ENCODER', available: false, reason: 'no locally-deployable cross-encoder model exists in this environment' },
      { reranker: 'LLM_RERANKER', available: false, reason: 'would require an additional real LLM call per candidate — not evaluated this phase to avoid fabricating a comparison against unmeasured latency/cost tradeoffs' },
    );

    return { results };
  }
}
