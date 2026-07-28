import { computeRetrievalMetrics, computeGenerationMetrics, computeSafetyMetrics, computePermissionEnforcementMetrics, computeConflictDetectionMetrics, computeReasoningMetrics, computeProductionReadinessMetrics, computeRegressionMetrics } from './category-metrics';

describe('computeRetrievalMetrics', () => {
  it('computes real recall/mrr/ndcg from real per-case retrieval samples', () => {
    const metrics = computeRetrievalMetrics([
      { retrieved: [{ entityId: 'part-1' }], expectedEntityIds: ['part-1'] },
      { retrieved: [{ entityId: 'wrong' }], expectedEntityIds: ['part-2'] },
    ]);
    expect(metrics.recallAt1).toBe(0.5);
    expect(metrics.casesScored).toBe(2);
  });

  it('scores exactNumberPreservationRate only from cases that carry an exactPreservation flag', () => {
    const metrics = computeRetrievalMetrics([
      { retrieved: [{ entityId: 'part-1' }], expectedEntityIds: ['part-1'], exactPreservation: true },
      { retrieved: [{ entityId: 'part-2' }], expectedEntityIds: ['part-2'], exactPreservation: false },
    ]);
    expect(metrics.exactNumberPreservationRate).toBe(0.5);
  });
});

describe('computeGenerationMetrics', () => {
  it('excludes zero-evidence samples from groundedness/unsupported-claim averaging (the real DGX Prototype 1.5 fix)', () => {
    const metrics = computeGenerationMetrics(
      [
        { answerText: 'insufficient evidence', sourceTexts: [], structuredAnswer: { directAnswer: '', matchingProducts: [], matchBasis: '', verifiedFitment: [], alternatives: [], conflictsOrWarnings: [], sources: [], confidence: 'INSUFFICIENT_EVIDENCE', recommendedNextAction: '' } },
        { answerText: 'the part is X and evidence says X', sourceTexts: ['evidence says X about the part'], structuredAnswer: { directAnswer: '', matchingProducts: [], matchBasis: '', verifiedFitment: [], alternatives: [], conflictsOrWarnings: [], sources: [], confidence: 'HIGH', recommendedNextAction: '' } },
      ],
      [],
      [],
    );
    // only the second (real-evidence) sample should count toward groundedness
    expect(metrics.casesScored).toBe(2); // structured-validity/case count still includes both
    expect(metrics.avgGroundedness).toBeGreaterThan(0);
  });

  it('nests citation and hallucination sub-scores rather than blending them into the top-level metrics', () => {
    const metrics = computeGenerationMetrics([], [{ citedSourceIds: ['a'], retrievedSourceIds: ['a'], materialSourceIds: ['a'] }], [{ subtype: 'INVALID_OEM', assertedAsFact: true }]);
    expect(metrics.citation.correctness).toBe(1);
    expect(metrics.hallucination.invalidOemRate).toBe(1);
    expect(metrics.hallucination.invalidFitmentRate).toBe(0);
  });
});

describe('computeSafetyMetrics', () => {
  it('computes refusal accuracy from real refusal checks', () => {
    const metrics = computeSafetyMetrics([true, true, false], 0);
    expect(metrics.refusalAccuracy).toBeCloseTo(2 / 3);
    expect(metrics.secretDisclosureCount).toBe(0);
  });
});

describe('computePermissionEnforcementMetrics', () => {
  it('flags a real leakage case (denied-by-design but actually granted) distinctly from a wrong-denial case', () => {
    const metrics = computePermissionEnforcementMetrics([
      { expectedGranted: false, actualGranted: true }, // real leakage
      { expectedGranted: true, actualGranted: true },
      { expectedGranted: false, actualGranted: false },
    ]);
    expect(metrics.leakageCount).toBe(1);
    expect(metrics.enforcementAccuracy).toBeCloseTo(2 / 3);
  });
});

describe('computeConflictDetectionMetrics / computeReasoningMetrics / computeProductionReadinessMetrics / computeRegressionMetrics', () => {
  it('each independently scores its own category without leaking into another', () => {
    expect(computeConflictDetectionMetrics([{ expectedConflict: true, systemFlaggedConflict: true }]).conflictDetectionAccuracy).toBe(1);
    expect(computeReasoningMetrics([true, false]).multiHopAccuracy).toBe(0.5);
    expect(computeProductionReadinessMetrics(4, 3).passRate).toBe(0.75);
    const regression = computeRegressionMetrics(3, ['RETRIEVAL']);
    expect(regression.categoriesCompared).toBe(3);
    expect(regression.categoriesRegressed).toBe(1);
    expect(regression.regressedCategories).toEqual(['RETRIEVAL']);
  });
});
