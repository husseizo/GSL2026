import { evaluateGates, allGatesPass } from './quality-gates';
import { CategoryMetricsMap } from '../categories/category-taxonomy';

const passingMetrics: CategoryMetricsMap = {
  RETRIEVAL: { category: 'RETRIEVAL', metrics: { recallAt1: 0.99, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 } },
  SAFETY: { category: 'SAFETY', metrics: { refusalAccuracy: 1, secretDisclosureCount: 0, casesScored: 5 } },
  GENERATION: {
    category: 'GENERATION',
    metrics: {
      avgGroundedness: 0.95,
      avgUnsupportedClaimRate: 0,
      structuredOutputValidityRate: 1,
      citation: { correctness: 0.99, completeness: 0.99, precision: 0.99, recall: 0.99, brokenCitationCount: 0, wrongCitationCount: 0, missingCitationCount: 0, casesScored: 5 },
      hallucination: { invalidOemRate: 0, invalidFitmentRate: 0, invalidLubricantApprovalRate: 0, invalidCompatibilityRate: 0, invalidCitationRate: 0, unsupportedDiagnosisRate: 0, unsupportedEquivalenceRate: 0, overallHallucinationRate: 0, casesScored: 5 },
      casesScored: 5,
    },
  },
  PERFORMANCE: { category: 'PERFORMANCE', metrics: { p50Ms: 10, p95Ms: 20, p99Ms: 30, casesScored: 10 } },
};

describe('evaluateGates', () => {
  it('passes all 7 gates when metrics clear every threshold and a human has approved', () => {
    const results = evaluateGates(passingMetrics, [], true);
    expect(results).toHaveLength(7);
    expect(allGatesPass(results)).toBe(true);
  });

  it('fails the RETRIEVAL gate when recallAt1 is below threshold', () => {
    const metrics: CategoryMetricsMap = { ...passingMetrics, RETRIEVAL: { category: 'RETRIEVAL', metrics: { ...passingMetrics.RETRIEVAL!.metrics, recallAt1: 0.5 } as never } };
    const results = evaluateGates(metrics, [], true);
    const retrievalGate = results.find((r) => r.gate === 'RETRIEVAL');
    expect(retrievalGate?.status).toBe('FAIL');
    expect(allGatesPass(results)).toBe(false);
  });

  it('fails the HUMAN_APPROVAL gate when no human has approved, even if every metric passes', () => {
    const results = evaluateGates(passingMetrics, [], false);
    const humanGate = results.find((r) => r.gate === 'HUMAN_APPROVAL');
    expect(humanGate?.status).toBe('FAIL');
    expect(allGatesPass(results)).toBe(false);
  });

  it('WAIVES a gate when its category was never run in this suite, rather than failing it', () => {
    const results = evaluateGates({}, [], true);
    expect(results.find((r) => r.gate === 'RETRIEVAL')?.status).toBe('WAIVED');
    expect(results.find((r) => r.gate === 'CITATION')?.status).toBe('WAIVED');
  });

  it('fails the REGRESSION gate when any category regressed', () => {
    const results = evaluateGates(passingMetrics, [{ category: 'RETRIEVAL', metrics: [], regressed: true }], true);
    expect(results.find((r) => r.gate === 'REGRESSION')?.status).toBe('FAIL');
  });
});
