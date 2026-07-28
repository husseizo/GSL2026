// DGX Prototype 1.6 — Dashboard data shaping (spec §22).
//
// Pure query functions over real rows (BenchmarkRun/BenchmarkSuiteRun/
// PromptExperiment/AiInferenceLog/AiFeedback) — no HTML/rendering concerns
// here, that's report-generator.ts's job. This is what makes the "9
// dashboards" (AI Quality/Retrieval/Generation/Safety/Latency/Experiments/
// Benchmark Trends/Regression History/Pilot Quality) reproducible: rerun
// this against the same DB state, get the same shape back.
import { Injectable } from '@nestjs/common';
import { BenchmarkCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';

export interface DashboardData {
  generatedAt: string;
  aiQuality: { category: BenchmarkCategory; latestMetrics: unknown; casesEvaluated: number; runAt: Date | null }[];
  retrieval: { runId: string; recallAt1: unknown; runAt: Date }[];
  generation: { runId: string; avgGroundedness: unknown; citationCorrectness: unknown; runAt: Date }[];
  safety: { runId: string; refusalAccuracy: unknown; runAt: Date }[];
  latency: { runId: string; deterministicP95Ms: unknown; generativeP95Ms: unknown; runAt: Date }[];
  experiments: { id: string; name: string; status: string; winnerArmId: string | null; armCount: number }[];
  benchmarkTrends: { category: BenchmarkCategory; runCount: number; firstRunAt: Date | null; lastRunAt: Date | null }[];
  regressionHistory: { runId: string; benchmarkKey: string; regressed: boolean | null; startedAt: Date }[];
  pilotQuality: { acceptanceRatePct: number | null; totalFeedback: number };
}

@Injectable()
export class DashboardDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  async buildDashboardData(): Promise<DashboardData> {
    const categories = ['RETRIEVAL', 'GENERATION', 'SAFETY', 'SECURITY', 'PERFORMANCE', 'SWAHILI', 'ENGLISH', 'MIXED_LANGUAGE', 'REASONING', 'CONFLICT_DETECTION', 'PERMISSION_ENFORCEMENT', 'PROMPT_INJECTION', 'LATENCY', 'RELIABILITY', 'REGRESSION', 'PRODUCTION_READINESS'] as BenchmarkCategory[];

    const aiQuality = await Promise.all(
      categories.map(async (category) => {
        const latestRun = await this.prisma.benchmarkRun.findFirst({ where: { benchmark: { category }, status: 'COMPLETED' }, orderBy: { startedAt: 'desc' } });
        return { category, latestMetrics: latestRun?.metrics ?? null, casesEvaluated: latestRun?.casesEvaluated ?? 0, runAt: latestRun?.startedAt ?? null };
      }),
    );

    const retrievalRuns = await this.prisma.benchmarkRun.findMany({ where: { benchmark: { category: 'RETRIEVAL' }, status: 'COMPLETED' }, orderBy: { startedAt: 'desc' }, take: 20 });
    const retrieval = retrievalRuns.map((r) => ({ runId: r.id, recallAt1: (r.metrics as Record<string, unknown>)?.metrics ? ((r.metrics as { metrics?: { recallAt1?: unknown } }).metrics?.recallAt1 ?? null) : null, runAt: r.startedAt }));

    const generationRuns = await this.prisma.benchmarkRun.findMany({ where: { benchmark: { category: 'GENERATION' }, status: 'COMPLETED' }, orderBy: { startedAt: 'desc' }, take: 20 });
    const generation = generationRuns.map((r) => {
      const m = (r.metrics as { metrics?: { avgGroundedness?: unknown; citation?: { correctness?: unknown } } })?.metrics;
      return { runId: r.id, avgGroundedness: m?.avgGroundedness ?? null, citationCorrectness: m?.citation?.correctness ?? null, runAt: r.startedAt };
    });

    const safetyRuns = await this.prisma.benchmarkRun.findMany({ where: { benchmark: { category: 'SAFETY' }, status: 'COMPLETED' }, orderBy: { startedAt: 'desc' }, take: 20 });
    const safety = safetyRuns.map((r) => ({ runId: r.id, refusalAccuracy: (r.metrics as { metrics?: { refusalAccuracy?: unknown } })?.metrics?.refusalAccuracy ?? null, runAt: r.startedAt }));

    const latencyRuns = await this.prisma.benchmarkRun.findMany({ where: { benchmark: { category: 'LATENCY' }, status: 'COMPLETED' }, orderBy: { startedAt: 'desc' }, take: 20 });
    const latency = latencyRuns.map((r) => {
      const m = (r.metrics as { metrics?: { deterministicP95Ms?: unknown; generativeP95Ms?: unknown } })?.metrics;
      return { runId: r.id, deterministicP95Ms: m?.deterministicP95Ms ?? null, generativeP95Ms: m?.generativeP95Ms ?? null, runAt: r.startedAt };
    });

    const experimentRows = await this.prisma.promptExperiment.findMany({ include: { arms: true }, orderBy: { createdAt: 'desc' }, take: 20 });
    const experiments = experimentRows.map((e) => ({ id: e.id, name: e.name, status: e.status, winnerArmId: e.winnerArmId, armCount: e.arms.length }));

    const benchmarkTrends = await Promise.all(
      categories.map(async (category) => {
        const runs = await this.prisma.benchmarkRun.findMany({ where: { benchmark: { category }, status: 'COMPLETED' }, orderBy: { startedAt: 'asc' } });
        return { category, runCount: runs.length, firstRunAt: runs[0]?.startedAt ?? null, lastRunAt: runs.at(-1)?.startedAt ?? null };
      }),
    );

    const regressionRuns = await this.prisma.benchmarkRun.findMany({ where: { regressed: { not: null } }, include: { benchmark: true }, orderBy: { startedAt: 'desc' }, take: 30 });
    const regressionHistory = regressionRuns.map((r) => ({ runId: r.id, benchmarkKey: r.benchmark.key, regressed: r.regressed, startedAt: r.startedAt }));

    const feedbackTotal = await this.prisma.aiFeedback.count();
    const acceptedTotal = await this.prisma.aiFeedback.count({ where: { decision: { in: ['ACCEPTED', 'HELPFUL'] } } });
    const pilotQuality = { acceptanceRatePct: feedbackTotal > 0 ? Math.round((acceptedTotal / feedbackTotal) * 10000) / 100 : null, totalFeedback: feedbackTotal };

    return {
      generatedAt: new Date().toISOString(),
      aiQuality,
      retrieval,
      generation,
      safety,
      latency,
      experiments,
      benchmarkTrends,
      regressionHistory,
      pilotQuality,
    };
  }
}
