// AI Foundation Certification Sprint — Phase II Sprint 3, Workstream 2.
// Real, testable, standalone gate-evaluation functions consumed by
// scripts/run-dgx2-certification-check.ts (the Certification Runner) —
// mirrors the exact separation-of-concerns pattern
// src/ai-benchmark/pipeline/retrieval-intelligence-quality-gates.ts already
// established for the AI Foundation: real logic lives here as plain,
// importable functions; the script is a thin CLI wrapper. Every function
// computes its result from real Prisma data or a real, direct invocation
// of the actual (unmodified) business-rule functions — never a hardcoded
// PASS.
import { existsSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { computePurchaseRecommendation, PurchaseRecommendationInputs } from '../purchase-recommendations/purchase-recommendation-math';
import { Dgx2CertificationDataset } from './dataset-types';
import { validateDatasetIntegrity, DatasetValidationResult } from './dataset-validator';
import { evaluateHistoricalMetricsExclusion, ExclusionEvaluation } from './historical-metrics-exclusion';

export type GateStatus = 'PASS' | 'FAIL' | 'WAIVED';

export interface GateResult {
  gate: string;
  status: GateStatus;
  actual: unknown;
  threshold: unknown;
  reason: string;
  // DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2):
  // populated only by evaluateHistoricalMetricsGate() — the full,
  // per-row exclusion audit trail. Every row missing wape/mase, whether
  // validly excluded or not, is listed here so an excluded row never
  // simply disappears from certification reporting.
  auditTrail?: HistoricalMetricsAudit[];
}

export interface HistoricalMetricsAudit {
  forecastRunId: string;
  targetType: string;
  method: string;
  excluded: boolean;
  conditions: ExclusionEvaluation['conditions'];
  reason: string;
}

const BASE_SAFETY_GATE_INPUTS: PurchaseRecommendationInputs = {
  availableStock: 0,
  reservedStock: 0,
  incomingStock: 0,
  inTransitStock: 0,
  avgDailyDemand: 5,
  coefficientOfVariation: 0.3,
  supplierLeadTimeDays: 14,
  safetyStock: 10,
  targetCoverageDays: 30,
  maxCoverageDays: 90,
  confirmedDemand: 0,
  lostSalesQuantity: 0,
  minimumOrderQuantity: null,
  packageQuantity: null,
  movementClass: 'MEDIUM_MOVING',
  hasSufficientHistory: true,
  criticality: 'NORMAL',
  salesTransactionCount90d: 10,
  stockOutRisk: 'HIGH',
  supplierIsActive: true,
  warehouseCapacity: null,
};

// Real, direct invocation of the actual (unmodified) Sprint 1 business-rule
// function — proves the two Critical Safety Gates are genuinely enforced
// in the real code path, independent of whether the real dataset happens
// to contain a real inactive-supplier/over-capacity business case (see
// docs/certification/datasets/DGX2_CERTIFICATION_DATASET_V1.md's honestly
// reported gap on that point).
export function evaluateSafetyGates(): GateResult[] {
  const results: GateResult[] = [];

  const inactiveSupplierResult = computePurchaseRecommendation({ ...BASE_SAFETY_GATE_INPUTS, supplierIsActive: false });
  results.push({
    gate: 'SAFETY_SUPPLIER_ACTIVE',
    status: inactiveSupplierResult.action === 'REVIEW_DATA' && inactiveSupplierResult.suggestedQuantity === 0 && inactiveSupplierResult.evidence.supplierRejected ? 'PASS' : 'FAIL',
    actual: { action: inactiveSupplierResult.action, suggestedQuantity: inactiveSupplierResult.suggestedQuantity, supplierRejected: inactiveSupplierResult.evidence.supplierRejected },
    threshold: { action: 'REVIEW_DATA', suggestedQuantity: 0, supplierRejected: true },
    reason: 'Real, direct invocation of computePurchaseRecommendation() with a real inactive supplier flag must never recommend a purchase.',
  });

  const overCapacityResult = computePurchaseRecommendation({
    ...BASE_SAFETY_GATE_INPUTS,
    avgDailyDemand: 50,
    targetCoverageDays: 90,
    warehouseCapacity: 100,
  });
  const capacityRespected = overCapacityResult.evidence.finalSuggestedQuantity + overCapacityResult.evidence.availableStock + overCapacityResult.evidence.incomingStock <= 100;
  results.push({
    gate: 'SAFETY_WAREHOUSE_CAPACITY',
    status: overCapacityResult.evidence.warehouseCapacityExceeded && capacityRespected ? 'PASS' : 'FAIL',
    actual: { finalSuggestedQuantity: overCapacityResult.evidence.finalSuggestedQuantity, warehouseCapacityExceeded: overCapacityResult.evidence.warehouseCapacityExceeded },
    threshold: { warehouseCapacityExceeded: true, totalWithinCapacity: 100 },
    reason: 'Real, direct invocation of computePurchaseRecommendation() with a real, deliberately-exceeded warehouse capacity must cap the suggested quantity so total held stock never exceeds it.',
  });

  return results;
}

export interface ForecastQualityInputs {
  chosenBestRunCount: number;
  averageMape: number | null;
  averageWape: number | null;
  averageMase: number | null;
  averageBias: number | null;
  averageRmse: number | null;
}

export async function computeForecastQualityInputs(prisma: PrismaService): Promise<ForecastQualityInputs> {
  const runs = await prisma.forecastRun.findMany({ where: { chosenAsBest: true } });
  const avg = (values: (number | null)[]) => {
    const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
    return finite.length > 0 ? finite.reduce((s, v) => s + v, 0) / finite.length : null;
  };
  return {
    chosenBestRunCount: runs.length,
    averageMape: avg(runs.map((r) => (r.mape !== null ? Number(r.mape) : null))),
    averageWape: avg(runs.map((r) => (r.wape !== null ? Number(r.wape) : null))),
    averageMase: avg(runs.map((r) => (r.mase !== null ? Number(r.mase) : null))),
    averageBias: avg(runs.map((r) => (r.bias !== null ? Number(r.bias) : null))),
    averageRmse: avg(runs.map((r) => (r.rmse !== null ? Number(r.rmse) : null))),
  };
}

// Real thresholds from DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md
// §6: "MASE < 1 required — a forecast that cannot beat a naive baseline
// provides no real value."
export function evaluateForecastQualityGates(inputs: ForecastQualityInputs): GateResult[] {
  const results: GateResult[] = [];

  results.push(
    inputs.chosenBestRunCount === 0
      ? { gate: 'FORECAST_QUALITY_MASE', status: 'WAIVED', actual: null, threshold: 1, reason: 'No real chosen-best ForecastRun rows exist yet.' }
      : {
          gate: 'FORECAST_QUALITY_MASE',
          status: inputs.averageMase !== null && inputs.averageMase < 1 ? 'PASS' : 'FAIL',
          actual: inputs.averageMase,
          threshold: 1,
          reason: `Real average MASE across ${inputs.chosenBestRunCount} chosen-best forecast runs must beat the naive baseline (< 1).`,
        },
  );

  results.push(
    inputs.averageWape === null
      ? { gate: 'FORECAST_QUALITY_WAPE_REPORTED', status: 'WAIVED', actual: null, threshold: 'reported', reason: 'No real WAPE values available yet.' }
      : { gate: 'FORECAST_QUALITY_WAPE_REPORTED', status: 'PASS', actual: inputs.averageWape, threshold: 'reported', reason: 'Real WAPE is computed and available — reported, not gated alone per the Certification Standard §6.' },
  );

  return results;
}

export interface HumanTrustInputs {
  totalRecommendations: number;
  recommendationsWithEvidence: number;
  recommendationsWithConfidence: number;
  decidedRecommendations: number;
  decidedRecommendationsWithAudit: number;
}

export async function computeHumanTrustInputs(prisma: PrismaService): Promise<HumanTrustInputs> {
  const purchaseRecs = await prisma.purchaseRecommendation.findMany();
  const transferRecs = await prisma.transferRecommendation.findMany();

  const totalRecommendations = purchaseRecs.length + transferRecs.length;
  const recommendationsWithEvidence = purchaseRecs.filter((r) => r.evidence !== null).length + transferRecs.filter((r) => r.evidence !== null).length;
  const recommendationsWithConfidence = purchaseRecs.filter((r) => r.confidence !== null).length; // TransferRecommendation has no confidence field — a real, structural difference, not an omission.

  const decidedPurchase = purchaseRecs.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED');
  const decidedTransfer = transferRecs.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED');
  const decidedRecommendations = decidedPurchase.length + decidedTransfer.length;

  let decidedRecommendationsWithAudit = 0;
  for (const rec of decidedPurchase) {
    const action = rec.status === 'APPROVED' ? 'PURCHASE_RECOMMENDATION_APPROVED' : 'PURCHASE_RECOMMENDATION_REJECTED';
    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'PurchaseRecommendation', entityId: rec.id, action } });
    if (audit) decidedRecommendationsWithAudit += 1;
  }
  for (const rec of decidedTransfer) {
    const action = rec.status === 'APPROVED' ? 'TRANSFER_RECOMMENDATION_APPROVED' : 'TRANSFER_RECOMMENDATION_REJECTED';
    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'TransferRecommendation', entityId: rec.id, action } });
    if (audit) decidedRecommendationsWithAudit += 1;
  }

  return { totalRecommendations, recommendationsWithEvidence, recommendationsWithConfidence, decidedRecommendations, decidedRecommendationsWithAudit };
}

export function evaluateHumanTrustGates(inputs: HumanTrustInputs): GateResult[] {
  const results: GateResult[] = [];

  results.push(
    inputs.totalRecommendations === 0
      ? { gate: 'HUMAN_TRUST_EVIDENCE', status: 'WAIVED', actual: null, threshold: 'all', reason: 'No real recommendations exist yet.' }
      : {
          gate: 'HUMAN_TRUST_EVIDENCE',
          status: inputs.recommendationsWithEvidence === inputs.totalRecommendations ? 'PASS' : 'FAIL',
          actual: inputs.recommendationsWithEvidence,
          threshold: inputs.totalRecommendations,
          reason: 'Every real recommendation must carry real evidence — never omitted.',
        },
  );

  results.push(
    inputs.decidedRecommendations === 0
      ? { gate: 'HUMAN_TRUST_AUDIT_TRAIL', status: 'WAIVED', actual: null, threshold: 'all', reason: 'No real recommendation has been approved or rejected yet.' }
      : {
          gate: 'HUMAN_TRUST_AUDIT_TRAIL',
          status: inputs.decidedRecommendationsWithAudit === inputs.decidedRecommendations ? 'PASS' : 'FAIL',
          actual: inputs.decidedRecommendationsWithAudit,
          threshold: inputs.decidedRecommendations,
          reason: 'Every real decided (approved/rejected) recommendation must have a real, corresponding AuditLog row.',
        },
  );

  return results;
}

// Structural check only — confirms the real integration-spec files exist
// on disk for every real orchestrating service in the DGX 2.0 capability.
// Deliberately does not shell out to actually run the suite from here
// (that real execution — mirroring verify-ai-foundation-certification.ts's
// own execSync('npx jest ...') pattern — belongs to the Certification
// Runner script itself, never to a function invoked from inside a running
// Jest process).
export function evaluateIntegrationTestCoverage(repoSrcRoot: string): GateResult {
  const requiredSpecs = [
    'forecasting/forecasting.integration-spec.ts',
    'purchase-recommendations/purchase-recommendations.integration-spec.ts',
    'transfer-recommendations/transfer-recommendations.integration-spec.ts',
    'lost-sales/lost-sales-engine.integration-spec.ts',
    'supplier-analytics/supplier-analytics.integration-spec.ts',
  ];
  const missing = requiredSpecs.filter((p) => !existsSync(`${repoSrcRoot}/${p}`));
  return {
    gate: 'INTEGRATION_TEST_COVERAGE',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    actual: requiredSpecs.length - missing.length,
    threshold: requiredSpecs.length,
    reason: missing.length === 0 ? 'Every real orchestrating service has a real integration-spec file.' : `Missing integration specs: ${missing.join(', ')}`,
  };
}

// DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2): a
// row missing WAPE or MASE now counts toward completeness either by
// carrying both real values, or by validly satisfying the five-condition
// exclusion test (evaluateHistoricalMetricsExclusion) — never by any
// other means. Every row missing a metric is queried and audited
// individually; nothing is inferred or recomputed from live business
// data at certification time.
export async function evaluateHistoricalMetricsGate(prisma: PrismaService): Promise<GateResult> {
  const total = await prisma.forecastRun.count();
  if (total === 0) {
    return { gate: 'HISTORICAL_METRICS_PERSISTED', status: 'WAIVED', actual: null, threshold: 'all', reason: 'No real ForecastRun rows exist yet.' };
  }

  const incomplete = await prisma.forecastRun.findMany({
    where: { OR: [{ wape: null }, { mase: null }] },
    select: { id: true, targetType: true, method: true, wape: true, mase: true, evidence: true },
  });
  const completeCount = total - incomplete.length;

  const auditTrail: HistoricalMetricsAudit[] = incomplete.map((row) => {
    const evaluation = evaluateHistoricalMetricsExclusion({ id: row.id, wape: row.wape, mase: row.mase, evidence: row.evidence });
    return {
      forecastRunId: row.id,
      targetType: row.targetType,
      method: row.method,
      excluded: evaluation.excluded,
      conditions: evaluation.conditions,
      reason: evaluation.reason,
    };
  });

  const excludedCount = auditTrail.filter((a) => a.excluded).length;
  const satisfiedCount = completeCount + excludedCount;
  const unresolvedFailures = incomplete.length - excludedCount;

  return {
    gate: 'HISTORICAL_METRICS_PERSISTED',
    status: satisfiedCount === total ? 'PASS' : 'FAIL',
    actual: satisfiedCount,
    threshold: total,
    reason:
      `Every real ForecastRun must have real, persisted WAPE and MASE values, or validly satisfy the Amendment v1.1 §6A exclusion. ` +
      `${completeCount} complete, ${excludedCount} validly excluded (verified zero business activity), ${unresolvedFailures} unresolved of ${total} total.`,
    auditTrail,
  };
}

export async function evaluateObservabilityGate(): Promise<GateResult> {
  const metrics = new MetricsService();
  const requiredMetricNames = [
    'forecast_executions_total',
    'forecast_duration_seconds',
    'forecast_failures_total',
    'forecast_confidence_total',
    'forecast_method_total',
    'forecast_accuracy_wape',
    'recommendation_executions_total',
    'recommendation_approvals_total',
    'recommendation_rejections_total',
    'recommendation_confidence_total',
    'recommendation_action_total',
  ];
  const registeredMetrics = await metrics.registry.getMetricsAsJSON();
  const registered = registeredMetrics.map((m) => m.name);
  const missing = requiredMetricNames.filter((n) => !registered.includes(n));
  return {
    gate: 'OBSERVABILITY_METRICS_REGISTERED',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    actual: requiredMetricNames.length - missing.length,
    threshold: requiredMetricNames.length,
    reason: missing.length === 0 ? 'Every real Sprint 2 forecast/recommendation metric is registered.' : `Missing metrics: ${missing.join(', ')}`,
  };
}

export function evaluateDatasetIntegrityGate(dataset: Dgx2CertificationDataset): { gate: GateResult; validation: DatasetValidationResult } {
  const validation = validateDatasetIntegrity(dataset);
  return {
    gate: {
      gate: 'DATASET_INTEGRITY',
      status: validation.valid ? 'PASS' : 'FAIL',
      actual: { checksumMatches: validation.checksumMatches, totalEntries: validation.totalEntries, missingCategories: validation.missingCategories },
      threshold: { checksumMatches: true, missingCategories: [] },
      reason: validation.issues.length === 0 ? 'Real dataset checksum matches and every required category is present.' : validation.issues.join('; '),
    },
    validation,
  };
}

export function allGatesPass(results: GateResult[]): boolean {
  return results.every((r) => r.status === 'PASS' || r.status === 'WAIVED');
}
