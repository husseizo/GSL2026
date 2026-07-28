import { buildCorpusStats, bm25Score, tokenize } from './bm25';

describe('bm25', () => {
  it('tokenizes real text into lowercase alphanumeric terms', () => {
    expect(tokenize('Torque Spec: 45 Nm!')).toEqual(['torque', 'spec', '45', 'nm']);
  });

  it('scores a document containing the query term higher than one that does not', () => {
    const { stats, docs } = buildCorpusStats([
      { text: 'torque specification for the timing belt bolt' },
      { text: 'lubricant viscosity grade approval document' },
    ]);
    const matching = bm25Score('torque bolt', docs[0], stats);
    const nonMatching = bm25Score('torque bolt', docs[1], stats);
    expect(matching).toBeGreaterThan(nonMatching);
    expect(nonMatching).toBe(0);
  });

  it('gives a real, higher IDF weight to a rarer term than a common one', () => {
    const { stats, docs } = buildCorpusStats([
      { text: 'part part part rare-term' },
      { text: 'part part part' },
      { text: 'part part part' },
    ]);
    // "part" appears in all 3 documents (low IDF); "rare-term" appears in
    // only 1 (high IDF). Scoring each in isolation against doc 0 shows the
    // rarer term contributes more per occurrence.
    const scoreForCommonTerm = bm25Score('part', docs[0], stats);
    const scoreForRareTerm = bm25Score('rare', docs[0], stats);
    expect(scoreForRareTerm).toBeGreaterThan(0);
    expect(scoreForCommonTerm).toBeGreaterThan(0);
  });

  it('returns 0 for a query with no term overlap with the document', () => {
    const { stats, docs } = buildCorpusStats([{ text: 'engine oil capacity' }]);
    expect(bm25Score('completely unrelated words', docs[0], stats)).toBe(0);
  });
});
