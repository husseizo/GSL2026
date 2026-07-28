import { Inject, Injectable } from '@nestjs/common';
import {
  AbcClass,
  AppEventType,
  InventoryMovementType,
  ItemType,
  MovementClass,
  PurchaseDocumentStatus,
  SalesDocumentType,
} from '@prisma/client';
import { computeWarehouseKey } from '../inventory/item-key';
import { PrismaService } from '../prisma/prisma.service';
import { CLASSIFICATION_CONFIG, ClassificationConfig, DEFAULT_CLASSIFICATION_CONFIG } from './classification.config';
import { classifyAbc, classifyMovement, classifyXyz, computeDemandStats } from './metrics-math';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMAND_MOVEMENT_TYPES: Set<InventoryMovementType> = new Set([
  InventoryMovementType.SALE_ISSUE,
  InventoryMovementType.GARAGE_ISSUE,
]);

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

interface ItemScope {
  itemKey: string;
  itemType: ItemType;
  partId: string | null;
  lubricantProductId: string | null;
}

// Recomputes InventoryItemMetric wholesale — this is a deterministic batch
// job, not something derived ad hoc per API request. See
// docs/architecture/phase-2-commercial-foundation.md §5–6 for the exact
// fields and the minimum-history / sparse-demand handling.
//
// Scale note: this loads all recent movements/sales/events into memory and
// aggregates in JS rather than pushing the aggregation into SQL. That's fine
// at Phase 2's sample-data scale; a real multi-warehouse, high-volume
// deployment would push this into warehouse-side SQL aggregation (Phase 4
// analytics warehouse) instead of the operational DB.
@Injectable()
export class InventoryAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLASSIFICATION_CONFIG) private readonly config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  ) {}

  async recalculate(now: Date = new Date()): Promise<{ itemsProcessed: number }> {
    const lookbackStart = new Date(now.getTime() - this.config.demandLookbackDays * DAY_MS);
    // Wide-enough window to find "first ever movement" for history/age without scanning the whole table indefinitely.
    const longHistoryStart = new Date(now.getTime() - 730 * DAY_MS);

    const [balances, movements, lostSales, searchEvents, openPurchaseLines, salesLineDocTypes] = await Promise.all([
      this.prisma.inventoryBalance.findMany(),
      this.prisma.inventoryMovement.findMany({ where: { occurredAt: { gte: longHistoryStart } } }),
      this.prisma.lostSaleCandidate.findMany({ where: { status: { in: ['OPEN', 'CONFIRMED'] } } }),
      this.prisma.appEvent.findMany({
        where: { eventType: { in: [AppEventType.SEARCH, AppEventType.OUT_OF_STOCK_VIEW] }, occurredAt: { gte: lookbackStart } },
      }),
      this.prisma.purchaseDocumentLine.findMany({
        where: { purchaseDocument: { status: { notIn: [PurchaseDocumentStatus.RECEIVED, PurchaseDocumentStatus.CLOSED, PurchaseDocumentStatus.CANCELLED] } } },
        include: { purchaseDocument: true },
      }),
      this.prisma.salesDocumentLine.findMany({
        where: { createdAt: { gte: lookbackStart } },
        include: { salesDocument: true },
      }),
    ]);

    const salesLineTypeById = new Map(salesLineTypeEntries(salesLineDocTypes));

    const itemScopes = new Map<string, ItemScope>();
    for (const balance of balances) {
      if (!itemScopes.has(balance.itemKey)) {
        itemScopes.set(balance.itemKey, {
          itemKey: balance.itemKey,
          itemType: balance.itemType,
          partId: balance.partId,
          lubricantProductId: balance.lubricantProductId,
        });
      }
    }

    type ScopeFields = ReturnType<InventoryAnalyticsService['computeFieldsForScope']>;

    const abcInputs: { key: string; consumptionValue: number }[] = [];
    const perItemRows: Array<{ scope: ItemScope; warehouseId: string | null; fields: ScopeFields }> = [];

    for (const scope of itemScopes.values()) {
      const itemBalances = balances.filter((b) => b.itemKey === scope.itemKey);
      const itemMovements = movements.filter((m) => matchesScope(m, scope));

      // Org-wide rollup (warehouseId = null)
      const orgFields = this.computeFieldsForScope({
        now,
        movements: itemMovements,
        availableStock: itemBalances.reduce((sum, b) => sum + toNum(b.onHand) - toNum(b.reserved) - toNum(b.damaged) - toNum(b.quarantined), 0),
        lostSales: lostSales.filter((l) => matchesScope(l, scope)),
        searchEvents: searchEvents.filter((e) => matchesScope(e, scope)),
        openPurchaseLines: openPurchaseLines.filter((l) => matchesScope(l, scope)),
        salesLineTypeById,
      });
      perItemRows.push({ scope, warehouseId: null, fields: orgFields });
      abcInputs.push({ key: scope.itemKey, consumptionValue: orgFields.qtySold90d as number * (orgFields.avgUnitValue as number) });

      for (const balance of itemBalances) {
        const whMovements = itemMovements.filter((m) => m.warehouseId === balance.warehouseId);
        const fields = this.computeFieldsForScope({
          now,
          movements: whMovements,
          availableStock: toNum(balance.onHand) - toNum(balance.reserved) - toNum(balance.damaged) - toNum(balance.quarantined),
          lostSales: lostSales.filter((l) => matchesScope(l, scope) && l.warehouseId === balance.warehouseId),
          searchEvents: searchEvents.filter((e) => matchesScope(e, scope)),
          openPurchaseLines: openPurchaseLines.filter((l) => matchesScope(l, scope) && l.purchaseDocument.warehouseId === balance.warehouseId),
          salesLineTypeById,
        });
        perItemRows.push({ scope, warehouseId: balance.warehouseId, fields });
      }
    }

    const abcByItemKey = classifyAbc(abcInputs, this.config);

    for (const row of perItemRows) {
      const abcClass = abcByItemKey.get(row.scope.itemKey) ?? null;
      const itemKey = row.scope.itemKey;
      const warehouseKey = computeWarehouseKey(row.warehouseId);

      await this.prisma.inventoryItemMetric.upsert({
        where: { itemKey_warehouseKey: { itemKey, warehouseKey } },
        create: {
          itemType: row.scope.itemType,
          partId: row.scope.partId,
          lubricantProductId: row.scope.lubricantProductId,
          warehouseId: row.warehouseId,
          itemKey,
          warehouseKey,
          abcClass,
          ...stripNonColumnFields(row.fields),
        },
        update: { abcClass, ...stripNonColumnFields(row.fields) },
      });
    }

    return { itemsProcessed: itemScopes.size };
  }

  private computeFieldsForScope(params: {
    now: Date;
    movements: { occurredAt: Date; quantity: unknown; movementType: InventoryMovementType; referenceId: string | null }[];
    availableStock: number;
    lostSales: { requestedQuantity: unknown }[];
    searchEvents: { eventType: AppEventType }[];
    openPurchaseLines: { orderedQuantity: unknown; receivedQuantity: unknown }[];
    salesLineTypeById: Map<string, { documentType: SalesDocumentType; unitPrice: number; costAtSale: number | null }>;
  }) {
    const { now, movements, availableStock, lostSales, searchEvents, openPurchaseLines, salesLineTypeById } = params;

    const demandMovements = movements.filter((m) => DEMAND_MOVEMENT_TYPES.has(m.movementType));
    const qtySoldWindow = (days: number) => {
      const cutoff = new Date(now.getTime() - days * DAY_MS);
      return demandMovements.filter((m) => m.occurredAt >= cutoff).reduce((sum, m) => sum + toNum(m.quantity), 0);
    };

    const qtySold7d = qtySoldWindow(7);
    const qtySold30d = qtySoldWindow(30);
    const qtySold60d = qtySoldWindow(60);
    const qtySold90d = qtySoldWindow(90);

    const lookbackDays = this.config.demandLookbackDays;
    const dailyQuantities = new Array(lookbackDays).fill(0);
    for (const m of demandMovements) {
      const dayIndex = Math.floor((now.getTime() - m.occurredAt.getTime()) / DAY_MS);
      if (dayIndex >= 0 && dayIndex < lookbackDays) {
        dailyQuantities[dayIndex] += toNum(m.quantity);
      }
    }
    const stats = computeDemandStats(dailyQuantities);

    const salesTransactionCount90d = demandMovements.filter((m) => m.occurredAt >= new Date(now.getTime() - 90 * DAY_MS)).length;
    const lastSaleAt = demandMovements.length > 0 ? new Date(Math.max(...demandMovements.map((m) => m.occurredAt.getTime()))) : null;
    const daysSinceLastSale = lastSaleAt ? daysBetween(now, lastSaleAt) : null;

    const anyMovement = movements.length > 0 ? new Date(Math.max(...movements.map((m) => m.occurredAt.getTime()))) : null;
    const noMovementDays = anyMovement ? daysBetween(now, anyMovement) : null;

    const firstMovement = movements.length > 0 ? new Date(Math.min(...movements.map((m) => m.occurredAt.getTime()))) : null;
    const historyDays = firstMovement ? daysBetween(now, firstMovement) : 0;
    const hasSufficientHistory = historyDays >= this.config.minHistoryDaysForClassification;

    const garageQty = movements
      .filter((m) => m.movementType === InventoryMovementType.GARAGE_ISSUE)
      .reduce((sum, m) => sum + toNum(m.quantity), 0);

    let retailQty = 0;
    let wholesaleQty = 0;
    let marginSum = 0;
    let marginCount = 0;
    let valueSum = 0;
    let valueCount = 0;
    for (const m of demandMovements) {
      if (!m.referenceId) continue;
      const line = salesLineTypeById.get(m.referenceId);
      if (!line) continue;
      const qty = toNum(m.quantity);
      if (line.documentType === SalesDocumentType.COUNTER_SALE) retailQty += qty;
      else wholesaleQty += qty;
      valueSum += line.unitPrice * qty;
      valueCount += qty;
      if (line.costAtSale !== null && line.unitPrice > 0) {
        marginSum += (line.unitPrice - line.costAtSale) / line.unitPrice;
        marginCount += 1;
      }
    }

    const lostSaleCount = lostSales.length;
    const lostSaleQuantity = lostSales.reduce((sum, l) => sum + toNum(l.requestedQuantity ?? 0), 0);
    const searchCount = searchEvents.filter((e) => e.eventType === AppEventType.SEARCH).length;
    const outOfStockSearchCount = searchEvents.filter((e) => e.eventType === AppEventType.OUT_OF_STOCK_VIEW).length;
    const openPurchaseQuantity = openPurchaseLines.reduce((sum, l) => sum + (toNum(l.orderedQuantity) - toNum(l.receivedQuantity)), 0);

    const daysOfSupply = stats.avgDailyDemand > 0 ? availableStock / stats.avgDailyDemand : null;
    const stockOutRisk = daysOfSupply === null ? null : daysOfSupply < 7 ? 'HIGH' : daysOfSupply < 21 ? 'MEDIUM' : 'LOW';

    const movementClass = classifyMovement({
      historyDays,
      salesLast30d: qtySold30d,
      salesLast90d: qtySold90d,
      noMovementDays,
      config: this.config,
    });
    const xyzClass = classifyXyz(stats.coefficientOfVariation, this.config);

    return {
      qtySold7d,
      qtySold30d,
      qtySold60d,
      qtySold90d,
      avgDailyDemand: stats.avgDailyDemand,
      avgWeeklyDemand: stats.avgDailyDemand * 7,
      demandStdDev: stats.stdDev,
      coefficientOfVariation: stats.coefficientOfVariation,
      salesFrequencyDays: salesTransactionCount90d > 0 ? 90 / salesTransactionCount90d : null,
      daysSinceLastSale,
      salesTransactionCount: salesTransactionCount90d,
      garageQty,
      retailQty,
      wholesaleQty,
      availableStock,
      daysOfSupply,
      stockOutRisk,
      noMovementDays,
      stockAgeDays: historyDays,
      grossMarginPct: marginCount > 0 ? (marginSum / marginCount) * 100 : null,
      lostSaleCount,
      lostSaleQuantity,
      searchCount,
      outOfStockSearchCount,
      incomingQuantity: openPurchaseQuantity,
      openPurchaseQuantity,
      historyDays,
      hasSufficientHistory,
      xyzClass,
      movementClass,
      // internal-only, stripped before writing to Prisma:
      avgUnitValue: valueCount > 0 ? valueSum / valueCount : 0,
    };
  }

  getMetrics(filter: { partId?: string; lubricantProductId?: string; warehouseId?: string | null }) {
    return this.prisma.inventoryItemMetric.findMany({
      where: {
        partId: filter.partId,
        lubricantProductId: filter.lubricantProductId,
        warehouseId: filter.warehouseId === undefined ? undefined : filter.warehouseId,
      },
    });
  }

  getClassification(filter: { movementClass?: MovementClass; abcClass?: AbcClass }) {
    return this.prisma.inventoryItemMetric.findMany({
      where: {
        movementClass: filter.movementClass,
        abcClass: filter.abcClass,
        warehouseId: null,
      },
    });
  }
}

function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}

function matchesScope(row: { partId?: string | null; lubricantProductId?: string | null }, scope: ItemScope): boolean {
  if (scope.partId) return row.partId === scope.partId;
  if (scope.lubricantProductId) return row.lubricantProductId === scope.lubricantProductId;
  return false;
}

function salesLineTypeEntries(
  lines: Array<{ id: string; unitPrice: unknown; costAtSale: unknown; salesDocument: { documentType: SalesDocumentType } }>,
): [string, { documentType: SalesDocumentType; unitPrice: number; costAtSale: number | null }][] {
  return lines.map((line) => [
    line.id,
    {
      documentType: line.salesDocument.documentType,
      unitPrice: toNum(line.unitPrice),
      costAtSale: line.costAtSale === null ? null : toNum(line.costAtSale),
    },
  ]);
}

function stripNonColumnFields<T extends Record<string, unknown>>(fields: T): Omit<T, 'avgUnitValue'> {
  const { avgUnitValue: _avgUnitValue, ...rest } = fields;
  return rest;
}
