import { RecommendationConfidence } from '@prisma/client';
import { computeSupplierMetrics, PurchaseLineSample } from './supplier-metric-math';

function sample(overrides: Partial<PurchaseLineSample> = {}): PurchaseLineSample {
  return {
    orderedQuantity: 10,
    receivedQuantity: 10,
    unitCost: 100,
    documentDate: new Date('2026-01-01'),
    expectedDeliveryDate: new Date('2026-01-31'),
    actualReceiptDate: new Date('2026-01-30'),
    ...overrides,
  };
}

describe('computeSupplierMetrics', () => {
  it('returns INSUFFICIENT_DATA and all-null metrics below the minimum sample size', () => {
    const result = computeSupplierMetrics([sample(), sample()]);
    expect(result.dataSufficiency).toBe(RecommendationConfidence.INSUFFICIENT_DATA);
    expect(result.avgLeadTimeDays).toBeNull();
    expect(result.fillRatePct).toBeNull();
  });

  it('computes average lead time in days from document date to actual receipt', () => {
    const result = computeSupplierMetrics([
      sample({ documentDate: new Date('2026-01-01'), actualReceiptDate: new Date('2026-01-11') }), // 10d
      sample({ documentDate: new Date('2026-01-01'), actualReceiptDate: new Date('2026-01-21') }), // 20d
      sample({ documentDate: new Date('2026-01-01'), actualReceiptDate: new Date('2026-01-16') }), // 15d
    ]);
    expect(result.avgLeadTimeDays).toBeCloseTo(15, 5);
  });

  it('computes on-time delivery percentage against expected delivery date', () => {
    const result = computeSupplierMetrics([
      sample({ expectedDeliveryDate: new Date('2026-01-31'), actualReceiptDate: new Date('2026-01-30') }), // on time
      sample({ expectedDeliveryDate: new Date('2026-01-31'), actualReceiptDate: new Date('2026-02-05') }), // late
      sample({ expectedDeliveryDate: new Date('2026-01-31'), actualReceiptDate: new Date('2026-01-15') }), // on time
    ]);
    expect(result.onTimeDeliveryPct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it('computes fill rate as total received over total ordered', () => {
    const result = computeSupplierMetrics([
      sample({ orderedQuantity: 10, receivedQuantity: 10 }),
      sample({ orderedQuantity: 10, receivedQuantity: 5 }),
      sample({ orderedQuantity: 10, receivedQuantity: 10 }),
    ]);
    expect(result.fillRatePct).toBeCloseTo((25 / 30) * 100, 5);
  });

  it('reports HIGH confidence once the sample size clears the high-confidence threshold', () => {
    const lines = Array.from({ length: 10 }, () => sample());
    const result = computeSupplierMetrics(lines);
    expect(result.dataSufficiency).toBe(RecommendationConfidence.HIGH);
  });

  it('reports MEDIUM confidence for a small-but-usable sample', () => {
    const lines = Array.from({ length: 4 }, () => sample());
    const result = computeSupplierMetrics(lines);
    expect(result.dataSufficiency).toBe(RecommendationConfidence.MEDIUM);
  });

  it('computes zero price variance when cost is perfectly stable', () => {
    const result = computeSupplierMetrics([sample({ unitCost: 100 }), sample({ unitCost: 100 }), sample({ unitCost: 100 })]);
    expect(result.priceVariancePct).toBeCloseTo(0, 5);
  });
});
