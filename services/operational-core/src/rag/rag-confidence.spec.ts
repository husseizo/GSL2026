import { computeRetrievalConfidence } from './rag-confidence';

describe('computeRetrievalConfidence', () => {
  it('returns NONE for an empty score list', () => {
    expect(computeRetrievalConfidence([])).toEqual({ level: 'NONE', topScore: 0 });
  });

  it('returns HIGH for a strong top score (real matching-query measurement was 0.80)', () => {
    expect(computeRetrievalConfidence([0.8, 0.4]).level).toBe('HIGH');
  });

  it('returns MEDIUM for a moderate top score', () => {
    expect(computeRetrievalConfidence([0.55]).level).toBe('MEDIUM');
  });

  it('returns LOW for scores in the measured unrelated-query baseline range (0.4-0.5)', () => {
    expect(computeRetrievalConfidence([0.45]).level).toBe('LOW');
  });

  it('returns NONE at or below the baseline floor', () => {
    expect(computeRetrievalConfidence([0.35]).level).toBe('NONE');
  });

  it('uses the maximum score, not the average', () => {
    expect(computeRetrievalConfidence([0.9, 0.01, 0.02]).topScore).toBe(0.9);
  });
});
