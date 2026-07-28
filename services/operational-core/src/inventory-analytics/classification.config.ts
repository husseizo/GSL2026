// Every threshold the classification logic uses lives here, not inline in
// InventoryAnalyticsService — see docs/architecture/phase-2-commercial-foundation.md §6
// ("must be configuration-based, not hardcoded inside business services").
export interface ClassificationConfig {
  abcCumulativePct: { a: number; b: number }; // e.g. top 80% -> A, next 15% (to 95%) -> B, remainder -> C
  xyzCoefficientOfVariation: { x: number; y: number }; // CV <= x -> X, <= y -> Y, else Z
  movement: {
    fastMovingMinSalesPer30d: number;
    slowMovingMaxSalesPer90d: number;
    nonMovingDays: number;
    deadStockDays: number;
    newItemMaxAgeDays: number;
  };
  minHistoryDaysForClassification: number;
  demandLookbackDays: number;
}

export const DEFAULT_CLASSIFICATION_CONFIG: ClassificationConfig = {
  abcCumulativePct: { a: 80, b: 95 },
  xyzCoefficientOfVariation: { x: 0.5, y: 1.0 },
  movement: {
    fastMovingMinSalesPer30d: 4,
    slowMovingMaxSalesPer90d: 2,
    nonMovingDays: 90,
    deadStockDays: 180,
    // Deliberately less than minHistoryDaysForClassification below, so there's
    // a real band (newItemMaxAgeDays < historyDays < minHistoryDays) that
    // classifies as INSUFFICIENT_HISTORY rather than NEW_ITEM.
    newItemMaxAgeDays: 14,
  },
  minHistoryDaysForClassification: 30,
  demandLookbackDays: 90,
};

export const CLASSIFICATION_CONFIG = 'CLASSIFICATION_CONFIG';
