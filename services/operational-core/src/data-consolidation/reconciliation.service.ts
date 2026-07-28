import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ReconciliationCounts {
  sourceCount: number;
  extractedCount: number;
  stagedCount: number;
  validCount: number;
  importedCount: number;
  updatedCount: number;
  duplicateCount: number;
  deadLetterCount: number;
  manualReviewCount: number;
  skippedCount: number;
  targetCount: number;
}

export interface FinancialReconciliation {
  sourceSubtotal?: Prisma.Decimal | number;
  sourceTax?: Prisma.Decimal | number;
  sourceDiscount?: Prisma.Decimal | number;
  sourceTotal?: Prisma.Decimal | number;
  targetSubtotal?: Prisma.Decimal | number;
  targetTax?: Prisma.Decimal | number;
  targetDiscount?: Prisma.Decimal | number;
  targetTotal?: Prisma.Decimal | number;
}

// Real per-batch reconciliation — "can counts and monetary totals be
// reconciled with the source." Currency math uses Prisma's Decimal type
// throughout (never Number/Float) per the phase's explicit rule; the
// financialDifference is itself computed via Decimal subtraction, not
// floating point. See docs/data-consolidation/sales-reconciliation.md.
@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcile(batchId: string, entityType: string, counts: ReconciliationCounts, financial?: FinancialReconciliation) {
    const variance = counts.sourceCount - counts.targetCount;

    const sourceTotal = financial?.sourceTotal !== undefined ? new Prisma.Decimal(financial.sourceTotal) : null;
    const targetTotal = financial?.targetTotal !== undefined ? new Prisma.Decimal(financial.targetTotal) : null;
    const financialDifference = sourceTotal !== null && targetTotal !== null ? sourceTotal.minus(targetTotal) : null;

    return this.prisma.reconciliationReport.create({
      data: {
        batchId,
        entityType,
        ...counts,
        variance,
        varianceReason: variance !== 0 ? 'See manual-review and dead-letter counts for this batch' : null,
        sourceSubtotal: financial?.sourceSubtotal !== undefined ? new Prisma.Decimal(financial.sourceSubtotal) : undefined,
        sourceTax: financial?.sourceTax !== undefined ? new Prisma.Decimal(financial.sourceTax) : undefined,
        sourceDiscount: financial?.sourceDiscount !== undefined ? new Prisma.Decimal(financial.sourceDiscount) : undefined,
        sourceTotal: sourceTotal ?? undefined,
        targetSubtotal: financial?.targetSubtotal !== undefined ? new Prisma.Decimal(financial.targetSubtotal) : undefined,
        targetTax: financial?.targetTax !== undefined ? new Prisma.Decimal(financial.targetTax) : undefined,
        targetDiscount: financial?.targetDiscount !== undefined ? new Prisma.Decimal(financial.targetDiscount) : undefined,
        targetTotal: targetTotal ?? undefined,
        financialDifference: financialDifference ?? undefined,
      },
    });
  }

  listForBatch(batchId: string) {
    return this.prisma.reconciliationReport.findMany({ where: { batchId } });
  }
}
