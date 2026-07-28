import { MovementClass, PurchaseRecommendationAction, RecommendationConfidence } from '@prisma/client';
import { roundToOperationalQuantity } from '../common/rounding';

export interface PurchaseRecommendationInputs {
  availableStock: number;
  reservedStock: number;
  incomingStock: number;
  inTransitStock: number;
  avgDailyDemand: number;
  coefficientOfVariation: number | null;
  supplierLeadTimeDays: number | null;
  safetyStock: number;
  targetCoverageDays: number;
  maxCoverageDays: number;
  confirmedDemand: number; // open sales-order quantity not yet fulfilled
  lostSalesQuantity: number;
  minimumOrderQuantity: number | null;
  packageQuantity: number | null;
  movementClass: MovementClass;
  hasSufficientHistory: boolean;
  criticality: 'CRITICAL' | 'IMPORTANT' | 'NORMAL' | 'LOW';
  salesTransactionCount90d: number;
  stockOutRisk: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  // AI Foundation Certification Sprint — Phase II Sprint 1 (Safety Gate
  // closure, see docs/adr/ADR-0001-warehouse-capacity.md and
  // DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md §14, rules 2 and 5).
  // `null` supplierIsActive-equivalent doesn't exist deliberately: a
  // recommendation always has exactly one default supplier candidate in
  // this codebase today, so "no supplier known" and "inactive supplier"
  // are both real, current reasons a purchase cannot be safely recommended
  // — both are handled by requiring this to be an explicit boolean, never
  // assumed true.
  supplierIsActive: boolean;
  // `null` = no real, known capacity limit for this warehouse — the
  // pre-existing behavior (no capacity check) is preserved until someone
  // sets a real value (see ADR-0001).
  warehouseCapacity: number | null;
}

export interface PurchaseRecommendationEvidence {
  availableStock: number;
  reservedStock: number;
  incomingStock: number;
  avgDailyDemand: number;
  reorderPoint: number;
  safetyStock: number;
  effectiveLeadTimeDays: number | null;
  confirmedDemand: number;
  lostSalesQuantity: number;
  targetStock: number;
  suggestedQuantityBeforeRounding: number;
  packageRoundingAdjustment: number;
  finalSuggestedQuantity: number;
  confidence: RecommendationConfidence;
  warnings: string[];
  // Sprint 1 additions — real, structured detection flags a human reviewer
  // (or an automated Safety Gate check) can read directly, rather than
  // having to parse the free-text warnings array.
  supplierRejected: boolean;
  warehouseCapacityExceeded: boolean;
}

export interface PurchaseRecommendationResult {
  action: PurchaseRecommendationAction;
  suggestedQuantity: number;
  confidence: RecommendationConfidence;
  evidence: PurchaseRecommendationEvidence;
  warnings: string[];
}

const DEFAULT_LEAD_TIME_DAYS = 30;
// A highly variable/intermittent item's real-world lead time risk is higher
// than the nominal supplier lead time — a simple, deterministic buffer
// (not a forecast) rather than inventing statistical lead-time modeling.
const HIGH_VARIABILITY_LEAD_TIME_BUFFER_PCT = 0.2;

export function computePurchaseRecommendation(inputs: PurchaseRecommendationInputs): PurchaseRecommendationResult {
  const warnings: string[] = [];

  if (!inputs.hasSufficientHistory) {
    return reviewDataResult(inputs, warnings.concat('Insufficient sales history to calculate demand reliably'));
  }

  // Sprint 1 Safety Gate (ADR-0001; spec §14 rule 5): a purchase must never
  // be recommended against a supplier that is not currently active/
  // available. This is checked before any quantity math runs at all — an
  // inactive supplier makes the whole recommendation unsafe, not just its
  // number.
  if (!inputs.supplierIsActive) {
    return reviewDataResult(
      inputs,
      warnings.concat('Default supplier is inactive or unavailable — a purchase cannot be safely recommended until an active supplier is confirmed'),
      { supplierRejected: true },
    );
  }

  const effectiveLeadTimeDays = inputs.supplierLeadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  if (inputs.supplierLeadTimeDays === null) {
    warnings.push(`No supplier lead time available — using default of ${DEFAULT_LEAD_TIME_DAYS} days`);
  }
  const isHighlyVariable = (inputs.coefficientOfVariation ?? 0) > 1;
  const bufferedLeadTimeDays = isHighlyVariable
    ? Math.round(effectiveLeadTimeDays * (1 + HIGH_VARIABILITY_LEAD_TIME_BUFFER_PCT))
    : effectiveLeadTimeDays;

  // --- The three formulas fixed by docs/architecture/purchase-recommendation-engine.md ---
  const reorderPoint = inputs.avgDailyDemand * bufferedLeadTimeDays + inputs.safetyStock;
  const targetStock = inputs.avgDailyDemand * inputs.targetCoverageDays + inputs.safetyStock;
  const rawSuggestedQuantity =
    targetStock + inputs.confirmedDemand - inputs.availableStock - inputs.incomingStock - inputs.inTransitStock;

  const maxQuantity = inputs.avgDailyDemand * inputs.maxCoverageDays;
  const cappedRawQuantity = Math.min(Math.max(rawSuggestedQuantity, 0), maxQuantity > 0 ? maxQuantity : rawSuggestedQuantity);
  if (rawSuggestedQuantity > maxQuantity && maxQuantity > 0) {
    warnings.push(`Suggested quantity capped at ${inputs.maxCoverageDays} days of coverage`);
  }

  const rounding = roundToOperationalQuantity(cappedRawQuantity, {
    minimumOrderQuantity: inputs.minimumOrderQuantity ?? undefined,
    packageQuantity: inputs.packageQuantity ?? undefined,
  });

  const evidence: PurchaseRecommendationEvidence = {
    availableStock: inputs.availableStock,
    reservedStock: inputs.reservedStock,
    incomingStock: inputs.incomingStock,
    avgDailyDemand: round4(inputs.avgDailyDemand),
    reorderPoint: round4(reorderPoint),
    safetyStock: inputs.safetyStock,
    effectiveLeadTimeDays: bufferedLeadTimeDays,
    confirmedDemand: inputs.confirmedDemand,
    lostSalesQuantity: inputs.lostSalesQuantity,
    targetStock: round4(targetStock),
    suggestedQuantityBeforeRounding: round4(rawSuggestedQuantity),
    packageRoundingAdjustment: rounding.packageRoundingAdjustment,
    finalSuggestedQuantity: rounding.finalQuantity,
    confidence: RecommendationConfidence.HIGH,
    warnings,
    supplierRejected: false,
    warehouseCapacityExceeded: false,
  };

  const action = decideAction(inputs, reorderPoint, targetStock, rounding.finalQuantity, warnings);
  const confidence = decideConfidence(inputs, warnings);
  evidence.confidence = confidence;

  // Sprint 1 Safety Gate (ADR-0001; spec §14 rule 2): a purchase must never
  // be recommended in a quantity that would push the warehouse's total
  // held stock (available + incoming + in-transit + this order) above its
  // real, known capacity. `null` capacity means no known real limit — the
  // existing, uncapped behavior is preserved for that warehouse.
  let cappedQuantity = rounding.finalQuantity;
  if (inputs.warehouseCapacity !== null) {
    const projectedTotal = inputs.availableStock + inputs.incomingStock + inputs.inTransitStock + cappedQuantity;
    if (projectedTotal > inputs.warehouseCapacity) {
      const capped = Math.max(
        0,
        Math.floor(inputs.warehouseCapacity - inputs.availableStock - inputs.incomingStock - inputs.inTransitStock),
      );
      warnings.push(`Suggested quantity capped from ${cappedQuantity} to ${capped} to respect warehouse capacity of ${inputs.warehouseCapacity}`);
      cappedQuantity = capped;
      evidence.warehouseCapacityExceeded = true;
    }
  }
  evidence.finalSuggestedQuantity = cappedQuantity;

  // A DO_NOT_BUY / MONITOR / CLEAR_EXISTING_STOCK verdict means "don't order
  // now" even if the raw math produced a positive quantity — never return a
  // false-precision quantity alongside an action that says not to buy.
  const suggestedQuantity = ['BUY_NOW', 'BUY_SOON', 'PURCHASE_ON_CONFIRMED_ORDER'].includes(action)
    ? cappedQuantity
    : 0;

  return { action, suggestedQuantity, confidence, evidence, warnings };
}

function decideAction(
  inputs: PurchaseRecommendationInputs,
  reorderPoint: number,
  targetStock: number,
  suggestedQuantity: number,
  warnings: string[],
): PurchaseRecommendationAction {
  // Dead stock: don't buy unless there's an actual confirmed order for it.
  if (inputs.movementClass === MovementClass.DEAD_STOCK) {
    if (inputs.confirmedDemand > 0) return PurchaseRecommendationAction.PURCHASE_ON_CONFIRMED_ORDER;
    return PurchaseRecommendationAction.DO_NOT_BUY;
  }

  const available = inputs.availableStock;

  // Rare, high-variability items with almost no transaction history but real
  // demand: buy against a confirmed order rather than forecasting a stock
  // level — but only when existing stock doesn't already cover target
  // coverage. Otherwise this would recommend PURCHASE_ON_CONFIRMED_ORDER at
  // a suggested quantity of 0, which reads as a contradiction.
  if (
    inputs.coefficientOfVariation !== null &&
    inputs.coefficientOfVariation > 1.5 &&
    inputs.salesTransactionCount90d <= 1 &&
    available <= targetStock
  ) {
    if (inputs.confirmedDemand > 0) return PurchaseRecommendationAction.PURCHASE_ON_CONFIRMED_ORDER;
    warnings.push('Demand is intermittent with no recurring pattern — recommend against confirmed order only');
    return PurchaseRecommendationAction.PURCHASE_ON_CONFIRMED_ORDER;
  }

  if (available > targetStock * 1.5 && inputs.confirmedDemand <= 0 && inputs.incomingStock <= 0) {
    return PurchaseRecommendationAction.CLEAR_EXISTING_STOCK;
  }

  if (available <= reorderPoint && suggestedQuantity > 0) {
    const urgent = inputs.criticality === 'CRITICAL' || inputs.stockOutRisk === 'HIGH' || inputs.lostSalesQuantity > 0;
    return urgent ? PurchaseRecommendationAction.BUY_NOW : PurchaseRecommendationAction.BUY_SOON;
  }

  if (available <= targetStock && inputs.criticality !== 'LOW') {
    return PurchaseRecommendationAction.MONITOR;
  }

  return PurchaseRecommendationAction.MONITOR;
}

function decideConfidence(inputs: PurchaseRecommendationInputs, warnings: string[]): RecommendationConfidence {
  if (!inputs.hasSufficientHistory) return RecommendationConfidence.INSUFFICIENT_DATA;
  if (inputs.supplierLeadTimeDays === null || inputs.coefficientOfVariation === null) return RecommendationConfidence.MEDIUM;
  if (warnings.length > 0) return RecommendationConfidence.MEDIUM;
  if (inputs.movementClass === MovementClass.FAST_MOVING || inputs.movementClass === MovementClass.MEDIUM_MOVING) {
    return RecommendationConfidence.HIGH;
  }
  return RecommendationConfidence.MEDIUM;
}

function reviewDataResult(
  inputs: PurchaseRecommendationInputs,
  warnings: string[],
  flags: { supplierRejected: boolean } = { supplierRejected: false },
): PurchaseRecommendationResult {
  return {
    action: PurchaseRecommendationAction.REVIEW_DATA,
    suggestedQuantity: 0,
    confidence: RecommendationConfidence.INSUFFICIENT_DATA,
    warnings,
    evidence: {
      availableStock: inputs.availableStock,
      reservedStock: inputs.reservedStock,
      incomingStock: inputs.incomingStock,
      avgDailyDemand: round4(inputs.avgDailyDemand),
      reorderPoint: 0,
      safetyStock: inputs.safetyStock,
      effectiveLeadTimeDays: inputs.supplierLeadTimeDays,
      confirmedDemand: inputs.confirmedDemand,
      lostSalesQuantity: inputs.lostSalesQuantity,
      targetStock: 0,
      suggestedQuantityBeforeRounding: 0,
      packageRoundingAdjustment: 0,
      finalSuggestedQuantity: 0,
      confidence: RecommendationConfidence.INSUFFICIENT_DATA,
      warnings,
      supplierRejected: flags.supplierRejected,
      warehouseCapacityExceeded: false,
    },
  };
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
