import { detectCategoryRegression, detectRegressions } from './regression-detector';
import { CategoryMetricsMap } from '../categories/category-taxonomy';

describe('detectCategoryRegression', () => {
  it('flags a real drop below the relative threshold for a HIGHER_IS_BETTER metric', () => {
    const result = detectCategoryRegression('RETRIEVAL', { recallAt1: 0.8, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 }, { recallAt1: 1, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 }, [{ metricPath: 'recallAt1', direction: 'HIGHER_IS_BETTER', maxRelativeDrop: 0.05 }]);
    expect(result.regressed).toBe(true);
    expect(result.metrics[0].regressed).toBe(true);
  });

  it('does not flag a change within the allowed threshold', () => {
    const result = detectCategoryRegression('RETRIEVAL', { recallAt1: 0.97, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 }, { recallAt1: 1, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 }, [{ metricPath: 'recallAt1', direction: 'HIGHER_IS_BETTER', maxRelativeDrop: 0.05 }]);
    expect(result.regressed).toBe(false);
  });

  it('flags a real increase beyond threshold for a LOWER_IS_BETTER metric', () => {
    const result = detectCategoryRegression(
      'GENERATION',
      { avgGroundedness: 1, avgUnsupportedClaimRate: 0.5, structuredOutputValidityRate: 1, citation: { correctness: 1, completeness: 1, precision: 1, recall: 1, brokenCitationCount: 0, wrongCitationCount: 0, missingCitationCount: 0, casesScored: 1 }, hallucination: { invalidOemRate: 0, invalidFitmentRate: 0, invalidLubricantApprovalRate: 0, invalidCompatibilityRate: 0, invalidCitationRate: 0, unsupportedDiagnosisRate: 0, unsupportedEquivalenceRate: 0, overallHallucinationRate: 0, casesScored: 1 }, casesScored: 10 },
      { avgGroundedness: 1, avgUnsupportedClaimRate: 0.1, structuredOutputValidityRate: 1, citation: { correctness: 1, completeness: 1, precision: 1, recall: 1, brokenCitationCount: 0, wrongCitationCount: 0, missingCitationCount: 0, casesScored: 1 }, hallucination: { invalidOemRate: 0, invalidFitmentRate: 0, invalidLubricantApprovalRate: 0, invalidCompatibilityRate: 0, invalidCitationRate: 0, unsupportedDiagnosisRate: 0, unsupportedEquivalenceRate: 0, overallHallucinationRate: 0, casesScored: 1 }, casesScored: 10 },
      [{ metricPath: 'avgUnsupportedClaimRate', direction: 'LOWER_IS_BETTER', maxRelativeDrop: 0.5 }],
    );
    expect(result.regressed).toBe(true);
  });
});

describe('detectRegressions', () => {
  it('produces one independent result per category present in both maps, never blended', () => {
    const current: CategoryMetricsMap = {
      RETRIEVAL: { category: 'RETRIEVAL', metrics: { recallAt1: 0.8, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 } },
    };
    const previous: CategoryMetricsMap = {
      RETRIEVAL: { category: 'RETRIEVAL', metrics: { recallAt1: 1, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 } },
    };
    const results = detectRegressions(current, previous);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe('RETRIEVAL');
    expect(results[0].regressed).toBe(true);
  });

  it('skips a category missing from either map rather than throwing', () => {
    const current: CategoryMetricsMap = { RETRIEVAL: { category: 'RETRIEVAL', metrics: { recallAt1: 1, recallAt3: 1, recallAt5: 1, mrr: 1, ndcgAt5: 1, exactNumberPreservationRate: 1, casesScored: 10 } } };
    const results = detectRegressions(current, {});
    expect(results).toHaveLength(0);
  });
});
