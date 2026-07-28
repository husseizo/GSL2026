import { Injectable, Optional } from '@nestjs/common';
import { RecommendationStatus } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { evaluateTransferCandidate } from './transfer-recommendation-math';

// Transfers are only ever considered before an external purchase for items
// that already have stock elsewhere in the organization — see
// docs/architecture/phase-2-commercial-foundation.md §8. Nothing here creates
// the transfer itself; TransfersService.approve()/receive() (inventory
// module) still requires an explicit human action.
const DEFAULT_TRANSFER_LEAD_TIME_DAYS = 3;
const RECOMMENDATION_TYPE = 'TRANSFER';
// TransferRecommendation has no real confidence field (unlike
// PurchaseRecommendation) — this is a real, structural difference, not an
// omission, so the shared recommendation-metrics method is given an honest
// 'N/A' rather than a fabricated confidence value.
const NO_CONFIDENCE_FIELD = 'N/A';

@Injectable()
export class TransferRecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async generate(): Promise<{ generated: number }> {
    const itemMetrics = await this.prisma.inventoryItemMetric.findMany({ where: { warehouseId: { not: null } } });
    const byItemKey = new Map<string, typeof itemMetrics>();
    for (const m of itemMetrics) {
      if (!byItemKey.has(m.itemKey)) byItemKey.set(m.itemKey, []);
      byItemKey.get(m.itemKey)!.push(m);
    }

    let generated = 0;

    for (const [itemKey, rows] of byItemKey) {
      if (rows.length < 2) continue; // nothing to transfer between if only one warehouse holds this item

      const profile = await this.prisma.itemPlanningProfile.findUnique({
        where: { itemKey },
        include: { defaultSupplier: true },
      });
      const safetyStock = Number(profile?.safetyStock ?? 0);
      const targetCoverageDays = profile?.targetCoverageDays ?? 30;
      const supplierLeadTimeDays = profile?.defaultSupplier?.defaultLeadTimeDays ?? null;

      // `availableStock` here is mutated as this loop allocates surplus from a
      // source to one destination at a time, so the same units are never
      // counted as available surplus twice in a single generate() run.
      const withDerived = rows.map((r) => {
        const avgDailyDemand = Number(r.avgDailyDemand);
        const effectiveLeadTime = supplierLeadTimeDays ?? 30;
        return {
          row: r,
          availableStock: Number(r.availableStock),
          reorderPoint: avgDailyDemand * effectiveLeadTime + safetyStock,
          targetStock: avgDailyDemand * targetCoverageDays + safetyStock,
          avgDailyDemand,
        };
      });

      const destinations = withDerived
        .filter((d) => d.availableStock <= d.reorderPoint)
        .sort((a, b) => a.availableStock - b.availableStock); // most urgent first

      for (const destination of destinations) {
        const sources = withDerived
          .filter((s) => s.row.warehouseId !== destination.row.warehouseId && s.availableStock - safetyStock > 0)
          .sort((a, b) => b.availableStock - a.availableStock); // largest surplus first

        for (const source of sources) {
          const candidate = evaluateTransferCandidate({
            sourceAvailable: source.availableStock,
            sourceSafetyStock: safetyStock,
            destAvailable: destination.availableStock,
            destReorderPoint: destination.reorderPoint,
            destTargetStock: destination.targetStock,
            destAvgDailyDemand: destination.avgDailyDemand,
            transferLeadTimeDays: DEFAULT_TRANSFER_LEAD_TIME_DAYS,
            supplierLeadTimeDays,
          });

          if (!candidate) continue;

          const existing = await this.prisma.transferRecommendation.findFirst({
            where: {
              partId: destination.row.partId,
              lubricantProductId: destination.row.lubricantProductId,
              sourceWarehouseId: source.row.warehouseId!,
              destinationWarehouseId: destination.row.warehouseId!,
              status: RecommendationStatus.PENDING,
            },
          });

          const data = {
            itemType: destination.row.itemType,
            partId: destination.row.partId,
            lubricantProductId: destination.row.lubricantProductId,
            sourceWarehouseId: source.row.warehouseId!,
            destinationWarehouseId: destination.row.warehouseId!,
            suggestedQuantity: candidate.suggestedQuantity,
            reason: candidate.reason,
            evidence: candidate as object,
            generatedAt: new Date(),
          };

          if (existing) {
            await this.prisma.transferRecommendation.update({ where: { id: existing.id }, data });
          } else {
            await this.prisma.transferRecommendation.create({ data });
          }
          this.metrics?.recordRecommendationExecution(RECOMMENDATION_TYPE, RECOMMENDATION_TYPE, NO_CONFIDENCE_FIELD);
          generated += 1;

          source.availableStock -= candidate.suggestedQuantity; // don't double-allocate the same surplus
          destination.availableStock += candidate.suggestedQuantity;
          break; // this destination's need is addressed by its best source
        }
      }
    }

    return { generated };
  }

  list(filter: { status?: RecommendationStatus }) {
    return this.prisma.transferRecommendation.findMany({
      where: filter,
      include: { part: true, lubricantProduct: true, sourceWarehouse: true, destinationWarehouse: true },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async approve(id: string, decidedById: string, decisionNote?: string) {
    const before = await this.prisma.transferRecommendation.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.transferRecommendation.update({
      where: { id },
      data: { status: RecommendationStatus.APPROVED, decidedById, decidedAt: new Date(), decisionNote },
    });
    await this.audit.log({
      action: 'TRANSFER_RECOMMENDATION_APPROVED',
      actorId: decidedById,
      entityType: 'TransferRecommendation',
      entityId: id,
      beforeState: before,
      afterState: updated,
    });
    this.metrics?.recordRecommendationApproval(RECOMMENDATION_TYPE);
    return updated;
  }

  async reject(id: string, decidedById: string, decisionNote?: string) {
    const before = await this.prisma.transferRecommendation.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.transferRecommendation.update({
      where: { id },
      data: { status: RecommendationStatus.REJECTED, decidedById, decidedAt: new Date(), decisionNote },
    });
    await this.audit.log({
      action: 'TRANSFER_RECOMMENDATION_REJECTED',
      actorId: decidedById,
      entityType: 'TransferRecommendation',
      entityId: id,
      beforeState: before,
      afterState: updated,
    });
    this.metrics?.recordRecommendationRejection(RECOMMENDATION_TYPE);
    return updated;
  }
}
