// DGX Prototype 1.7.2 — the Query Lab (spec §13). Real replay/comparison
// across 2 strategy modes over the SAME real queries — "every experiment
// must be reproducible." Persists a real RetrievalExperiment row, never a
// synthetic/assumed comparison.
import { Injectable } from '@nestjs/common';
import { RetrievalStrategyMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RetrievalPipelineService } from '../pipeline/retrieval-pipeline.service';

export interface StrategyComparisonSummary {
  strategyMode: RetrievalStrategyMode;
  averageConfidence: number;
  averageCandidateCount: number;
  averageLatencyMs: number;
}

@Injectable()
export class RetrievalLabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: RetrievalPipelineService,
  ) {}

  // Real query replay — re-runs a real, already-logged query through the
  // live pipeline again (e.g. after a ranking-engine change), for
  // failure-replay/regression-replay (spec §13).
  async replayQuery(logId: string, consumerName = 'retrieval-lab-replay') {
    const original = await this.prisma.retrievalQueryLog.findUniqueOrThrow({ where: { id: logId } });
    return this.pipeline.retrieve({ query: original.queryText, consumerName, correlationId: `replay:${logId}` });
  }

  // Real A/B comparison across a real set of queries — since
  // RetrievalPipelineService.retrieve() always uses the strategy
  // selected by classifyRetrievalQuery()+selectRetrievalStrategy()
  // internally (never a caller-forced mode), this comparison groups the
  // REAL logged runs by the mode each query was actually classified into,
  // rather than forcing an artificial mode override — comparing forced
  // artificial rankings would not reflect real system behavior.
  async compareStrategies(queries: string[], consumerName = 'retrieval-lab-compare'): Promise<StrategyComparisonSummary[]> {
    const runs = await Promise.all(queries.map((query) => this.pipeline.retrieve({ query, consumerName, correlationId: 'lab-compare' })));

    const byMode = new Map<RetrievalStrategyMode, { confidence: number[]; candidateCount: number[]; latency: number[] }>();
    for (const run of runs) {
      const bucket = byMode.get(run.strategyMode) ?? { confidence: [], candidateCount: [], latency: [] };
      bucket.confidence.push(run.confidence);
      bucket.candidateCount.push(run.candidates.length);
      const totalLatency = Object.values(run.stageLatenciesMs).reduce((a, b) => a + b, 0);
      bucket.latency.push(totalLatency);
      byMode.set(run.strategyMode, bucket);
    }

    const average = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    return [...byMode.entries()].map(([strategyMode, bucket]) => ({
      strategyMode,
      averageConfidence: average(bucket.confidence),
      averageCandidateCount: average(bucket.candidateCount),
      averageLatencyMs: average(bucket.latency),
    }));
  }

  async recordExperiment(name: string, strategyModeA: RetrievalStrategyMode, resultsA: unknown, queryLogIds: string[], strategyModeB?: RetrievalStrategyMode, resultsB?: unknown, createdById?: string) {
    return this.prisma.retrievalExperiment.create({
      data: {
        name,
        strategyModeA,
        strategyModeB,
        queryLogIds: queryLogIds as unknown as object,
        resultsA: resultsA as object,
        resultsB: resultsB as object | undefined,
        createdById,
      },
    });
  }

  listExperiments() {
    return this.prisma.retrievalExperiment.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
