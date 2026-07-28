import { evaluateHistoricalMetricsExclusion } from './historical-metrics-exclusion';

// DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2).
// Pure unit coverage — no DB, no I/O. Proves the five-condition test
// (docs/certification/DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md §6A)
// is conjunctive (all five required), deterministic, and rejects every
// prohibited ground from §6B.
describe('evaluateHistoricalMetricsExclusion', () => {
  it('excludes a row satisfying all five conditions: both metrics undefined, real, persisted zero-activity evidence', () => {
    const result = evaluateHistoricalMetricsExclusion({
      id: 'run-1',
      wape: null,
      mase: null,
      evidence: { historyDays: 181, testHoldoutDays: 14, testActualSum: 0 },
    });
    expect(result.excluded).toBe(true);
    expect(result.conditions.every((c) => c.passed)).toBe(true);
    expect(result.conditions).toHaveLength(5);
  });

  it('does NOT exclude a row where a real, defined WAPE value is present (fails MATHEMATICALLY_UNDEFINED and NO_SUPPRESSION_OR_FABRICATION)', () => {
    const result = evaluateHistoricalMetricsExclusion({
      id: 'run-2',
      wape: 12.5,
      mase: null,
      evidence: { testActualSum: 0 },
    });
    expect(result.excluded).toBe(false);
    const undefinedCondition = result.conditions.find((c) => c.condition === 'MATHEMATICALLY_UNDEFINED')!;
    expect(undefinedCondition.passed).toBe(false);
    const fabricationCondition = result.conditions.find((c) => c.condition === 'NO_SUPPRESSION_OR_FABRICATION')!;
    expect(fabricationCondition.passed).toBe(false);
  });

  it('does NOT exclude a row with no persisted testActualSum evidence at all (legacy row predating the Amendment)', () => {
    const result = evaluateHistoricalMetricsExclusion({ id: 'run-3', wape: null, mase: null, evidence: null });
    expect(result.excluded).toBe(false);
    const zeroActivityCondition = result.conditions.find((c) => c.condition === 'VERIFIED_ZERO_BUSINESS_ACTIVITY')!;
    expect(zeroActivityCondition.passed).toBe(false);
    const preservedCondition = result.conditions.find((c) => c.condition === 'EVIDENCE_PRESERVED')!;
    expect(preservedCondition.passed).toBe(false);
  });

  it('does NOT exclude a row where persisted testActualSum is a real, non-zero value (real business activity existed)', () => {
    const result = evaluateHistoricalMetricsExclusion({
      id: 'run-4',
      wape: null,
      mase: null,
      evidence: { testActualSum: 42 },
    });
    expect(result.excluded).toBe(false);
    const zeroActivityCondition = result.conditions.find((c) => c.condition === 'VERIFIED_ZERO_BUSINESS_ACTIVITY')!;
    expect(zeroActivityCondition.passed).toBe(false);
  });

  it('does NOT exclude a row whose evidence object exists but omits testActualSum entirely', () => {
    const result = evaluateHistoricalMetricsExclusion({
      id: 'run-5',
      wape: null,
      mase: null,
      evidence: { historyDays: 90, testHoldoutDays: 14 },
    });
    expect(result.excluded).toBe(false);
  });

  it('does NOT exclude a row whose evidence field is a non-object (malformed) value', () => {
    const result = evaluateHistoricalMetricsExclusion({ id: 'run-6', wape: null, mase: null, evidence: 'not-an-object' });
    expect(result.excluded).toBe(false);
  });

  it('does NOT exclude a row where testActualSum is present but not a finite number', () => {
    const result = evaluateHistoricalMetricsExclusion({
      id: 'run-7',
      wape: null,
      mase: null,
      evidence: { testActualSum: NaN },
    });
    expect(result.excluded).toBe(false);
  });

  it('is deterministic — evaluating the same real row twice always yields the same result', () => {
    const row = { id: 'run-8', wape: null, mase: null, evidence: { testActualSum: 0 } };
    const first = evaluateHistoricalMetricsExclusion(row);
    const second = evaluateHistoricalMetricsExclusion(row);
    expect(first).toEqual(second);
  });

  it('always reports exactly the five named conditions, in every case, whether excluded or not', () => {
    const excluded = evaluateHistoricalMetricsExclusion({ id: 'a', wape: null, mase: null, evidence: { testActualSum: 0 } });
    const notExcluded = evaluateHistoricalMetricsExclusion({ id: 'b', wape: 1, mase: 1, evidence: null });
    const expectedNames = ['MATHEMATICALLY_UNDEFINED', 'VERIFIED_ZERO_BUSINESS_ACTIVITY', 'EVIDENCE_PRESERVED', 'NO_SUPPRESSION_OR_FABRICATION', 'DETERMINISTIC_AND_AUDITABLE'];
    expect(excluded.conditions.map((c) => c.condition)).toEqual(expectedNames);
    expect(notExcluded.conditions.map((c) => c.condition)).toEqual(expectedNames);
  });

  it('never excludes a row with only one metric missing (a real, partial-defect signature, not a 0/0 signature)', () => {
    const wapeOnlyMissing = evaluateHistoricalMetricsExclusion({ id: 'run-9', wape: null, mase: 0.8, evidence: { testActualSum: 0 } });
    const maseOnlyMissing = evaluateHistoricalMetricsExclusion({ id: 'run-10', wape: 12, mase: null, evidence: { testActualSum: 0 } });
    expect(wapeOnlyMissing.excluded).toBe(false);
    expect(maseOnlyMissing.excluded).toBe(false);
  });

  it('carries the real forecastRunId through into the result for audit traceability', () => {
    const result = evaluateHistoricalMetricsExclusion({ id: 'trace-me-123', wape: null, mase: null, evidence: { testActualSum: 0 } });
    expect(result.forecastRunId).toBe('trace-me-123');
  });
});
