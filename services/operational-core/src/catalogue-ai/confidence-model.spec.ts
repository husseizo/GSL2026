import { computeCatalogueConfidence } from './confidence-model';

describe('computeCatalogueConfidence', () => {
  it('returns CONFLICTING whenever hasConflict is true, overriding everything else', () => {
    const result = computeCatalogueConfidence({ matchType: 'EXACT_OEM', sourceCount: 3, hasConflict: true, isVerified: true, manualReviewPending: false });
    expect(result.level).toBe('CONFLICTING');
  });

  it('returns INSUFFICIENT_EVIDENCE when there is no match type', () => {
    const result = computeCatalogueConfidence({ matchType: null, sourceCount: 0, hasConflict: false, isVerified: false, manualReviewPending: false });
    expect(result.level).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('returns VERIFIED only for an exact match against a verified canonical record', () => {
    const result = computeCatalogueConfidence({ matchType: 'EXACT_OEM', sourceCount: 1, hasConflict: false, isVerified: true, manualReviewPending: false });
    expect(result.level).toBe('VERIFIED');
  });

  it('returns HIGH (not VERIFIED) for an exact match that is not yet verified', () => {
    const result = computeCatalogueConfidence({ matchType: 'EXACT_OEM', sourceCount: 1, hasConflict: false, isVerified: false, manualReviewPending: false });
    expect(result.level).toBe('HIGH');
  });

  it('returns HIGH for a verified supersession/fitment relationship', () => {
    const result = computeCatalogueConfidence({ matchType: 'VERIFIED_SUPERSESSION', sourceCount: 1, hasConflict: false, isVerified: false, manualReviewPending: false });
    expect(result.level).toBe('HIGH');
  });

  it('returns LOW when a manual review is pending, even with an otherwise-decent match', () => {
    const result = computeCatalogueConfidence({ matchType: 'SEMANTIC_MATCH', sourceCount: 1, hasConflict: false, isVerified: false, manualReviewPending: true, retrievalScore: 0.9 });
    expect(result.level).toBe('LOW');
  });

  it('returns MEDIUM for a semantic match with a strong retrieval score', () => {
    const result = computeCatalogueConfidence({ matchType: 'SEMANTIC_MATCH', sourceCount: 1, hasConflict: false, isVerified: false, manualReviewPending: false, retrievalScore: 0.7 });
    expect(result.level).toBe('MEDIUM');
  });

  it('returns LOW for a semantic match below the 0.65 retrieval-score threshold', () => {
    const result = computeCatalogueConfidence({ matchType: 'SEMANTIC_MATCH', sourceCount: 1, hasConflict: false, isVerified: false, manualReviewPending: false, retrievalScore: 0.5 });
    expect(result.level).toBe('LOW');
  });

  it('returns LOW for a possible-alternative match type with no other signal', () => {
    const result = computeCatalogueConfidence({ matchType: 'POSSIBLE_ALTERNATIVE', sourceCount: 1, hasConflict: false, isVerified: false, manualReviewPending: false });
    expect(result.level).toBe('LOW');
  });

  it('always attaches human-readable reasons', () => {
    const result = computeCatalogueConfidence({ matchType: 'EXACT_OEM', sourceCount: 2, hasConflict: false, isVerified: true, manualReviewPending: false });
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
