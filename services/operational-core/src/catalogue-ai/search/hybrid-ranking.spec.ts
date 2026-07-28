import { isExactTier, rankHybridResults } from './hybrid-ranking';

describe('rankHybridResults', () => {
  it('never lets a SEMANTIC_MATCH outrank an EXACT_OEM match, regardless of score', () => {
    const ranked = rankHybridResults([
      { canonicalEntityId: 'semantic-hit', matchType: 'SEMANTIC_MATCH', matchScore: 0.99 },
      { canonicalEntityId: 'exact-hit', matchType: 'EXACT_OEM', matchScore: 0.5 },
    ]);
    expect(ranked[0].canonicalEntityId).toBe('exact-hit');
  });

  it('orders strictly by match-type tier', () => {
    const ranked = rankHybridResults([
      { canonicalEntityId: 'keyword', matchType: 'KEYWORD_MATCH', matchScore: 0.5 },
      { canonicalEntityId: 'internal', matchType: 'EXACT_INTERNAL_CODE', matchScore: 0.1 },
      { canonicalEntityId: 'oem', matchType: 'EXACT_OEM', matchScore: 0.1 },
    ]);
    expect(ranked.map((r) => r.canonicalEntityId)).toEqual(['internal', 'oem', 'keyword']);
  });

  it('uses matchScore only as a tiebreaker within the same tier', () => {
    const ranked = rankHybridResults([
      { canonicalEntityId: 'lower', matchType: 'SEMANTIC_MATCH', matchScore: 0.4 },
      { canonicalEntityId: 'higher', matchType: 'SEMANTIC_MATCH', matchScore: 0.8 },
    ]);
    expect(ranked.map((r) => r.canonicalEntityId)).toEqual(['higher', 'lower']);
  });

  it('does not mutate the input array', () => {
    const input = [{ canonicalEntityId: 'a', matchType: 'SEMANTIC_MATCH' as const, matchScore: 0.1 }];
    const ranked = rankHybridResults(input);
    expect(ranked).not.toBe(input);
  });
});

describe('isExactTier', () => {
  it('treats exact identifier/supersession/fitment match types as exact tier', () => {
    expect(isExactTier('EXACT_OEM')).toBe(true);
    expect(isExactTier('EXACT_TECDOC')).toBe(true);
  });

  it('treats keyword/semantic/possible/conflicting match types as non-exact', () => {
    expect(isExactTier('SEMANTIC_MATCH')).toBe(false);
    expect(isExactTier('KEYWORD_MATCH')).toBe(false);
    expect(isExactTier('CONFLICTING_MATCH')).toBe(false);
  });
});
