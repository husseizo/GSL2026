// AI Foundation Certification Sprint — Phase II Sprint 3, Workstream 3.
// Pure — no DB, no I/O. Builds the structured Certification Scorecard and
// computes the Overall Verdict from real, already-gathered gate evidence.
// See DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md §22, §26.
import { GateResult, allGatesPass } from './gate-evaluators';

export type Dgx2CertificationVerdict = 'NOT_READY' | 'LIMITED_PILOT' | 'PILOT_APPROVED' | 'PRODUCTION_READY' | 'ENTERPRISE_CERTIFIED';

export interface RecommendationEvidenceSummary {
  totalRecommendations: number;
  accepted: number;
  rejected: number;
  approvalRatePct: number | null;
  confidenceDistribution: Record<string, number>;
}

export interface Dgx2CertificationScorecard {
  generatedAt: string;
  datasetVersion: string;
  forecastAccuracy: {
    chosenBestRunCount: number;
    mape: number | null;
    wape: number | null;
    mase: number | null;
    rmse: number | null;
    bias: number | null;
  };
  recommendations: RecommendationEvidenceSummary;
  auditCoveragePct: number | null;
  integrationCoveragePct: number;
  observabilityCoveragePct: number;
  safetyGateStatus: 'PASS' | 'FAIL' | 'WAIVED';
  gates: GateResult[];
  failedGates: GateResult[];
  overallVerdict: Dgx2CertificationVerdict;
  verdictReason: string;
}

export interface ScorecardBuildInputs {
  datasetVersion: string;
  forecastAccuracy: Dgx2CertificationScorecard['forecastAccuracy'];
  recommendations: RecommendationEvidenceSummary;
  auditCoveragePct: number | null;
  integrationCoveragePct: number;
  observabilityCoveragePct: number;
  gates: GateResult[];
  // Real, honest input, not a hardcoded assumption — the caller determines
  // this from real code inspection. As of this sprint, PurchaseRecommendation
  // has no narrative "why not another action" field (only structured
  // evidence + warnings), so the real, current value is always `false`
  // until that work (explicitly out of scope for Sprint 3) lands.
  explainabilityStandardMet: boolean;
}

function aggregateSafetyGateStatus(gates: GateResult[]): 'PASS' | 'FAIL' | 'WAIVED' {
  const safetyGates = gates.filter((g) => g.gate.startsWith('SAFETY_'));
  if (safetyGates.length === 0) return 'WAIVED';
  if (safetyGates.some((g) => g.status === 'FAIL')) return 'FAIL';
  if (safetyGates.every((g) => g.status === 'WAIVED')) return 'WAIVED';
  return 'PASS';
}

// Real verdict levels, computed strictly from real gate evidence — never
// asserted. Mirrors the exact level definitions in
// DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md §4/§22:
//   Bronze  -> LIMITED_PILOT   (Safety + Human Trust gates real and passing)
//   Silver  -> PILOT_APPROVED  (Bronze + real Forecast Accuracy thresholds
//                               met + the Explainability Standard fully met)
//   Gold    -> PRODUCTION_READY (Silver + real Business Value evidence over
//                                a real pilot period — not yet possible
//                                before a real Pilot has run)
//   Enterprise -> ENTERPRISE_CERTIFIED (Gold + multi-branch/warehouse
//                                       validation + continuous
//                                       re-certification actually running)
export function calculateVerdict(inputs: ScorecardBuildInputs): { verdict: Dgx2CertificationVerdict; reason: string } {
  const safetyGates = inputs.gates.filter((g) => g.gate.startsWith('SAFETY_'));
  const humanTrustGates = inputs.gates.filter((g) => g.gate.startsWith('HUMAN_TRUST_'));
  const datasetGate = inputs.gates.find((g) => g.gate === 'DATASET_INTEGRITY');

  if (datasetGate && datasetGate.status === 'FAIL') {
    return { verdict: 'NOT_READY', reason: 'The Certification Dataset itself failed integrity validation — no gate evaluated against it can be trusted.' };
  }
  if (safetyGates.some((g) => g.status === 'FAIL')) {
    return { verdict: 'NOT_READY', reason: `One or more Safety Gates failed: ${safetyGates.filter((g) => g.status === 'FAIL').map((g) => g.gate).join(', ')}.` };
  }
  if (humanTrustGates.some((g) => g.status === 'FAIL')) {
    return { verdict: 'NOT_READY', reason: `One or more Human Trust Gates failed: ${humanTrustGates.filter((g) => g.status === 'FAIL').map((g) => g.gate).join(', ')}.` };
  }
  if (!allGatesPass(inputs.gates)) {
    return { verdict: 'NOT_READY', reason: `One or more mandatory gates failed: ${inputs.gates.filter((g) => g.status === 'FAIL').map((g) => g.gate).join(', ')}.` };
  }

  // Bronze reached — every Safety Gate and Human Trust Gate is real and
  // passing (or honestly WAIVED for lack of real data yet).
  if (!inputs.explainabilityStandardMet) {
    return {
      verdict: 'LIMITED_PILOT',
      reason:
        'All Safety and Human Trust Gates pass — Bronze level reached. Silver (PILOT_APPROVED) additionally requires the Explainability Standard to be fully met (Certification Standard §15); real narrative "why not another action" explanations are not yet implemented (explicitly out of scope through Sprint 3) — this verdict is honestly capped at LIMITED_PILOT, not asserted higher.',
    };
  }

  const wapeMet = inputs.forecastAccuracy.mase !== null && inputs.forecastAccuracy.mase < 1;
  if (!wapeMet) {
    return { verdict: 'LIMITED_PILOT', reason: 'Explainability Standard is met, but real Forecast Accuracy (MASE) does not yet beat the naive baseline — capped at LIMITED_PILOT.' };
  }

  // Silver reached. Gold (PRODUCTION_READY) requires real Business Value
  // evidence measured over a real pilot period — structurally impossible
  // to claim before a real Pilot has actually run.
  return {
    verdict: 'PILOT_APPROVED',
    reason: 'Safety, Human Trust, and Forecast Accuracy gates pass and the Explainability Standard is met — Silver level reached. PRODUCTION_READY requires real, measured Business Value evidence from an actual Pilot period, which has not yet occurred.',
  };
}

export function buildCertificationScorecard(inputs: ScorecardBuildInputs): Dgx2CertificationScorecard {
  const { verdict, reason } = calculateVerdict(inputs);
  return {
    generatedAt: new Date().toISOString(),
    datasetVersion: inputs.datasetVersion,
    forecastAccuracy: inputs.forecastAccuracy,
    recommendations: inputs.recommendations,
    auditCoveragePct: inputs.auditCoveragePct,
    integrationCoveragePct: inputs.integrationCoveragePct,
    observabilityCoveragePct: inputs.observabilityCoveragePct,
    safetyGateStatus: aggregateSafetyGateStatus(inputs.gates),
    gates: inputs.gates,
    failedGates: inputs.gates.filter((g) => g.status === 'FAIL'),
    overallVerdict: verdict,
    verdictReason: reason,
  };
}
