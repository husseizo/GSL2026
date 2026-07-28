// DGX Prototype 1.6 — Gold Dataset (spec §3).
//
// The Gold Dataset is not a separate storage mechanism — it's a Benchmark
// (or several, one per category) whose cases are the subset with zero real
// human-judgment ambiguity (status APPROVED from a mechanical generator,
// never REVIEW_REQUIRED) and which has been explicitly approved and frozen
// via BenchmarkRegistryService.freezeAsGold(). This service is the
// orchestration layer that builds one canonical gold-standard benchmark
// per category from the real case generators in ../categories/, enriches
// each with the additional fields spec §3 requires beyond a normal
// BenchmarkCase (expected citations/confidence/refusal/explanation,
// forbidden outputs, expected structured output), and freezes it.
import { Injectable } from '@nestjs/common';
import { BenchmarkCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BenchmarkCaseDraft } from '../categories/category-taxonomy';
import { BenchmarkRegistryService } from './benchmark-registry.service';

export interface GoldCaseEnrichment {
  expectedCitations: string[];
  expectedConfidence: string;
  expectedRefusal: boolean;
  expectedExplanation: string;
  forbiddenOutputs: string[];
  expectedStructuredOutput: Record<string, unknown>;
}

@Injectable()
export class GoldDatasetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: BenchmarkRegistryService,
  ) {}

  // Only cases with zero human-judgment ambiguity qualify — REVIEW_REQUIRED
  // cases are explicitly excluded, since a Gold Dataset case's expected
  // answer must never itself be a matter of pending human review.
  private enrichApprovedOnly(drafts: BenchmarkCaseDraft[]): (BenchmarkCaseDraft & { goldEnrichment: GoldCaseEnrichment })[] {
    return drafts
      .filter((d) => d.status === 'APPROVED')
      .map((d) => ({
        ...d,
        goldEnrichment: {
          expectedCitations: Array.isArray(d.expectedOutput.expectedEntityIds) ? (d.expectedOutput.expectedEntityIds as string[]) : [],
          expectedConfidence: d.expectedOutput.expectedNoAnswer ? 'INSUFFICIENT_EVIDENCE' : d.expectedOutput.expectedConflict ? 'CONFLICTING' : 'VERIFIED',
          expectedRefusal: Boolean(d.expectedOutput.expectedRefusal),
          expectedExplanation: `Derived from ${JSON.stringify(d.provenance ?? {})}`,
          forbiddenOutputs: ['invented identifier not present in real evidence', 'a diagnosis of a vehicle fault', 'an unverified equivalence claim'],
          expectedStructuredOutput: { directAnswer: 'string', matchingProducts: 'array', confidence: 'string', sources: 'array' },
        },
      }));
  }

  // Creates (or versions forward, if it already exists) one gold benchmark
  // per category and freezes it. Returns per-category counts so the
  // caller (verify script) can honestly report raw vs. gold-eligible
  // counts rather than conflating them.
  async buildAndFreezeGoldBenchmark(category: BenchmarkCategory, key: string, name: string, description: string, drafts: BenchmarkCaseDraft[], reviewerId?: string) {
    const enriched = this.enrichApprovedOnly(drafts);
    if (enriched.length === 0) {
      return { benchmark: null, casesFrozen: 0, reason: 'no APPROVED (zero-ambiguity) cases available for this category yet' };
    }

    let benchmark = await this.prisma.benchmark.findFirst({ where: { key }, orderBy: { version: 'desc' } });
    if (!benchmark) {
      benchmark = await this.registry.createBenchmark({ key, category, name, description, provenance: { source: 'gold-dataset-service', derivation: 'mechanically-derived zero-ambiguity cases only' } });
    } else if (benchmark.isGold && benchmark.approvalStatus === 'APPROVED') {
      benchmark = await this.registry.createNewVersion(key, {});
    }

    await this.registry.addCases(
      benchmark.id,
      enriched.map((e) => ({ ...e, expectedOutput: { ...e.expectedOutput, gold: e.goldEnrichment } })),
    );
    await this.registry.approve(benchmark.id, reviewerId);
    const frozen = await this.registry.freezeAsGold(benchmark.id);

    return { benchmark: frozen, casesFrozen: enriched.length, reason: null };
  }
}
