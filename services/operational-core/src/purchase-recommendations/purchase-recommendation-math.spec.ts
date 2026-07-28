import { MovementClass, PurchaseRecommendationAction, RecommendationConfidence } from '@prisma/client';
import { computePurchaseRecommendation, PurchaseRecommendationInputs } from './purchase-recommendation-math';

function baseInputs(overrides: Partial<PurchaseRecommendationInputs> = {}): PurchaseRecommendationInputs {
  return {
    availableStock: 2,
    reservedStock: 0,
    incomingStock: 0,
    inTransitStock: 0,
    avgDailyDemand: 0.24,
    coefficientOfVariation: 0.4,
    supplierLeadTimeDays: 30,
    safetyStock: 3,
    targetCoverageDays: 45,
    maxCoverageDays: 180,
    confirmedDemand: 2,
    lostSalesQuantity: 4,
    minimumOrderQuantity: null,
    packageQuantity: null,
    movementClass: MovementClass.MEDIUM_MOVING,
    hasSufficientHistory: true,
    criticality: 'NORMAL',
    salesTransactionCount90d: 10,
    stockOutRisk: 'HIGH',
    supplierIsActive: true,
    warehouseCapacity: null,
    ...overrides,
  };
}

describe('computePurchaseRecommendation — reorder point and target stock formulas', () => {
  it('computes reorderPoint = avgDailyDemand * effectiveLeadTimeDays + safetyStock', () => {
    const result = computePurchaseRecommendation(baseInputs({ coefficientOfVariation: 0.3 })); // low CV -> no lead-time buffer
    // 0.24 * 30 + 3 = 10.2
    expect(result.evidence.reorderPoint).toBeCloseTo(10.2, 2);
  });

  it('computes targetStock = avgDailyDemand * targetCoverageDays + safetyStock', () => {
    const result = computePurchaseRecommendation(baseInputs({ coefficientOfVariation: 0.3 }));
    // 0.24 * 45 + 3 = 13.8
    expect(result.evidence.targetStock).toBeCloseTo(13.8, 2);
  });

  it('applies a lead-time buffer for highly variable demand (CV > 1)', () => {
    const stable = computePurchaseRecommendation(baseInputs({ coefficientOfVariation: 0.3, salesTransactionCount90d: 10 }));
    const variable = computePurchaseRecommendation(baseInputs({ coefficientOfVariation: 1.2, salesTransactionCount90d: 10 }));
    expect(variable.evidence.effectiveLeadTimeDays!).toBeGreaterThan(stable.evidence.effectiveLeadTimeDays!);
  });

  it('preserves the raw (unrounded) suggested quantity in evidence for audit', () => {
    const result = computePurchaseRecommendation(baseInputs({ coefficientOfVariation: 0.3, packageQuantity: 5 }));
    expect(result.evidence.suggestedQuantityBeforeRounding).not.toBe(result.evidence.finalSuggestedQuantity);
  });
});

describe('computePurchaseRecommendation — rounding behaviour', () => {
  it('never suggests a negative quantity even when target stock is already exceeded', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ availableStock: 1000, confirmedDemand: 0, lostSalesQuantity: 0, coefficientOfVariation: 0.2 }),
    );
    expect(result.suggestedQuantity).toBeGreaterThanOrEqual(0);
  });

  it('respects minimum order quantity by rounding a small suggestion up to the MOQ', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ availableStock: 9, targetCoverageDays: 45, safetyStock: 1, minimumOrderQuantity: 20, coefficientOfVariation: 0.2 }),
    );
    expect(result.evidence.finalSuggestedQuantity).toBeGreaterThanOrEqual(20);
  });

  it('rounds up to the nearest full package quantity', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ availableStock: 0, avgDailyDemand: 1, targetCoverageDays: 10, safetyStock: 0, confirmedDemand: 0, packageQuantity: 6, coefficientOfVariation: 0.2 }),
    );
    expect(result.evidence.finalSuggestedQuantity % 6).toBe(0);
  });

  it('never returns fractional-unit false precision', () => {
    const result = computePurchaseRecommendation(baseInputs({ avgDailyDemand: 0.2377, coefficientOfVariation: 0.2 }));
    expect(Number.isInteger(result.suggestedQuantity)).toBe(true);
  });
});

describe('computePurchaseRecommendation — action selection', () => {
  it('recommends BUY_NOW when stock is at/below reorder point and criticality or risk is high', () => {
    const result = computePurchaseRecommendation(baseInputs({ availableStock: 1, stockOutRisk: 'HIGH', coefficientOfVariation: 0.2 }));
    expect(result.action).toBe(PurchaseRecommendationAction.BUY_NOW);
    expect(result.suggestedQuantity).toBeGreaterThan(0);
  });

  it('recommends BUY_SOON when below reorder point but not urgent', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ availableStock: 1, stockOutRisk: 'LOW', criticality: 'NORMAL', lostSalesQuantity: 0, coefficientOfVariation: 0.2 }),
    );
    expect(result.action).toBe(PurchaseRecommendationAction.BUY_SOON);
  });

  it('suppresses purchasing for dead stock with no confirmed demand (DO_NOT_BUY)', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ movementClass: MovementClass.DEAD_STOCK, confirmedDemand: 0, lostSalesQuantity: 0 }),
    );
    expect(result.action).toBe(PurchaseRecommendationAction.DO_NOT_BUY);
    expect(result.suggestedQuantity).toBe(0);
  });

  it('recommends PURCHASE_ON_CONFIRMED_ORDER for dead stock that does have a confirmed order', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ movementClass: MovementClass.DEAD_STOCK, confirmedDemand: 5 }),
    );
    expect(result.action).toBe(PurchaseRecommendationAction.PURCHASE_ON_CONFIRMED_ORDER);
    expect(result.suggestedQuantity).toBeGreaterThan(0);
  });

  it('recommends PURCHASE_ON_CONFIRMED_ORDER for rare, highly intermittent, low-frequency items', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ coefficientOfVariation: 2.0, salesTransactionCount90d: 1, confirmedDemand: 1 }),
    );
    expect(result.action).toBe(PurchaseRecommendationAction.PURCHASE_ON_CONFIRMED_ORDER);
  });

  it('does not classify a rare item as PURCHASE_ON_CONFIRMED_ORDER when existing stock already covers target coverage', () => {
    // targetStock = 0.24*45 + 3 = 13.8; available stock of 20 already exceeds it.
    const result = computePurchaseRecommendation(
      baseInputs({ coefficientOfVariation: 2.0, salesTransactionCount90d: 1, availableStock: 20, confirmedDemand: 0 }),
    );
    expect(result.action).not.toBe(PurchaseRecommendationAction.PURCHASE_ON_CONFIRMED_ORDER);
  });

  it('recommends CLEAR_EXISTING_STOCK when stock is well above target with no demand pressure', () => {
    const result = computePurchaseRecommendation(
      baseInputs({
        availableStock: 100,
        targetCoverageDays: 30,
        avgDailyDemand: 0.2,
        safetyStock: 0,
        confirmedDemand: 0,
        incomingStock: 0,
        lostSalesQuantity: 0,
        movementClass: MovementClass.SLOW_MOVING,
        coefficientOfVariation: 0.3,
      }),
    );
    expect(result.action).toBe(PurchaseRecommendationAction.CLEAR_EXISTING_STOCK);
  });

  it('returns REVIEW_DATA with INSUFFICIENT_DATA confidence when history is insufficient', () => {
    const result = computePurchaseRecommendation(baseInputs({ hasSufficientHistory: false }));
    expect(result.action).toBe(PurchaseRecommendationAction.REVIEW_DATA);
    expect(result.confidence).toBe(RecommendationConfidence.INSUFFICIENT_DATA);
    expect(result.suggestedQuantity).toBe(0);
  });
});

// Sprint 1 Safety Gate — AI Foundation Certification Sprint, Phase II
// (docs/adr/ADR-0001-warehouse-capacity.md; DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md
// §14, rules 2 and 5; DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md §8).
describe('computePurchaseRecommendation — Safety Gate: supplier must be active', () => {
  it('never recommends a purchase against an inactive supplier — returns REVIEW_DATA with zero quantity', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ supplierIsActive: false, availableStock: 0, stockOutRisk: 'HIGH', coefficientOfVariation: 0.2 }),
    );
    expect(result.action).toBe(PurchaseRecommendationAction.REVIEW_DATA);
    expect(result.suggestedQuantity).toBe(0);
  });

  it('reflects supplier rejection in confidence (INSUFFICIENT_DATA)', () => {
    const result = computePurchaseRecommendation(baseInputs({ supplierIsActive: false }));
    expect(result.confidence).toBe(RecommendationConfidence.INSUFFICIENT_DATA);
  });

  it('records structured evidence explaining the supplier rejection', () => {
    const result = computePurchaseRecommendation(baseInputs({ supplierIsActive: false }));
    expect(result.evidence.supplierRejected).toBe(true);
  });

  it('generates a real, human-readable warning explaining the supplier rejection', () => {
    const result = computePurchaseRecommendation(baseInputs({ supplierIsActive: false }));
    expect(result.warnings.some((w) => w.toLowerCase().includes('inactive') || w.toLowerCase().includes('unavailable'))).toBe(true);
  });

  it('still recommends normally when the supplier is active (no false rejection)', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ supplierIsActive: true, availableStock: 1, stockOutRisk: 'HIGH', coefficientOfVariation: 0.2 }),
    );
    expect(result.action).toBe(PurchaseRecommendationAction.BUY_NOW);
    expect(result.evidence.supplierRejected).toBe(false);
  });
});

describe('computePurchaseRecommendation — Safety Gate: never exceed warehouse capacity', () => {
  it('caps the suggested quantity so available + incoming + in-transit + suggested never exceeds real warehouse capacity', () => {
    const result = computePurchaseRecommendation(
      baseInputs({
        availableStock: 0,
        incomingStock: 0,
        inTransitStock: 0,
        avgDailyDemand: 10,
        targetCoverageDays: 90,
        safetyStock: 0,
        confirmedDemand: 0,
        lostSalesQuantity: 0,
        coefficientOfVariation: 0.2,
        warehouseCapacity: 50,
      }),
    );
    expect(result.evidence.finalSuggestedQuantity).toBeLessThanOrEqual(50);
    expect(result.evidence.warehouseCapacityExceeded).toBe(true);
    expect(result.warnings.some((w) => w.toLowerCase().includes('capacity'))).toBe(true);
  });

  it('never returns a suggested quantity whose total with existing stock exceeds capacity', () => {
    const result = computePurchaseRecommendation(
      baseInputs({
        availableStock: 20,
        incomingStock: 5,
        inTransitStock: 0,
        avgDailyDemand: 10,
        targetCoverageDays: 90,
        safetyStock: 0,
        confirmedDemand: 0,
        lostSalesQuantity: 0,
        coefficientOfVariation: 0.2,
        warehouseCapacity: 50,
      }),
    );
    const totalAfter = 20 + 5 + result.suggestedQuantity;
    expect(totalAfter).toBeLessThanOrEqual(50);
  });

  it('does not cap or flag anything when capacity is unknown (null)', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ availableStock: 0, avgDailyDemand: 10, targetCoverageDays: 90, coefficientOfVariation: 0.2, warehouseCapacity: null }),
    );
    expect(result.evidence.warehouseCapacityExceeded).toBe(false);
  });

  it('does not cap when the projected total is within a real, known capacity', () => {
    const result = computePurchaseRecommendation(
      baseInputs({ availableStock: 0, avgDailyDemand: 0.24, coefficientOfVariation: 0.3, warehouseCapacity: 1000 }),
    );
    expect(result.evidence.warehouseCapacityExceeded).toBe(false);
  });
});
