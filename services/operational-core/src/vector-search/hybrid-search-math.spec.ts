import { keywordScore, mergeWeightedScores } from './hybrid-search-math';

describe('keywordScore', () => {
  it('scores higher for a chunk that matches more query terms', () => {
    const matching = keywordScore('Replace ignition coil BMW N20 misfire P0301', 'ignition coil misfire');
    const nonMatching = keywordScore('Check tyre pressure and tread depth', 'ignition coil misfire');
    expect(matching).toBeGreaterThan(nonMatching);
  });

  it('returns 0 for an empty query', () => {
    expect(keywordScore('some text', '')).toBe(0);
  });

  it('returns 0 when nothing matches', () => {
    expect(keywordScore('completely unrelated text', 'ignition coil')).toBe(0);
  });
});

describe('mergeWeightedScores', () => {
  it('combines semantic and keyword scores with the configured weights', () => {
    const semantic = [{ chunkId: 'a', score: 0.9 }, { chunkId: 'b', score: 0.1 }];
    const keyword = [{ chunkId: 'a', score: 0.1 }, { chunkId: 'b', score: 0.9 }];
    const merged = mergeWeightedScores(semantic, keyword, { semantic: 0.8, keyword: 0.2 });
    expect(merged[0].chunkId).toBe('a'); // semantic-dominant weighting favors 'a'
  });

  it('ranks a chunk present in both lists above one present in only one', () => {
    const semantic = [{ chunkId: 'a', score: 0.8 }, { chunkId: 'b', score: 0.75 }];
    const keyword = [{ chunkId: 'a', score: 0.8 }];
    const merged = mergeWeightedScores(semantic, keyword);
    expect(merged[0].chunkId).toBe('a');
  });

  it('handles empty inputs without throwing', () => {
    expect(mergeWeightedScores([], [])).toEqual([]);
  });
});
