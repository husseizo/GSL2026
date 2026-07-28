import { calculateVerdict, buildCertificationScorecard, ScorecardBuildInputs } from './scorecard';
import { GateResult } from './gate-evaluators';

// AI Foundation Certification Sprint — Phase II Sprint 3 (DGX 2.0
// Certification Scorecard). Pure unit coverage — no DB, no I/O. Every
// verdict boundary is exercised against real gate-shaped inputs; the
// verdict calculator itself never hardcodes PASS.
function gate(name: string, status: GateResult['status']): GateResult {
  return { gate: name, status, actual: null, threshold: null, reason: 'test' };
}

function baseInputs(overrides: Partial<ScorecardBuildInputs> = {}): ScorecardBuildInputs {
  return {
    datasetVersion: 'v1',
    forecastAccuracy: { chosenBestRunCount: 10, mape: 5, wape: 5, mase: 0.5, rmse: 2, bias: 0.1 },
    recommendations: { totalRecommendations: 10, accepted: 8, rejected: 2, approvalRatePct: 80, confidenceDistribution: { HIGH: 10 } },
    auditCoveragePct: 100,
    integrationCoveragePct: 100,
    observabilityCoveragePct: 100,
    gates: [
      gate('DATASET_INTEGRITY', 'PASS'),
      gate('SAFETY_SUPPLIER_ACTIVE', 'PASS'),
      gate('SAFETY_WAREHOUSE_CAPACITY', 'PASS'),
      gate('HUMAN_TRUST_EVIDENCE', 'PASS'),
      gate('HUMAN_TRUST_AUDIT_TRAIL', 'PASS'),
      gate('INTEGRATION_TEST_COVERAGE', 'PASS'),
      gate('FULL_TEST_SUITE', 'PASS'),
      gate('HISTORICAL_METRICS_PERSISTED', 'PASS'),
      gate('OBSERVABILITY_METRICS_REGISTERED', 'PASS'),
      gate('FORECAST_QUALITY_MASE', 'PASS'),
      gate('FORECAST_QUALITY_WAPE_REPORTED', 'PASS'),
    ],
    explainabilityStandardMet: false,
    ...overrides,
  };
}

describe('calculateVerdict', () => {
  it('returns NOT_READY when the DATASET_INTEGRITY gate fails, regardless of every other gate', () => {
    const inputs = baseInputs({ gates: baseInputs().gates.map((g) => (g.gate === 'DATASET_INTEGRITY' ? gate('DATASET_INTEGRITY', 'FAIL') : g)) });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('NOT_READY');
    expect(result.reason).toContain('integrity');
  });

  it('returns NOT_READY when any real Safety Gate fails', () => {
    const inputs = baseInputs({ gates: baseInputs().gates.map((g) => (g.gate === 'SAFETY_SUPPLIER_ACTIVE' ? gate('SAFETY_SUPPLIER_ACTIVE', 'FAIL') : g)) });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('NOT_READY');
    expect(result.reason).toContain('SAFETY_SUPPLIER_ACTIVE');
  });

  it('returns NOT_READY when any real Human Trust gate fails', () => {
    const inputs = baseInputs({ gates: baseInputs().gates.map((g) => (g.gate === 'HUMAN_TRUST_AUDIT_TRAIL' ? gate('HUMAN_TRUST_AUDIT_TRAIL', 'FAIL') : g)) });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('NOT_READY');
    expect(result.reason).toContain('HUMAN_TRUST_AUDIT_TRAIL');
  });

  it('returns NOT_READY when any other mandatory gate fails (e.g. integration test coverage)', () => {
    const inputs = baseInputs({ gates: baseInputs().gates.map((g) => (g.gate === 'INTEGRATION_TEST_COVERAGE' ? gate('INTEGRATION_TEST_COVERAGE', 'FAIL') : g)) });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('NOT_READY');
  });

  it('caps the verdict at LIMITED_PILOT when every gate passes but the Explainability Standard is not yet met', () => {
    const inputs = baseInputs({ explainabilityStandardMet: false });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('LIMITED_PILOT');
    expect(result.reason).toContain('Explainability');
  });

  it('caps the verdict at LIMITED_PILOT when the Explainability Standard is met but real MASE does not beat the naive baseline', () => {
    const inputs = baseInputs({ explainabilityStandardMet: true, forecastAccuracy: { ...baseInputs().forecastAccuracy, mase: 1.4 } });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('LIMITED_PILOT');
    expect(result.reason).toContain('MASE');
  });

  it('caps the verdict at LIMITED_PILOT when real MASE is null (not yet measurable)', () => {
    const inputs = baseInputs({ explainabilityStandardMet: true, forecastAccuracy: { ...baseInputs().forecastAccuracy, mase: null } });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('LIMITED_PILOT');
  });

  it('reaches PILOT_APPROVED only when all gates pass, Explainability is met, and real MASE beats the naive baseline', () => {
    const inputs = baseInputs({ explainabilityStandardMet: true, forecastAccuracy: { ...baseInputs().forecastAccuracy, mase: 0.5 } });
    const result = calculateVerdict(inputs);
    expect(result.verdict).toBe('PILOT_APPROVED');
  });

  it('never returns PRODUCTION_READY or ENTERPRISE_CERTIFIED — those require a real Pilot that has not occurred', () => {
    const inputs = baseInputs({ explainabilityStandardMet: true, forecastAccuracy: { ...baseInputs().forecastAccuracy, mase: 0.1 } });
    const result = calculateVerdict(inputs);
    expect(['NOT_READY', 'LIMITED_PILOT', 'PILOT_APPROVED']).toContain(result.verdict);
  });

  it('only ever returns one of the five supported verdict strings', () => {
    const supported = ['NOT_READY', 'LIMITED_PILOT', 'PILOT_APPROVED', 'PRODUCTION_READY', 'ENTERPRISE_CERTIFIED'];
    const scenarios: ScorecardBuildInputs[] = [
      baseInputs(),
      baseInputs({ explainabilityStandardMet: true }),
      baseInputs({ gates: [] }),
      baseInputs({ gates: baseInputs().gates.map((g) => gate(g.gate, 'WAIVED')) }),
    ];
    for (const s of scenarios) {
      expect(supported).toContain(calculateVerdict(s).verdict);
    }
  });
});

describe('buildCertificationScorecard', () => {
  it('assembles a real scorecard carrying through every input field plus the calculated verdict', () => {
    const inputs = baseInputs();
    const scorecard = buildCertificationScorecard(inputs);
    expect(scorecard.datasetVersion).toBe('v1');
    expect(scorecard.forecastAccuracy).toEqual(inputs.forecastAccuracy);
    expect(scorecard.recommendations).toEqual(inputs.recommendations);
    expect(scorecard.gates).toEqual(inputs.gates);
    expect(scorecard.overallVerdict).toBe('LIMITED_PILOT');
    expect(scorecard.generatedAt).toBeTruthy();
  });

  it('collects only the real, actually-failed gates into failedGates', () => {
    const failing = gate('SAFETY_SUPPLIER_ACTIVE', 'FAIL');
    const inputs = baseInputs({ gates: baseInputs().gates.map((g) => (g.gate === 'SAFETY_SUPPLIER_ACTIVE' ? failing : g)) });
    const scorecard = buildCertificationScorecard(inputs);
    expect(scorecard.failedGates).toEqual([failing]);
  });

  it('derives safetyGateStatus as FAIL when any real safety gate fails', () => {
    const inputs = baseInputs({ gates: baseInputs().gates.map((g) => (g.gate === 'SAFETY_WAREHOUSE_CAPACITY' ? gate('SAFETY_WAREHOUSE_CAPACITY', 'FAIL') : g)) });
    const scorecard = buildCertificationScorecard(inputs);
    expect(scorecard.safetyGateStatus).toBe('FAIL');
  });

  it('derives safetyGateStatus as WAIVED when there are no real safety gates in the input', () => {
    const inputs = baseInputs({ gates: baseInputs().gates.filter((g) => !g.gate.startsWith('SAFETY_')) });
    const scorecard = buildCertificationScorecard(inputs);
    expect(scorecard.safetyGateStatus).toBe('WAIVED');
  });
});
