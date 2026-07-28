import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { createCustomerFixture } from '../test-helpers/db-fixtures';
import { Dgx2CertificationDataset } from './dataset-types';
import {
  evaluateSafetyGates,
  computeForecastQualityInputs,
  evaluateForecastQualityGates,
  computeHumanTrustInputs,
  evaluateHumanTrustGates,
  evaluateIntegrationTestCoverage,
  evaluateHistoricalMetricsGate,
  evaluateObservabilityGate,
  evaluateDatasetIntegrityGate,
} from './gate-evaluators';

// AI Foundation Certification Sprint — Phase II Sprint 3 (DGX 2.0
// Certification Runner). Real Postgres integration coverage for every gate
// evaluator the Certification Runner will call. Since several of these
// evaluators deliberately aggregate over the *entire* real table (a
// certification-wide measurement, not scoped to one test fixture), these
// tests use before/after deltas around real inserts rather than assuming
// an empty database — the same discipline the aggregate functions
// themselves must follow in production.
describe('gate-evaluators (integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('evaluateSafetyGates (real, direct business-rule invocation)', () => {
    it('both real Critical Safety Gates from Sprint 1 report PASS against the real, unmodified business rules', () => {
      const results = evaluateSafetyGates();
      expect(results.map((r) => r.gate)).toEqual(['SAFETY_SUPPLIER_ACTIVE', 'SAFETY_WAREHOUSE_CAPACITY']);
      expect(results.every((r) => r.status === 'PASS')).toBe(true);
    });
  });

  describe('computeForecastQualityInputs + evaluateForecastQualityGates', () => {
    it('real chosen-best ForecastRun rows are aggregated with a correct real weighted average (delta-verified)', async () => {
      // Derived independently from the raw real rows (not from the
      // function's own prior report) — chosenBestRunCount counts every
      // real chosenAsBest row, but a handful can legitimately carry a
      // null mase (a real, honest gap: forecasting.service.ts's
      // finiteOrNull() nulls out a non-finite MASE, e.g. a perfectly
      // flat real series with a zero-error naive baseline, rather than
      // persisting NaN/Infinity). The average is only ever taken over
      // the finite subset, so the expectation must be too.
      const priorRuns = await prisma.forecastRun.findMany({ where: { chosenAsBest: true } });
      const priorFiniteMase = priorRuns.map((r) => (r.mase !== null ? Number(r.mase) : null)).filter((v): v is number => v !== null && Number.isFinite(v));

      const before = await computeForecastQualityInputs(prisma);
      expect(before.chosenBestRunCount).toBe(priorRuns.length);

      await prisma.forecastRun.create({
        data: { targetType: 'GARAGE_WORKLOAD', targetId: 'gate-fq-1', windowDays: 7, method: 'NAIVE', chosenAsBest: true, mase: 0.05, wape: 1.5, mape: 2, bias: 0.01, rmse: 0.5 },
      });

      const after = await computeForecastQualityInputs(prisma);
      expect(after.chosenBestRunCount).toBe(before.chosenBestRunCount + 1);

      const expectedMase = (priorFiniteMase.reduce((s, v) => s + v, 0) + 0.05) / (priorFiniteMase.length + 1);
      expect(after.averageMase).toBeCloseTo(expectedMase, 6);
    });

    it('non-chosen-best ForecastRun rows are real and excluded from the aggregate (chosenAsBest: false is never counted)', async () => {
      const before = await computeForecastQualityInputs(prisma);

      await prisma.forecastRun.create({
        data: { targetType: 'GARAGE_WORKLOAD', targetId: 'gate-fq-2', windowDays: 7, method: 'SEASONAL_NAIVE', chosenAsBest: false, mase: 99, wape: 99, mape: 99, bias: 99, rmse: 99 },
      });

      const after = await computeForecastQualityInputs(prisma);
      expect(after.chosenBestRunCount).toBe(before.chosenBestRunCount);
      expect(after.averageMase).toBe(before.averageMase);
    });

    it('evaluateForecastQualityGates WAIVES both gates when zero real chosen-best runs exist', () => {
      const gates = evaluateForecastQualityGates({ chosenBestRunCount: 0, averageMape: null, averageWape: null, averageMase: null, averageBias: null, averageRmse: null });
      expect(gates.every((g) => g.status === 'WAIVED')).toBe(true);
    });

    it('evaluateForecastQualityGates PASSes FORECAST_QUALITY_MASE only when real average MASE beats the naive baseline (< 1)', () => {
      const passing = evaluateForecastQualityGates({ chosenBestRunCount: 5, averageMape: 10, averageWape: 10, averageMase: 0.7, averageBias: 0, averageRmse: 1 });
      const failing = evaluateForecastQualityGates({ chosenBestRunCount: 5, averageMape: 10, averageWape: 10, averageMase: 1.3, averageBias: 0, averageRmse: 1 });
      expect(passing.find((g) => g.gate === 'FORECAST_QUALITY_MASE')!.status).toBe('PASS');
      expect(failing.find((g) => g.gate === 'FORECAST_QUALITY_MASE')!.status).toBe('FAIL');
    });
  });

  describe('computeHumanTrustInputs + evaluateHumanTrustGates', () => {
    it('a real, pending PurchaseRecommendation with real evidence and confidence is counted but not yet decided (delta-verified)', async () => {
      const before = await computeHumanTrustInputs(prisma);

      await prisma.purchaseRecommendation.create({
        data: {
          itemType: 'PART',
          action: 'BUY_NOW',
          suggestedQuantity: 5,
          confidence: 'HIGH',
          evidence: { note: 'gate-evaluators integration fixture' },
        },
      });

      const after = await computeHumanTrustInputs(prisma);
      expect(after.totalRecommendations).toBe(before.totalRecommendations + 1);
      expect(after.recommendationsWithEvidence).toBe(before.recommendationsWithEvidence + 1);
      expect(after.recommendationsWithConfidence).toBe(before.recommendationsWithConfidence + 1);
      expect(after.decidedRecommendations).toBe(before.decidedRecommendations);
    });

    it('a real, decided PurchaseRecommendation with a matching real AuditLog row is counted as audited (delta-verified)', async () => {
      const before = await computeHumanTrustInputs(prisma);
      const approver = await createCustomerFixture(prisma, `gate-ht-audited-${Date.now()}`);

      const rec = await prisma.purchaseRecommendation.create({
        data: {
          itemType: 'PART',
          action: 'BUY_NOW',
          suggestedQuantity: 5,
          confidence: 'HIGH',
          evidence: { note: 'gate-evaluators audited fixture' },
          status: 'APPROVED',
          decidedById: approver.id,
          decidedAt: new Date(),
        },
      });
      await prisma.auditLog.create({
        data: { action: 'PURCHASE_RECOMMENDATION_APPROVED', actorId: approver.id, entityType: 'PurchaseRecommendation', entityId: rec.id },
      });

      const after = await computeHumanTrustInputs(prisma);
      expect(after.decidedRecommendations).toBe(before.decidedRecommendations + 1);
      expect(after.decidedRecommendationsWithAudit).toBe(before.decidedRecommendationsWithAudit + 1);
    });

    it('a real, decided PurchaseRecommendation WITHOUT a matching real AuditLog row is correctly detected as un-audited (delta-verified)', async () => {
      const before = await computeHumanTrustInputs(prisma);
      const approver = await createCustomerFixture(prisma, `gate-ht-unaudited-${Date.now()}`);

      await prisma.purchaseRecommendation.create({
        data: {
          itemType: 'PART',
          action: 'BUY_NOW',
          suggestedQuantity: 5,
          confidence: 'HIGH',
          evidence: { note: 'gate-evaluators unaudited fixture' },
          status: 'APPROVED',
          decidedById: approver.id,
          decidedAt: new Date(),
        },
      });
      // Deliberately no AuditLog row created for this recommendation.

      const after = await computeHumanTrustInputs(prisma);
      expect(after.decidedRecommendations).toBe(before.decidedRecommendations + 1);
      expect(after.decidedRecommendationsWithAudit).toBe(before.decidedRecommendationsWithAudit);
    });

    it('evaluateHumanTrustGates WAIVES both gates when zero real recommendations/decisions exist', () => {
      const gates = evaluateHumanTrustGates({ totalRecommendations: 0, recommendationsWithEvidence: 0, recommendationsWithConfidence: 0, decidedRecommendations: 0, decidedRecommendationsWithAudit: 0 });
      expect(gates.every((g) => g.status === 'WAIVED')).toBe(true);
    });

    it('evaluateHumanTrustGates FAILs HUMAN_TRUST_AUDIT_TRAIL when a real decided recommendation lacks a real audit row', () => {
      const gates = evaluateHumanTrustGates({ totalRecommendations: 3, recommendationsWithEvidence: 3, recommendationsWithConfidence: 3, decidedRecommendations: 2, decidedRecommendationsWithAudit: 1 });
      expect(gates.find((g) => g.gate === 'HUMAN_TRUST_AUDIT_TRAIL')!.status).toBe('FAIL');
    });
  });

  describe('evaluateHistoricalMetricsGate', () => {
    it('a real ForecastRun with both wape and mase persisted increases both the total and complete counts by exactly one (delta-verified)', async () => {
      const totalBefore = await prisma.forecastRun.count();
      const completeBefore = await prisma.forecastRun.count({ where: { wape: { not: null }, mase: { not: null } } });
      // Not asserted as always-100%: forecasting.service.ts's finiteOrNull()
      // legitimately nulls a non-finite wape/mase (e.g. a perfectly flat
      // real series with a zero-error naive baseline) rather than
      // persisting NaN/Infinity — a real, honest gap the gate is designed
      // to surface, not an invariant this test should assume away.

      await prisma.forecastRun.create({ data: { targetType: 'GARAGE_WORKLOAD', targetId: 'gate-hist-complete-1', windowDays: 7, method: 'NAIVE', wape: 5, mase: 0.5 } });

      const gate = await evaluateHistoricalMetricsGate(prisma);
      expect(gate.actual).toBe(completeBefore + 1);
      expect(gate.threshold).toBe(totalBefore + 1);
      expect(gate.status).toBe(completeBefore + 1 === totalBefore + 1 ? 'PASS' : 'FAIL');
    });

    it('a real ForecastRun missing wape/mase is correctly detected and fails the gate', async () => {
      const totalBefore = await prisma.forecastRun.count();
      const completeBefore = await prisma.forecastRun.count({ where: { wape: { not: null }, mase: { not: null } } });

      await prisma.forecastRun.create({ data: { targetType: 'GARAGE_WORKLOAD', targetId: 'gate-hist-incomplete-1', windowDays: 7, method: 'NAIVE', wape: null, mase: null } });

      const gate = await evaluateHistoricalMetricsGate(prisma);
      expect(gate.actual).toBe(completeBefore);
      expect(gate.threshold).toBe(totalBefore + 1);
      expect(gate.status).toBe('FAIL');
    });

    // DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2).
    // Baselines against a prior real call to the gate itself (not a raw
    // completeness count) — the gate's own "satisfied" definition now
    // includes validly-excluded rows, so any earlier test in this file
    // that already created a valid exclusion must be reflected in the
    // baseline too, not just rows with non-null wape/mase.
    it('a real ForecastRun with null wape/mase AND real, persisted zero-activity evidence is validly excluded (Amendment v1.1 §6A)', async () => {
      const before = await evaluateHistoricalMetricsGate(prisma);

      const created = await prisma.forecastRun.create({
        data: {
          targetType: 'GARAGE_WORKLOAD',
          targetId: 'gate-hist-excluded-1',
          windowDays: 7,
          method: 'NAIVE',
          wape: null,
          mase: null,
          evidence: { historyDays: 181, testHoldoutDays: 14, testActualSum: 0 },
        },
      });

      const gate = await evaluateHistoricalMetricsGate(prisma);
      // Excluded rows count toward completeness exactly like a real,
      // fully-persisted row would — the gate can still PASS.
      expect(gate.actual).toBe((before.actual as number) + 1);
      expect(gate.threshold).toBe((before.threshold as number) + 1);
      expect(gate.status).toBe(gate.actual === gate.threshold ? 'PASS' : 'FAIL');

      const audit = gate.auditTrail?.find((a) => a.forecastRunId === created.id);
      expect(audit).toBeDefined();
      expect(audit!.excluded).toBe(true);
      expect(audit!.conditions).toHaveLength(5);
      expect(audit!.conditions.every((c) => c.passed)).toBe(true);
    });

    it('a real ForecastRun with null wape/mase but real, persisted NON-zero activity evidence is NOT excluded and remains a failure', async () => {
      const before = await evaluateHistoricalMetricsGate(prisma);

      const created = await prisma.forecastRun.create({
        data: {
          targetType: 'GARAGE_WORKLOAD',
          targetId: 'gate-hist-not-excluded-1',
          windowDays: 7,
          method: 'NAIVE',
          wape: null,
          mase: null,
          evidence: { historyDays: 181, testHoldoutDays: 14, testActualSum: 17 },
        },
      });

      const gate = await evaluateHistoricalMetricsGate(prisma);
      expect(gate.actual).toBe(before.actual); // unchanged — the new row is not validly excluded
      expect(gate.threshold).toBe((before.threshold as number) + 1);
      expect(gate.status).toBe('FAIL');

      const audit = gate.auditTrail?.find((a) => a.forecastRunId === created.id);
      expect(audit).toBeDefined();
      expect(audit!.excluded).toBe(false);
    });

    it('excluded rows never disappear from the audit trail — every incomplete row is individually listed, excluded or not', async () => {
      const excludedRow = await prisma.forecastRun.create({
        data: { targetType: 'GARAGE_WORKLOAD', targetId: 'gate-hist-audit-a', windowDays: 7, method: 'NAIVE', wape: null, mase: null, evidence: { testActualSum: 0 } },
      });
      const notExcludedRow = await prisma.forecastRun.create({
        data: { targetType: 'GARAGE_WORKLOAD', targetId: 'gate-hist-audit-b', windowDays: 7, method: 'NAIVE', wape: null, mase: null },
      });

      const gate = await evaluateHistoricalMetricsGate(prisma);
      const ids = (gate.auditTrail ?? []).map((a) => a.forecastRunId);
      expect(ids).toContain(excludedRow.id);
      expect(ids).toContain(notExcludedRow.id);
    });
  });

  describe('evaluateObservabilityGate', () => {
    it('every real Sprint 2 forecast/recommendation metric is registered on a fresh, real MetricsService instance', async () => {
      const gate = await evaluateObservabilityGate();
      expect(gate.status).toBe('PASS');
      expect(gate.actual).toBe(gate.threshold);
    });
  });

  describe('evaluateIntegrationTestCoverage', () => {
    const realSrcRoot = path.join(__dirname, '..');

    it('reports PASS against the real, current src/ directory (every required integration-spec file genuinely exists)', () => {
      const gate = evaluateIntegrationTestCoverage(realSrcRoot);
      expect(gate.status).toBe('PASS');
      expect(gate.actual).toBe(gate.threshold);
    });

    it('reports FAIL against a real but unrelated directory lacking the required integration-spec files', () => {
      const gate = evaluateIntegrationTestCoverage(path.join(realSrcRoot, 'dgx2-certification'));
      expect(gate.status).toBe('FAIL');
      expect(gate.actual as number).toBeLessThan(gate.threshold as number);
    });
  });

  describe('evaluateDatasetIntegrityGate', () => {
    it('the real, frozen Certification Dataset v1 committed to the repository passes real integrity validation', () => {
      const datasetPath = path.join(__dirname, '..', '..', '..', '..', 'docs', 'certification', 'datasets', 'dgx2-certification-dataset-v1.json');
      expect(existsSync(datasetPath)).toBe(true);
      const dataset: Dgx2CertificationDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

      const { gate, validation } = evaluateDatasetIntegrityGate(dataset);
      expect(validation.checksumMatches).toBe(true);
      expect(gate.status).toBe('PASS');
    });

    it('a real dataset with a tampered checksum is correctly rejected', () => {
      const datasetPath = path.join(__dirname, '..', '..', '..', '..', 'docs', 'certification', 'datasets', 'dgx2-certification-dataset-v1.json');
      const dataset: Dgx2CertificationDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
      const tampered = { ...dataset, checksum: 'tampered' };

      const { gate } = evaluateDatasetIntegrityGate(tampered);
      expect(gate.status).toBe('FAIL');
    });
  });
});
