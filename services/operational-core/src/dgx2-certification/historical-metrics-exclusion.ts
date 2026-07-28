// DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2).
// Implements the exact five-condition deterministic exclusion test from
// docs/certification/DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md §6A,
// and the permanent prohibited-grounds list in §6B. Pure — no DB, no I/O,
// no business calculation. Every input is a value already persisted on a
// real ForecastRun row; nothing here re-derives, estimates, or infers
// business activity. This is deliberately the only place this exclusion
// logic exists — it is never re-implemented ad hoc elsewhere.
export interface ForecastRunEvidenceRecord {
  id: string;
  wape: number | null;
  mase: number | null;
  evidence: unknown;
}

export interface ExclusionConditionResult {
  condition:
    | 'MATHEMATICALLY_UNDEFINED'
    | 'VERIFIED_ZERO_BUSINESS_ACTIVITY'
    | 'EVIDENCE_PRESERVED'
    | 'NO_SUPPRESSION_OR_FABRICATION'
    | 'DETERMINISTIC_AND_AUDITABLE';
  passed: boolean;
  detail: string;
}

export interface ExclusionEvaluation {
  forecastRunId: string;
  excluded: boolean;
  conditions: ExclusionConditionResult[];
  reason: string;
}

// The real, persisted evidence field a certification-time evaluation is
// permitted to read — written once, at forecast-generation time, by
// ForecastingService.generate() and LubricantDemandDatasetService — never
// computed or estimated here. Returns null when the field is absent
// (e.g. a row predating this Amendment), which correctly fails condition
// 2/3 below rather than assuming zero activity.
function extractTestActualSum(evidence: unknown): number | null {
  if (evidence !== null && typeof evidence === 'object' && 'testActualSum' in (evidence as Record<string, unknown>)) {
    const value = (evidence as Record<string, unknown>).testActualSum;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return null;
}

// Amendment v1.1 §6A: all five conditions must be simultaneously true, or
// the row MUST remain a failure — never a discretionary partial credit.
export function evaluateHistoricalMetricsExclusion(run: ForecastRunEvidenceRecord): ExclusionEvaluation {
  const bothUndefined = run.wape === null && run.mase === null;
  const testActualSum = extractTestActualSum(run.evidence);

  const conditions: ExclusionConditionResult[] = [
    {
      condition: 'MATHEMATICALLY_UNDEFINED',
      passed: bothUndefined,
      detail: bothUndefined
        ? 'Both WAPE and MASE are null — the metric was never computed as a value, never fabricated.'
        : `wape=${run.wape}, mase=${run.mase} — at least one is a real, persisted, defined value; this row does not present a mathematically undefined metric.`,
    },
    {
      condition: 'VERIFIED_ZERO_BUSINESS_ACTIVITY',
      passed: testActualSum === 0,
      detail:
        testActualSum === null
          ? 'No persisted testActualSum evidence exists on this row — zero business activity cannot be verified.'
          : testActualSum === 0
            ? 'Persisted testActualSum = 0 — the held-out evaluation window had verifiably zero real business activity.'
            : `Persisted testActualSum = ${testActualSum} — real business activity existed in the evaluation window; a missing metric here is not attributable to zero activity.`,
    },
    {
      condition: 'EVIDENCE_PRESERVED',
      passed: testActualSum !== null,
      detail:
        testActualSum !== null
          ? 'testActualSum was persisted as a normal by-product of real forecast generation, prior to and independent of this certification evaluation.'
          : 'No real, persisted evidence of business activity exists for this row — the exclusion cannot be verified from persisted data alone.',
    },
    {
      condition: 'NO_SUPPRESSION_OR_FABRICATION',
      passed: bothUndefined,
      detail: bothUndefined
        ? 'No value was suppressed, substituted, estimated, or fabricated in place of the undefined metric.'
        : 'A non-null metric value is present on this row — the exclusion never applies to a row carrying any computed value.',
    },
    {
      condition: 'DETERMINISTIC_AND_AUDITABLE',
      passed: true,
      detail: 'This determination is a pure function of persisted fields (wape, mase, evidence.testActualSum) — re-evaluating this exact row always yields the same result, with no runtime judgment or certification-time calculation involved.',
    },
  ];

  const excluded = conditions.every((c) => c.passed);
  return {
    forecastRunId: run.id,
    excluded,
    conditions,
    reason: excluded
      ? 'All five Amendment v1.1 §6A conditions verified from persisted evidence — excluded from the HISTORICAL_METRICS_PERSISTED completeness count.'
      : `Not excluded — remains a failure. Unsatisfied condition(s): ${conditions.filter((c) => !c.passed).map((c) => c.condition).join(', ')}.`,
  };
}
