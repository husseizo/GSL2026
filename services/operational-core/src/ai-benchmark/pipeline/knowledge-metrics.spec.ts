import { computeKnowledgeMetrics } from './category-metrics';

describe('computeKnowledgeMetrics', () => {
  it('scores each sub-score independently, never blending them into one number', () => {
    const metrics = computeKnowledgeMetrics(
      [{ retrieved: [{ entityId: 'a' }], expectedEntityIds: ['a'] }],
      [{ resolvedToCurrentVersion: true }],
      [{ expectedApplicable: true, actualApplicable: false }],
      [{ rankedCorrectly: true }],
      [{ kind: 'EXPIRED', mustBeExcluded: true, actuallyExcluded: true }],
      [{ correct: true }],
      [{ correctValue: true, correctUnit: false }],
    );

    expect(metrics.retrieval.recallAt5).toBe(1);
    expect(metrics.supersession.supersessionAccuracy).toBe(1);
    expect(metrics.applicability.applicabilityPrecision).toBe(0);
    expect(metrics.authorityRanking.authorityRankingAccuracy).toBe(1);
    expect(metrics.expiredRestrictedExclusion.expiredExclusionRate).toBe(1);
    expect(metrics.graphRelation.relationAccuracy).toBe(1);
    expect(metrics.structuredFactExtraction.extractionAccuracy).toBe(1);
    expect(metrics.structuredFactExtraction.unitCorrectnessRate).toBe(0);
  });

  it('returns honest defaults (1) with zero samples in any sub-score, never a false failure', () => {
    const metrics = computeKnowledgeMetrics([], [], [], [], [], [], []);
    expect(metrics.retrieval.casesScored).toBe(0);
    expect(metrics.supersession.supersessionAccuracy).toBe(1);
  });

  it('scores expired and restricted exclusion independently, not blended', () => {
    const metrics = computeKnowledgeMetrics(
      [],
      [],
      [],
      [],
      [
        { kind: 'EXPIRED', mustBeExcluded: true, actuallyExcluded: true },
        { kind: 'RESTRICTED', mustBeExcluded: true, actuallyExcluded: false },
      ],
      [],
      [],
    );
    expect(metrics.expiredRestrictedExclusion.expiredExclusionRate).toBe(1);
    expect(metrics.expiredRestrictedExclusion.restrictedExclusionRate).toBe(0);
  });
});
