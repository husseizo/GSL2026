import { Inject, Injectable } from '@nestjs/common';
import { MatchCandidateStatus, MatchStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeOemNumber } from '../normalize';
import { SIMILARITY_SCORER } from './similarity-scorer.token';
import { SimilarityScorer } from './similarity-scorer';

export const DEFAULT_SIMILARITY_THRESHOLD = 0.6;

// Orders a pair of IDs deterministically so a candidate for (A, B) and one
// discovered later for (B, A) collide on the same unique row instead of
// creating a duplicate.
function canonicalPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

@Injectable()
export class PartMatcherService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SIMILARITY_SCORER) private readonly scorer: SimilarityScorer,
  ) {}

  // Stage 1: deterministic. Any two distinct parts that share a normalized
  // OEM/alternate number are near-certain duplicates or direct cross-references.
  async runRuleBasedMatching(): Promise<number> {
    const parts = await this.prisma.part.findMany({
      include: { alternateNumbers: true },
    });

    const numberToPartIds = new Map<string, Set<string>>();
    for (const part of parts) {
      const numbers = [part.oemNumber, ...part.alternateNumbers.map((n) => n.number)];
      for (const number of numbers) {
        const key = normalizeOemNumber(number);
        if (!numberToPartIds.has(key)) {
          numberToPartIds.set(key, new Set());
        }
        numberToPartIds.get(key)!.add(part.id);
      }
    }

    let created = 0;
    for (const [normalizedNumber, partIds] of numberToPartIds) {
      if (partIds.size < 2) continue;
      const ids = [...partIds];
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const [partAId, partBId] = canonicalPair(ids[i], ids[j]);
          await this.upsertCandidate({
            partAId,
            partBId,
            stage: MatchStage.RULE_BASED,
            score: 1,
            rationale: `Shared normalized part number "${normalizedNumber}"`,
          });
          created += 1;
        }
      }
    }
    return created;
  }

  // Stage 2: fuzzy. Only compares parts within the same category (bucketed) to
  // avoid an all-pairs scan, and skips pairs already resolved by stage 1.
  async runSimilarityMatching(threshold = DEFAULT_SIMILARITY_THRESHOLD): Promise<number> {
    const parts = await this.prisma.part.findMany();
    const byCategory = new Map<string, typeof parts>();
    for (const part of parts) {
      const key = part.category ?? '__uncategorized__';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(part);
    }

    let created = 0;
    for (const bucket of byCategory.values()) {
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          const partA = bucket[i];
          const partB = bucket[j];
          if (partA.id === partB.id) continue;

          const score = this.scorer.score(partA.standardizedProductName, partB.standardizedProductName);
          if (score < threshold) continue;

          const [partAId, partBId] = canonicalPair(partA.id, partB.id);
          const existingRuleMatch = await this.prisma.partMatchCandidate.findUnique({
            where: { partAId_partBId_stage: { partAId, partBId, stage: MatchStage.RULE_BASED } },
          });
          if (existingRuleMatch) continue;

          await this.upsertCandidate({
            partAId,
            partBId,
            stage: MatchStage.SIMILARITY,
            score,
            rationale: `Standardized name similarity ${score.toFixed(2)} (threshold ${threshold})`,
          });
          created += 1;
        }
      }
    }
    return created;
  }

  listCandidates(status?: MatchCandidateStatus) {
    return this.prisma.partMatchCandidate.findMany({
      where: status ? { status } : undefined,
      include: { partA: true, partB: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Approval only ever changes the candidate's status. Actually merging two
  // part master records (re-pointing compatibility/stock/sales references) is
  // a separate, explicit action reserved for a later phase once those
  // referencing tables exist — see docs/architecture/01-data-model.md §3.
  reviewCandidate(id: string, status: MatchCandidateStatus, reviewedById?: string) {
    return this.prisma.partMatchCandidate.update({
      where: { id },
      data: { status, reviewedById, reviewedAt: new Date() },
    });
  }

  private async upsertCandidate(data: {
    partAId: string;
    partBId: string;
    stage: MatchStage;
    score: number;
    rationale: string;
  }) {
    await this.prisma.partMatchCandidate.upsert({
      where: {
        partAId_partBId_stage: { partAId: data.partAId, partBId: data.partBId, stage: data.stage },
      },
      create: data,
      update: { score: data.score, rationale: data.rationale },
    });
  }
}
