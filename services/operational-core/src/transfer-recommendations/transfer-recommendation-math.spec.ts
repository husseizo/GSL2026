import { evaluateTransferCandidate, TransferCandidateInputs } from './transfer-recommendation-math';

function baseInputs(overrides: Partial<TransferCandidateInputs> = {}): TransferCandidateInputs {
  return {
    sourceAvailable: 20,
    sourceSafetyStock: 5,
    destAvailable: 2,
    destReorderPoint: 10,
    destTargetStock: 20,
    destAvgDailyDemand: 1,
    transferLeadTimeDays: 3,
    supplierLeadTimeDays: 30,
    ...overrides,
  };
}

describe('evaluateTransferCandidate', () => {
  it('recommends a transfer when destination is below reorder point and source has surplus', () => {
    const result = evaluateTransferCandidate(baseInputs());
    expect(result).not.toBeNull();
    expect(result!.suggestedQuantity).toBeGreaterThan(0);
  });

  it('returns null when the destination is not actually at risk (above reorder point)', () => {
    const result = evaluateTransferCandidate(baseInputs({ destAvailable: 15, destReorderPoint: 10 }));
    expect(result).toBeNull();
  });

  it('returns null when the source has no surplus above its own safety stock', () => {
    const result = evaluateTransferCandidate(baseInputs({ sourceAvailable: 5, sourceSafetyStock: 5 }));
    expect(result).toBeNull();
  });

  it('returns null when transfer lead time is not faster than the supplier lead time', () => {
    const result = evaluateTransferCandidate(baseInputs({ transferLeadTimeDays: 30, supplierLeadTimeDays: 10 }));
    expect(result).toBeNull();
  });

  it('proceeds when supplier lead time is unknown (an internal move is still preferable)', () => {
    const result = evaluateTransferCandidate(baseInputs({ supplierLeadTimeDays: null, transferLeadTimeDays: 30 }));
    expect(result).not.toBeNull();
  });

  it('never leaves the source below its own safety stock after the transfer', () => {
    const result = evaluateTransferCandidate(baseInputs({ sourceAvailable: 20, sourceSafetyStock: 5, destTargetStock: 1000 }));
    expect(result!.sourceStockAfter).toBeGreaterThanOrEqual(5);
    expect(result!.sourceSafetyStockImpact).toBeGreaterThanOrEqual(0);
  });

  it('caps the suggested quantity at the destination need, not the full source surplus', () => {
    // source surplus = 20 - 5 = 15; destination only needs 20 - 2 = 18 -> capped by min(15, 18) = 15
    const result = evaluateTransferCandidate(baseInputs({ sourceAvailable: 20, sourceSafetyStock: 5, destAvailable: 2, destTargetStock: 20 }));
    expect(result!.suggestedQuantity).toBe(15);
  });

  it('improves destination days-of-supply after the transfer', () => {
    const result = evaluateTransferCandidate(baseInputs());
    expect(result!.destDaysOfSupplyAfter!).toBeGreaterThan(result!.destDaysOfSupplyBefore!);
  });
});
