import { conflictDetectionAccuracy, exactNumberPreserved, meanReciprocalRank, ndcg, noAnswerPrecision, precisionAtK, reciprocalRank, recallAtK } from './retrieval-metrics';

describe('recallAtK', () => {
  it('is 1 when the only expected id is within the top K', () => {
    expect(recallAtK([{ entityId: 'a' }, { entityId: 'b' }], ['b'], 5)).toBe(1);
  });

  it('is 0 when the expected id falls outside the top K', () => {
    expect(recallAtK([{ entityId: 'a' }, { entityId: 'b' }], ['b'], 1)).toBe(0);
  });

  it('treats an empty expected set with no results as a correct no-answer (recall 1)', () => {
    expect(recallAtK([], [], 5)).toBe(1);
  });

  it('treats an empty expected set with results present as recall 0', () => {
    expect(recallAtK([{ entityId: 'a' }], [], 5)).toBe(0);
  });
});

describe('precisionAtK (AI Foundation Certification Sprint — spec §21)', () => {
  it('is 1 when every one of the top-K results is a real expected match', () => {
    expect(precisionAtK([{ entityId: 'a' }], ['a'], 1)).toBe(1);
  });

  it('is 0.5 when only half of the top-K results are real expected matches', () => {
    expect(precisionAtK([{ entityId: 'a' }, { entityId: 'x' }], ['a'], 2)).toBe(0.5);
  });

  it('divides by the real top-K slice size, not the expected-set size (distinct from recallAtK)', () => {
    expect(precisionAtK([{ entityId: 'a' }, { entityId: 'b' }, { entityId: 'c' }], ['a', 'b'], 3)).toBeCloseTo(2 / 3);
  });

  it('treats a correctly-empty top-K for a correctly-empty expected set as precision 1', () => {
    expect(precisionAtK([], [], 5)).toBe(1);
  });
});

describe('reciprocalRank / meanReciprocalRank', () => {
  it('gives 1.0 when the first result is correct', () => {
    expect(reciprocalRank([{ entityId: 'a' }], ['a'])).toBe(1);
  });

  it('gives 0.5 when the correct result is second', () => {
    expect(reciprocalRank([{ entityId: 'x' }, { entityId: 'a' }], ['a'])).toBe(0.5);
  });

  it('gives 0 when no expected id is retrieved at all', () => {
    expect(reciprocalRank([{ entityId: 'x' }], ['a'])).toBe(0);
  });

  it('averages reciprocal ranks across queries', () => {
    expect(meanReciprocalRank([1, 0.5, 0])).toBeCloseTo(0.5);
  });

  it('returns 0 for an empty set of queries', () => {
    expect(meanReciprocalRank([])).toBe(0);
  });
});

describe('ndcg', () => {
  it('is 1.0 for a perfectly ordered result set', () => {
    expect(ndcg([{ entityId: 'a' }, { entityId: 'b' }], ['a', 'b'], 5)).toBeCloseTo(1);
  });

  it('penalizes a relevant result ranked lower than an irrelevant one', () => {
    const perfect = ndcg([{ entityId: 'a' }, { entityId: 'x' }], ['a'], 5);
    const worse = ndcg([{ entityId: 'x' }, { entityId: 'a' }], ['a'], 5);
    expect(worse).toBeLessThan(perfect);
  });

  it('is 1.0 for a correct empty-expected/empty-retrieved no-answer case', () => {
    expect(ndcg([], [], 5)).toBe(1);
  });
});

describe('exactNumberPreserved', () => {
  it('is true when the expected identifier string appears verbatim among retrieved identifiers', () => {
    expect(exactNumberPreserved({ queryIdentifier: '04E-115-561-H', retrievedIdentifiers: ['04E115561H'], expectedIdentifier: '04E115561H' })).toBe(true);
  });

  it('is false when the identifier was mangled or not returned', () => {
    expect(exactNumberPreserved({ queryIdentifier: '04E-115-561-H', retrievedIdentifiers: ['04E115561X'], expectedIdentifier: '04E115561H' })).toBe(false);
  });
});

describe('noAnswerPrecision', () => {
  it('is 1.0 when every claimed no-answer genuinely had no ground truth', () => {
    expect(noAnswerPrecision([{ expectedNoAnswer: true, systemSaidNoAnswer: true }])).toBe(1);
  });

  it('penalizes wrongly declining to answer a query that did have a real ground truth', () => {
    expect(noAnswerPrecision([{ expectedNoAnswer: false, systemSaidNoAnswer: true }])).toBe(0);
  });

  it('defaults to 1.0 when the system never claimed no-answer at all', () => {
    expect(noAnswerPrecision([{ expectedNoAnswer: true, systemSaidNoAnswer: false }])).toBe(1);
  });
});

describe('conflictDetectionAccuracy', () => {
  it('is 1.0 when every conflict case is correctly classified', () => {
    expect(conflictDetectionAccuracy([{ expectedConflict: true, systemFlaggedConflict: true }, { expectedConflict: false, systemFlaggedConflict: false }])).toBe(1);
  });

  it('is 0.5 when half the cases are misclassified', () => {
    expect(conflictDetectionAccuracy([{ expectedConflict: true, systemFlaggedConflict: true }, { expectedConflict: true, systemFlaggedConflict: false }])).toBe(0.5);
  });

  it('defaults to 1.0 for an empty case list', () => {
    expect(conflictDetectionAccuracy([])).toBe(1);
  });
});
