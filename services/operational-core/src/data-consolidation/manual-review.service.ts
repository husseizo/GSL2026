import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface EnqueueReviewParams {
  queueType: string;
  relatedRawSourceRecordId?: string;
  relatedEntityMatchCandidateId?: string;
  proposedAction: string;
  evidence: Record<string, unknown>;
  confidence?: number;
}

// The single generic manual-review queue (spec §27) — one workflow for
// every uncertain decision this phase produces, rather than one table/
// service per queue type. See docs/data-consolidation/manual-review.md.
@Injectable()
export class ManualReviewService {
  constructor(private readonly prisma: PrismaService) {}

  enqueue(params: EnqueueReviewParams) {
    return this.prisma.manualReviewItem.create({
      data: {
        queueType: params.queueType,
        relatedRawSourceRecordId: params.relatedRawSourceRecordId,
        relatedEntityMatchCandidateId: params.relatedEntityMatchCandidateId,
        proposedAction: params.proposedAction,
        evidence: params.evidence as object,
        confidence: params.confidence,
      },
    });
  }

  list(queueType?: string, status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED') {
    return this.prisma.manualReviewItem.findMany({ where: { queueType, status }, orderBy: { createdAt: 'asc' } });
  }

  async approve(id: string, reviewedById: string, decisionReason?: string) {
    const item = await this.prisma.manualReviewItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Manual review item ${id} not found`);
    return this.prisma.manualReviewItem.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById, reviewedAt: new Date(), decisionReason },
    });
  }

  async reject(id: string, reviewedById: string, decisionReason?: string) {
    const item = await this.prisma.manualReviewItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Manual review item ${id} not found`);
    return this.prisma.manualReviewItem.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById, reviewedAt: new Date(), decisionReason },
    });
  }
}
