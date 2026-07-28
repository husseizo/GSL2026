import { TokenOverlapSimilarityScorer } from './similarity-scorer';

describe('TokenOverlapSimilarityScorer', () => {
  const scorer = new TokenOverlapSimilarityScorer();

  it('returns 1 for identical standardized names', () => {
    expect(scorer.score('brake pad front bmw', 'brake pad front bmw')).toBe(1);
  });

  it('returns 0 for completely disjoint names', () => {
    expect(scorer.score('brake pad front', 'engine oil filter')).toBe(0);
  });

  it('returns partial overlap proportionally (Jaccard)', () => {
    // shared: {brake, pad} = 2, union: {brake, pad, front, rear} = 4 -> 0.5
    expect(scorer.score('brake pad front', 'brake pad rear')).toBeCloseTo(0.5);
  });

  it('returns 0 when either input is empty', () => {
    expect(scorer.score('', 'brake pad')).toBe(0);
    expect(scorer.score('brake pad', '')).toBe(0);
  });
});
