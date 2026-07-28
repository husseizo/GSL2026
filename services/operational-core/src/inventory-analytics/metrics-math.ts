import { MovementClass, XyzClass, AbcClass } from '@prisma/client';
import { ClassificationConfig } from './classification.config';

// Pure, DB-free calculation functions — unit-tested directly (see
// metrics-math.spec.ts) and orchestrated by InventoryAnalyticsService, which
// owns all the Prisma querying. Keeping this pure is what makes "reorder
// point calculation", "ABC classification" etc. testable without a database.

export interface DemandStats {
  avgDailyDemand: number;
  stdDev: number;
  coefficientOfVariation: number | null; // null when mean demand is 0 (undefined ratio)
}

// `dailyQuantities` must be one entry per day in the window (0 for no-sale
// days) — that's what makes the mean/stddev reflect intermittent demand
// correctly rather than only averaging over days that had a sale.
export function computeDemandStats(dailyQuantities: number[]): DemandStats {
  const n = dailyQuantities.length;
  if (n === 0) return { avgDailyDemand: 0, stdDev: 0, coefficientOfVariation: null };

  const mean = dailyQuantities.reduce((sum, q) => sum + q, 0) / n;
  const variance = dailyQuantities.reduce((sum, q) => sum + (q - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    avgDailyDemand: mean,
    stdDev,
    coefficientOfVariation: mean === 0 ? null : stdDev / mean,
  };
}

export function classifyXyz(coefficientOfVariation: number | null, config: ClassificationConfig): XyzClass | null {
  if (coefficientOfVariation === null) return null;
  if (coefficientOfVariation <= config.xyzCoefficientOfVariation.x) return XyzClass.X;
  if (coefficientOfVariation <= config.xyzCoefficientOfVariation.y) return XyzClass.Y;
  return XyzClass.Z;
}

export interface MovementClassInputs {
  historyDays: number;
  salesLast30d: number;
  salesLast90d: number;
  noMovementDays: number | null; // null if never had any movement
  config: ClassificationConfig;
}

export function classifyMovement(inputs: MovementClassInputs): MovementClass {
  const { historyDays, salesLast30d, salesLast90d, noMovementDays, config } = inputs;

  if (historyDays < config.minHistoryDaysForClassification) {
    return historyDays <= config.movement.newItemMaxAgeDays ? MovementClass.NEW_ITEM : MovementClass.INSUFFICIENT_HISTORY;
  }
  if (noMovementDays !== null && noMovementDays >= config.movement.deadStockDays) {
    return MovementClass.DEAD_STOCK;
  }
  if (noMovementDays !== null && noMovementDays >= config.movement.nonMovingDays) {
    return MovementClass.NON_MOVING;
  }
  if (salesLast30d >= config.movement.fastMovingMinSalesPer30d) {
    return MovementClass.FAST_MOVING;
  }
  if (salesLast90d <= config.movement.slowMovingMaxSalesPer90d) {
    return MovementClass.SLOW_MOVING;
  }
  return MovementClass.MEDIUM_MOVING;
}

export interface AbcInput {
  key: string;
  consumptionValue: number;
}

// Classic ABC: rank by consumption value descending, classify by cumulative
// share of the total. Ties broken by input order (stable sort).
export function classifyAbc(items: AbcInput[], config: ClassificationConfig): Map<string, AbcClass> {
  const result = new Map<string, AbcClass>();
  const totalValue = items.reduce((sum, i) => sum + i.consumptionValue, 0);
  if (totalValue <= 0) {
    for (const item of items) result.set(item.key, AbcClass.C);
    return result;
  }

  const sorted = [...items].sort((a, b) => b.consumptionValue - a.consumptionValue);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.consumptionValue;
    const cumulativePct = (cumulative / totalValue) * 100;
    if (cumulativePct <= config.abcCumulativePct.a) {
      result.set(item.key, AbcClass.A);
    } else if (cumulativePct <= config.abcCumulativePct.b) {
      result.set(item.key, AbcClass.B);
    } else {
      result.set(item.key, AbcClass.C);
    }
  }
  return result;
}
