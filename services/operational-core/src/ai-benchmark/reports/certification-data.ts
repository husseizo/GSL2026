// AI Foundation Certification Sprint — Certification Dashboard data shaping
// (spec §20 "official certification view"). Mirrors dashboard-data.ts's
// exact convention (pure query functions over real rows, no HTML/rendering
// concerns here) rather than extending it, since this dashboard answers a
// narrower, certification-specific question: "does every mandatory
// Retrieval Quality Gate pass right now, and is that reproducible?"
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RetrievalIntelligenceGateResult, RetrievalIntelligenceGateInputs, DEFAULT_RETRIEVAL_INTELLIGENCE_GATE_THRESHOLDS } from '../pipeline/retrieval-intelligence-quality-gates';

const GOLD_KEY = 'RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1';

interface PersistedGateRunMetrics {
  inputs?: RetrievalIntelligenceGateInputs;
  gates?: RetrievalIntelligenceGateResult[];
  sampleSize?: number;
  failedGates?: string[];
}

export interface CertificationDashboardData {
  generatedAt: string;
  goldBenchmarkVersion: number | null;
  latestRun: {
    runId: string;
    runAt: Date;
    sampleSize: number | null;
    casesScored: number;
    gateStatus: string | null;
    inputs: RetrievalIntelligenceGateInputs | null;
    gates: RetrievalIntelligenceGateResult[];
  } | null;
  thresholds: typeof DEFAULT_RETRIEVAL_INTELLIGENCE_GATE_THRESHOLDS;
  trend: { runId: string; runAt: Date; recallAt1: number | null; mrr: number | null; identifierAccuracy: number | null; sampleSize: number | null; gateStatus: string | null }[];
  snapshot: { id: string; versionNumber: number; status: string; activatedAt: Date | null; evaluatedAt: Date | null } | null;
  experiments: { id: string; name: string; strategyModeA: string; strategyModeB: string | null; createdAt: Date }[];
  failureBreakdown: { failureType: string; count: number }[];
  regressionHistory: { runId: string; regressed: boolean | null; startedAt: Date }[];
}

@Injectable()
export class CertificationDashboardDataService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCertificationDashboardData(): Promise<CertificationDashboardData> {
    const benchmark = await this.prisma.benchmark.findFirst({ where: { key: GOLD_KEY }, orderBy: { version: 'desc' } });

    const runs = benchmark
      ? await this.prisma.benchmarkRun.findMany({ where: { benchmarkId: benchmark.id }, orderBy: { startedAt: 'desc' }, take: 30 })
      : [];

    const latest = runs[0] ?? null;
    const latestMetrics = (latest?.metrics as PersistedGateRunMetrics | null) ?? null;

    const trend = [...runs]
      .reverse()
      .map((r) => {
        const m = r.metrics as PersistedGateRunMetrics | null;
        return {
          runId: r.id,
          runAt: r.startedAt,
          recallAt1: m?.inputs?.recallAt1 ?? null,
          mrr: m?.inputs?.mrr ?? null,
          identifierAccuracy: m?.inputs?.identifierAccuracy ?? null,
          sampleSize: m?.sampleSize ?? null,
          gateStatus: r.gateStatus ?? null,
        };
      });

    const snapshotRow = await this.prisma.knowledgeSnapshot.findFirst({ orderBy: { versionNumber: 'desc' } });

    const experimentRows = await this.prisma.retrievalExperiment.findMany({ orderBy: { createdAt: 'desc' }, take: 15 });

    const failureGroups = await this.prisma.retrievalQueryLog.groupBy({
      by: ['failureType'],
      where: { failureType: { not: null } },
      _count: { _all: true },
    });

    const regressionRuns = benchmark
      ? await this.prisma.benchmarkRun.findMany({ where: { benchmarkId: benchmark.id, regressed: { not: null } }, orderBy: { startedAt: 'desc' }, take: 20 })
      : [];

    return {
      generatedAt: new Date().toISOString(),
      goldBenchmarkVersion: benchmark?.version ?? null,
      latestRun: latest
        ? {
            runId: latest.id,
            runAt: latest.startedAt,
            sampleSize: latestMetrics?.sampleSize ?? null,
            casesScored: latest.casesEvaluated,
            gateStatus: latest.gateStatus ?? null,
            inputs: latestMetrics?.inputs ?? null,
            gates: latestMetrics?.gates ?? [],
          }
        : null,
      thresholds: DEFAULT_RETRIEVAL_INTELLIGENCE_GATE_THRESHOLDS,
      trend,
      snapshot: snapshotRow ? { id: snapshotRow.id, versionNumber: snapshotRow.versionNumber, status: snapshotRow.status, activatedAt: snapshotRow.activatedAt, evaluatedAt: snapshotRow.evaluatedAt } : null,
      experiments: experimentRows.map((e) => ({ id: e.id, name: e.name, strategyModeA: e.strategyModeA, strategyModeB: e.strategyModeB, createdAt: e.createdAt })),
      failureBreakdown: failureGroups.map((g) => ({ failureType: g.failureType as string, count: g._count._all })),
      regressionHistory: regressionRuns.map((r) => ({ runId: r.id, regressed: r.regressed, startedAt: r.startedAt })),
    };
  }
}
