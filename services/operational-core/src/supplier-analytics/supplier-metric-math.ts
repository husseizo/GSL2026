import { RecommendationConfidence } from '@prisma/client';

export interface PurchaseLineSample {
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  documentDate: Date;
  expectedDeliveryDate: Date | null;
  actualReceiptDate: Date | null;
}

export interface SupplierMetricResult {
  avgLeadTimeDays: number | null;
  leadTimeVariance: number | null;
  onTimeDeliveryPct: number | null;
  fillRatePct: number | null;
  priceVariancePct: number | null;
  quantityAccuracyPct: number | null;
  receiptCompletionPct: number | null;
  dataSufficiency: RecommendationConfidence;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLE_FOR_ANY_METRIC = 3;
const MIN_SAMPLE_FOR_HIGH_CONFIDENCE = 10;

// No single blended "supplier score" — the spec explicitly asks that an
// overall ranking never be produced without sufficient evidence, so this
// returns the individual metrics plus a sufficiency flag, not a composite
// number. See docs/architecture/phase-2-commercial-foundation.md §9.
export function computeSupplierMetrics(lines: PurchaseLineSample[]): SupplierMetricResult {
  if (lines.length < MIN_SAMPLE_FOR_ANY_METRIC) {
    return {
      avgLeadTimeDays: null,
      leadTimeVariance: null,
      onTimeDeliveryPct: null,
      fillRatePct: null,
      priceVariancePct: null,
      quantityAccuracyPct: null,
      receiptCompletionPct: null,
      dataSufficiency: RecommendationConfidence.INSUFFICIENT_DATA,
    };
  }

  const withReceipt = lines.filter((l) => l.actualReceiptDate !== null);
  const leadTimes = withReceipt.map((l) => (l.actualReceiptDate!.getTime() - l.documentDate.getTime()) / DAY_MS);
  const avgLeadTimeDays = average(leadTimes);
  const leadTimeVariance = variance(leadTimes, avgLeadTimeDays);

  const withExpected = withReceipt.filter((l) => l.expectedDeliveryDate !== null);
  const onTimeCount = withExpected.filter((l) => l.actualReceiptDate! <= l.expectedDeliveryDate!).length;
  const onTimeDeliveryPct = withExpected.length > 0 ? (onTimeCount / withExpected.length) * 100 : null;

  const totalOrdered = lines.reduce((sum, l) => sum + l.orderedQuantity, 0);
  const totalReceived = lines.reduce((sum, l) => sum + l.receivedQuantity, 0);
  const fillRatePct = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : null;

  const unitCosts = lines.map((l) => l.unitCost).filter((c) => c > 0);
  const avgCost = average(unitCosts);
  const costStdDev = Math.sqrt(variance(unitCosts, avgCost));
  const priceVariancePct = avgCost !== null && avgCost > 0 ? (costStdDev / avgCost) * 100 : null;

  const quantityAccuracyPct =
    average(
      lines
        .filter((l) => l.orderedQuantity > 0)
        .map((l) => 100 - Math.min(100, (Math.abs(l.receivedQuantity - l.orderedQuantity) / l.orderedQuantity) * 100)),
    ) ?? null;

  const receiptCompletionPct = (lines.filter((l) => l.receivedQuantity >= l.orderedQuantity).length / lines.length) * 100;

  const dataSufficiency =
    lines.length >= MIN_SAMPLE_FOR_HIGH_CONFIDENCE ? RecommendationConfidence.HIGH : RecommendationConfidence.MEDIUM;

  return {
    avgLeadTimeDays,
    leadTimeVariance,
    onTimeDeliveryPct,
    fillRatePct,
    priceVariancePct,
    quantityAccuracyPct,
    receiptCompletionPct,
    dataSufficiency,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function variance(values: number[], mean: number | null): number {
  if (values.length === 0 || mean === null) return 0;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}
