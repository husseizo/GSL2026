import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  PurchaseRecommendationAction,
  RecommendationStatus,
  SalesDocumentStatus,
  SalesDocumentType,
} from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { AiPurchasingSignalsService } from './ai-purchasing-signals.service';
import { computePurchaseRecommendation, PurchaseRecommendationInputs } from './purchase-recommendation-math';

const OPEN_SALES_ORDER_STATUSES: SalesDocumentStatus[] = [SalesDocumentStatus.OPEN, SalesDocumentStatus.PARTIALLY_FULFILLED];
const RECOMMENDATION_TYPE = 'PURCHASE';

// Orchestrates DB reads and calls the pure computePurchaseRecommendation() —
// see purchase-recommendation-math.ts for the actual formulas/decision tree.
// This is where "Buy now / Buy soon / Monitor / ..." recommendations get
// generated; nothing here ever creates a real purchase order — see
// docs/architecture/purchase-recommendation-engine.md.
@Injectable()
export class PurchaseRecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly aiSignals: AiPurchasingSignalsService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async generate(): Promise<{ generated: number }> {
    const itemMetrics = await this.prisma.inventoryItemMetric.findMany({ where: { warehouseId: { not: null } } });
    let generated = 0;

    for (const metric of itemMetrics) {
      const profile = await this.prisma.itemPlanningProfile.findUnique({
        where: { itemKey: metric.itemKey },
        include: { defaultSupplier: true },
      });

      const confirmedDemand = await this.getConfirmedDemand(metric.partId, metric.lubricantProductId, metric.warehouseId);

      // Sprint 1 Safety Gate (ADR-0001; spec §14 rule 2) — real warehouse
      // capacity, fetched per-iteration to match this loop's existing
      // per-item-planning-profile lookup pattern. `metric.warehouseId` is
      // never null here (the outer query already filters for that).
      const warehouse = await this.prisma.warehouse.findUnique({ where: { id: metric.warehouseId! } });

      const inputs: PurchaseRecommendationInputs = {
        availableStock: Number(metric.availableStock),
        reservedStock: 0,
        incomingStock: Number(metric.incomingQuantity),
        inTransitStock: 0,
        avgDailyDemand: Number(metric.avgDailyDemand),
        coefficientOfVariation: metric.coefficientOfVariation === null ? null : Number(metric.coefficientOfVariation),
        supplierLeadTimeDays: profile?.defaultSupplier?.defaultLeadTimeDays ?? null,
        safetyStock: Number(profile?.safetyStock ?? 0),
        targetCoverageDays: profile?.targetCoverageDays ?? 30,
        maxCoverageDays: profile?.maxCoverageDays ?? 90,
        confirmedDemand,
        lostSalesQuantity: Number(metric.lostSaleQuantity),
        minimumOrderQuantity: profile?.minimumOrderQuantity ? Number(profile.minimumOrderQuantity) : null,
        packageQuantity: profile?.packageQuantity ? Number(profile.packageQuantity) : null,
        movementClass: metric.movementClass,
        hasSufficientHistory: metric.hasSufficientHistory,
        criticality: profile?.criticality ?? 'NORMAL',
        salesTransactionCount90d: metric.salesTransactionCount,
        stockOutRisk: metric.stockOutRisk as 'HIGH' | 'MEDIUM' | 'LOW' | null,
        // Sprint 1 Safety Gate (ADR-0001; spec §14 rule 5): only reject when
        // a real, known default supplier is explicitly inactive — an item
        // with no supplier linked at all is a pre-existing, unrelated
        // condition (already surfaced via the missing-lead-time warning)
        // and is deliberately not changed by this fix, to keep this Sprint's
        // scope to exactly the identified gap.
        supplierIsActive: profile?.defaultSupplier ? profile.defaultSupplier.isActive : true,
        warehouseCapacity: warehouse?.capacity === null || warehouse?.capacity === undefined ? null : Number(warehouse.capacity),
      };

      const result = computePurchaseRecommendation(inputs);

      // Additive only: these signals are attached to `evidence` for a human
      // reviewer to see. They never feed back into computePurchaseRecommendation
      // — the action/quantity above is already final by the time this runs.
      // See ai-purchasing-signals.service.ts.
      const aiSignals = await this.aiSignals.computeSignals({
        itemType: metric.itemType === 'LUBRICANT' ? 'LUBRICANT' : 'PART',
        partId: metric.partId,
        lubricantProductId: metric.lubricantProductId,
      });

      const existing = await this.prisma.purchaseRecommendation.findFirst({
        where: {
          partId: metric.partId,
          lubricantProductId: metric.lubricantProductId,
          warehouseId: metric.warehouseId,
          status: RecommendationStatus.PENDING,
        },
      });

      const data = {
        itemType: metric.itemType,
        partId: metric.partId,
        lubricantProductId: metric.lubricantProductId,
        warehouseId: metric.warehouseId,
        action: result.action,
        suggestedQuantity: result.suggestedQuantity,
        confidence: result.confidence,
        evidence: { ...result.evidence, aiSignals } as object,
        warnings: result.warnings,
        generatedAt: new Date(),
      };

      if (existing) {
        await this.prisma.purchaseRecommendation.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.purchaseRecommendation.create({ data });
      }
      this.metrics?.recordRecommendationExecution(RECOMMENDATION_TYPE, result.action, result.confidence);
      generated += 1;
    }

    return { generated };
  }

  private async getConfirmedDemand(partId: string | null, lubricantProductId: string | null, warehouseId: string | null) {
    const lines = await this.prisma.salesDocumentLine.findMany({
      where: {
        partId: partId ?? undefined,
        lubricantProductId: lubricantProductId ?? undefined,
        warehouseId: warehouseId ?? undefined,
        salesDocument: { documentType: SalesDocumentType.SALES_ORDER, status: { in: OPEN_SALES_ORDER_STATUSES } },
      },
    });
    return lines.reduce((sum, l) => sum + Number(l.quantity), 0);
  }

  list(filter: { action?: PurchaseRecommendationAction; status?: RecommendationStatus }) {
    return this.prisma.purchaseRecommendation.findMany({
      where: filter,
      include: { part: true, lubricantProduct: true, warehouse: true },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async getById(id: string) {
    const rec = await this.prisma.purchaseRecommendation.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException(`Purchase recommendation ${id} not found`);
    return rec;
  }

  async approve(id: string, decidedById: string, decisionNote?: string) {
    const rec = await this.getById(id);
    const updated = await this.prisma.purchaseRecommendation.update({
      where: { id },
      data: { status: RecommendationStatus.APPROVED, decidedById, decidedAt: new Date(), decisionNote },
    });
    await this.audit.log({
      action: 'PURCHASE_RECOMMENDATION_APPROVED',
      actorId: decidedById,
      entityType: 'PurchaseRecommendation',
      entityId: id,
      beforeState: rec,
      afterState: updated,
    });
    this.metrics?.recordRecommendationApproval(RECOMMENDATION_TYPE);
    return updated;
  }

  async reject(id: string, decidedById: string, decisionNote?: string) {
    const rec = await this.getById(id);
    const updated = await this.prisma.purchaseRecommendation.update({
      where: { id },
      data: { status: RecommendationStatus.REJECTED, decidedById, decidedAt: new Date(), decisionNote },
    });
    await this.audit.log({
      action: 'PURCHASE_RECOMMENDATION_REJECTED',
      actorId: decidedById,
      entityType: 'PurchaseRecommendation',
      entityId: id,
      beforeState: rec,
      afterState: updated,
    });
    this.metrics?.recordRecommendationRejection(RECOMMENDATION_TYPE);
    return updated;
  }

  markImplemented(id: string) {
    return this.prisma.purchaseRecommendation.update({
      where: { id },
      data: { status: RecommendationStatus.IMPLEMENTED },
    });
  }
}
