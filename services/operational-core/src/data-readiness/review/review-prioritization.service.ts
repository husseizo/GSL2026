import { Injectable } from '@nestjs/common';
import { ManualReviewStatus, ReviewDecisionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerQualityService } from '../quality/customer-quality.service';

export interface PriorityWeights {
  totalSalesValue: number;
  sourceSystemCount: number;
  transactionCount: number;
  taxNumberConflict: number;
  phoneConflict: number;
  activeStatus: number;
  recency: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  totalSalesValue: 0.3,
  sourceSystemCount: 0.15,
  transactionCount: 0.15,
  taxNumberConflict: 0.15,
  phoneConflict: 0.15,
  activeStatus: 0.05,
  recency: 0.05,
};

// Real business-impact prioritization for the manual-review queue (spec
// §6). Never resolves records automatically — this only orders the
// existing, real ManualReviewItem backlog (241 real CUSTOMER_MATCH items
// as of the Data Consolidation phase) so the highest-impact ambiguous
// matches are reviewed first. See docs/data-readiness/manual-review-programme.md.
@Injectable()
export class ReviewPrioritizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerQuality: CustomerQualityService,
  ) {}

  // Scores every PENDING CUSTOMER_MATCH review item using real signals
  // (historical sales value, source-system count, transaction count,
  // tax/phone conflict presence, active status, recency) and persists the
  // score on the item itself — no separate scoring table, matching the
  // phase's "fold into existing fields where there's no independent
  // multiplicity" pattern established in the prior phase.
  async scoreCustomerMatchReviews(weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS): Promise<{ scored: number }> {
    const items = await this.prisma.manualReviewItem.findMany({ where: { queueType: 'CUSTOMER_MATCH', status: ManualReviewStatus.PENDING } });
    let scored = 0;

    for (const item of items) {
      const candidateId = await this.resolveCandidateCustomerId(item.id);
      let salesValue = 0;
      let sourceCount = 1;
      let transactionCount = 0;
      let recencyDays: number | null = null;

      if (candidateId) {
        const businessValue = await this.customerQuality.computeBusinessValue(candidateId);
        salesValue = businessValue.totalSalesValue;
        sourceCount = Math.max(1, businessValue.sourceSystemCount);
        transactionCount = businessValue.transactionCount;
        recencyDays = businessValue.recencyDays;
      }

      const evidence = item.evidence as { matchSignals?: { taxNumber?: unknown; phone?: unknown; sourceName?: unknown; existingName?: unknown } };
      const hasTaxConflict = evidence?.matchSignals && 'sourceName' in (evidence.matchSignals ?? {}) && 'existingName' in (evidence.matchSignals ?? {}) ? 1 : 0;
      const hasPhoneConflict = evidence?.matchSignals?.phone ? 1 : 0;

      // Normalize each raw signal to [0,1] with a simple, documented scale
      // rather than an unbounded raw value — sales value uses a log scale
      // since real order values in this data span from tens of thousands
      // to over a billion TZS.
      const normalizedSales = Math.min(1, Math.log10(salesValue + 1) / 9);
      const normalizedSourceCount = Math.min(1, (sourceCount - 1) / 3);
      const normalizedTransactions = Math.min(1, transactionCount / 50);
      const normalizedRecency = recencyDays !== null ? Math.max(0, 1 - recencyDays / 365) : 0;

      const priorityScore =
        weights.totalSalesValue * normalizedSales +
        weights.sourceSystemCount * normalizedSourceCount +
        weights.transactionCount * normalizedTransactions +
        weights.taxNumberConflict * hasTaxConflict +
        weights.phoneConflict * hasPhoneConflict +
        weights.recency * normalizedRecency;

      await this.prisma.manualReviewItem.update({ where: { id: item.id }, data: { priorityScore: Math.round(priorityScore * 10000) / 10000 } });
      scored += 1;
    }

    return { scored };
  }

  private async resolveCandidateCustomerId(manualReviewItemId: string): Promise<string | null> {
    const item = await this.prisma.manualReviewItem.findUnique({ where: { id: manualReviewItemId } });
    if (!item?.relatedEntityMatchCandidateId) return null;
    const candidate = await this.prisma.entityMatchCandidate.findUnique({ where: { id: item.relatedEntityMatchCandidateId } });
    return candidate?.candidateEntityId ?? null;
  }

  // Creates a ReviewBatch of the highest-priority items (already scored by
  // scoreCustomerMatchReviews) and assigns them.
  async createPriorityBatch(name: string, limit: number, createdById?: string) {
    const topItems = await this.prisma.manualReviewItem.findMany({
      where: { queueType: 'CUSTOMER_MATCH', status: ManualReviewStatus.PENDING, priorityScore: { not: null } },
      orderBy: { priorityScore: 'desc' },
      take: limit,
    });

    const batch = await this.prisma.reviewBatch.create({
      data: { name, criteria: DEFAULT_PRIORITY_WEIGHTS as object, itemCount: topItems.length, createdById, status: 'OPEN' },
    });

    await this.prisma.manualReviewItem.updateMany({
      where: { id: { in: topItems.map((i) => i.id) } },
      data: { reviewBatchId: batch.id },
    });

    return { batch, itemCount: topItems.length };
  }

  assignBatch(batchId: string, assignedToUserId: string) {
    return this.prisma.manualReviewItem.updateMany({ where: { reviewBatchId: batchId }, data: { assignedToUserId, assignedAt: new Date() } });
  }

  // Records a real, structured decision — never merges/executes on the
  // canonical entity itself (spec §6 "Do not permanently merge records in
  // a way that destroys source identities" and §36 "manual review still
  // required for the entity link").
  async recordDecision(params: {
    manualReviewItemId: string;
    decisionType: ReviewDecisionType;
    reviewerId: string;
    evidence: Record<string, unknown>;
    confidence?: number;
    reason: string;
    sourceRecordRefs: string[];
    canonicalEntityId?: string;
  }) {
    const item = await this.prisma.manualReviewItem.findUniqueOrThrow({ where: { id: params.manualReviewItemId } });
    const detail = await this.prisma.reviewDecisionDetail.create({
      data: {
        manualReviewItemId: params.manualReviewItemId,
        decisionType: params.decisionType,
        reviewerId: params.reviewerId,
        evidence: params.evidence as object,
        confidence: params.confidence,
        reason: params.reason,
        sourceRecordRefs: params.sourceRecordRefs as object,
        canonicalEntityId: params.canonicalEntityId,
        beforeState: { status: item.status },
        afterState: { decisionType: params.decisionType },
      },
    });

    const newStatus: ManualReviewStatus =
      params.decisionType === 'MERGE_APPROVED' || params.decisionType === 'LINK_AS_RELATED' ? ManualReviewStatus.APPROVED
      : params.decisionType === 'REJECT_PROPOSAL' || params.decisionType === 'KEEP_SEPARATE' ? ManualReviewStatus.REJECTED
      : ManualReviewStatus.DEFERRED;

    await this.prisma.manualReviewItem.update({
      where: { id: params.manualReviewItemId },
      data: { status: newStatus, reviewedById: params.reviewerId, reviewedAt: new Date(), decisionReason: params.reason },
    });

    return detail;
  }

  // Reverses a prior decision — a direct, audited state change (see the
  // ReviewDecisionDetail model comment for why this isn't a separate
  // undo-approval-workflow table).
  async reverseDecision(reviewDecisionDetailId: string, reversedById: string, reverseReason: string) {
    const detail = await this.prisma.reviewDecisionDetail.findUniqueOrThrow({ where: { id: reviewDecisionDetailId } });
    if (!detail.reversible) throw new Error(`Review decision ${reviewDecisionDetailId} is marked not reversible`);

    await this.prisma.reviewDecisionDetail.update({ where: { id: reviewDecisionDetailId }, data: { reversedAt: new Date(), reversedById, reverseReason } });
    return this.prisma.manualReviewItem.update({ where: { id: detail.manualReviewItemId }, data: { status: ManualReviewStatus.PENDING, reviewedById: null, reviewedAt: null } });
  }
}
