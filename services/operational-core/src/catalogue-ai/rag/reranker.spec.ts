import { applyReranker, noRerank, reciprocalRankFusion } from './reranker';

describe('noRerank', () => {
  it('preserves the original order and does not mutate the input', () => {
    const input = [{ id: 'a', score: 0.9 }, { id: 'b', score: 0.5 }];
    const result = noRerank(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});

describe('reciprocalRankFusion', () => {
  it('ranks a candidate appearing near the top of both lists above one appearing in only one list', () => {
    const keywordList = [{ id: 'a', score: 1 }, { id: 'b', score: 0.9 }];
    const semanticList = [{ id: 'a', score: 0.95 }, { id: 'c', score: 0.9 }];
    const fused = reciprocalRankFusion([keywordList, semanticList]);
    expect(fused[0].id).toBe('a');
  });

  it('gives a real, higher fused score to a candidate present in both lists vs. one present in only one', () => {
    const fused = reciprocalRankFusion([
      [{ id: 'shared', score: 1 }, { id: 'only-in-first', score: 0.9 }],
      [{ id: 'shared', score: 1 }, { id: 'only-in-second', score: 0.9 }],
    ]);
    const shared = fused.find((c) => c.id === 'shared')!;
    const onlyInFirst = fused.find((c) => c.id === 'only-in-first')!;
    expect(shared.score).toBeGreaterThan(onlyInFirst.score);
  });
});

describe('applyReranker', () => {
  it('routes NO_RERANKER to the original order', () => {
    const input = [{ id: 'a', score: 0.9 }, { id: 'b', score: 0.5 }];
    expect(applyReranker('NO_RERANKER', [input])).toEqual(input);
  });

  it('routes RECIPROCAL_RANK_FUSION to the fusion function', () => {
    const result = applyReranker('RECIPROCAL_RANK_FUSION', [[{ id: 'a', score: 1 }], [{ id: 'a', score: 1 }]]);
    expect(result[0].id).toBe('a');
  });
});
