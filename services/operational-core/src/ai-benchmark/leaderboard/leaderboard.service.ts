// DGX Prototype 1.6 — AI Leaderboard (spec §17).
//
// One ranked list PER category — never a blended overall rank (the same
// "never collapse into one average" rule that governs every other part of
// this module). Ranking metric per category is a single, named,
// documented field (the category's own "higher/lower is better" primary
// metric), not an invented composite score.
import { Injectable } from '@nestjs/common';
import { BenchmarkCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// The one real metric each category is ranked by — documented here so the
// choice is visible and auditable, not implicit inside a query.
const PRIMARY_METRIC_PATH: Record<BenchmarkCategory, { path: string; direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' }> = {
  RETRIEVAL: { path: 'recallAt1', direction: 'HIGHER_IS_BETTER' },
  GENERATION: { path: 'avgGroundedness', direction: 'HIGHER_IS_BETTER' },
  SAFETY: { path: 'refusalAccuracy', direction: 'HIGHER_IS_BETTER' },
  SECURITY: { path: 'policyBypassAccuracy', direction: 'HIGHER_IS_BETTER' },
  PERFORMANCE: { path: 'p95Ms', direction: 'LOWER_IS_BETTER' },
  SWAHILI: { path: 'recallAt1', direction: 'HIGHER_IS_BETTER' },
  ENGLISH: { path: 'recallAt1', direction: 'HIGHER_IS_BETTER' },
  MIXED_LANGUAGE: { path: 'recallAt1', direction: 'HIGHER_IS_BETTER' },
  REASONING: { path: 'multiHopAccuracy', direction: 'HIGHER_IS_BETTER' },
  CONFLICT_DETECTION: { path: 'conflictDetectionAccuracy', direction: 'HIGHER_IS_BETTER' },
  PERMISSION_ENFORCEMENT: { path: 'enforcementAccuracy', direction: 'HIGHER_IS_BETTER' },
  PROMPT_INJECTION: { path: 'refusalAccuracy', direction: 'HIGHER_IS_BETTER' },
  LATENCY: { path: 'generativeP95Ms', direction: 'LOWER_IS_BETTER' },
  RELIABILITY: { path: 'successRate', direction: 'HIGHER_IS_BETTER' },
  REGRESSION: { path: 'categoriesRegressed', direction: 'LOWER_IS_BETTER' },
  PRODUCTION_READINESS: { path: 'passRate', direction: 'HIGHER_IS_BETTER' },
  // DGX Prototype 1.7 — ranked by retrieval accuracy, the single most
  // consumer-relevant sub-score inside KnowledgeCategoryMetrics.
  KNOWLEDGE: { path: 'retrieval.recallAt5', direction: 'HIGHER_IS_BETTER' },
};

export interface LeaderboardEntry {
  runId: string;
  modelId: string | null;
  modelName: string | null;
  promptVersionId: string | null;
  rerankerName: string | null;
  metricValue: number | null;
  startedAt: Date;
}

export interface CategoryLeaderboard {
  category: BenchmarkCategory;
  metricPath: string;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  entries: LeaderboardEntry[];
}

function getByPath(obj: unknown, path: string): number | null {
  const value = path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);
  return typeof value === 'number' ? value : null;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns a ranked list for exactly one category — the caller must
  // never merge results from two calls into one combined ranking.
  async getCategoryLeaderboard(category: BenchmarkCategory, limit = 20): Promise<CategoryLeaderboard> {
    const { path, direction } = PRIMARY_METRIC_PATH[category];
    const runs = await this.prisma.benchmarkRun.findMany({
      where: { benchmark: { category }, status: 'COMPLETED' },
      include: { model: true },
      orderBy: { startedAt: 'desc' },
      take: limit * 5, // over-fetch so ranking can be recomputed on the real metric rather than trusting DB row order
    });

    const entries: LeaderboardEntry[] = runs
      .map((r) => ({
        runId: r.id,
        modelId: r.modelId,
        modelName: r.model?.name ?? null,
        promptVersionId: r.promptVersionId,
        rerankerName: r.rerankerName,
        metricValue: getByPath(r.metrics, path),
        startedAt: r.startedAt,
      }))
      .filter((e) => e.metricValue !== null)
      .sort((a, b) => (direction === 'HIGHER_IS_BETTER' ? (b.metricValue as number) - (a.metricValue as number) : (a.metricValue as number) - (b.metricValue as number)))
      .slice(0, limit);

    return { category, metricPath: path, direction, entries };
  }

  // Every category, each independently ranked — this is the ONLY place a
  // "full leaderboard" concept exists, and it is structurally an array of
  // independent per-category leaderboards, never a merged table.
  async getFullLeaderboard(limit = 20): Promise<CategoryLeaderboard[]> {
    const categories = Object.keys(PRIMARY_METRIC_PATH) as BenchmarkCategory[];
    return Promise.all(categories.map((c) => this.getCategoryLeaderboard(c, limit)));
  }
}
