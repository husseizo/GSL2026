import { combineSignals, exactIdentifierAlwaysWins, DEFAULT_SIGNAL_WEIGHTS } from './ranking-engine';
import { HeuristicRankerProvider } from './ranker-provider.interface';

describe('ranking-engine', () => {
  it('produces a real per-signal explanation for every combined score, never a bare number', () => {
    const result = combineSignals({ EXACT_IDENTIFIER: 1, AUTHORITY: 0.5 });
    expect(result.explanation.length).toBe(Object.keys(DEFAULT_SIGNAL_WEIGHTS).length);
    expect(result.explanation.find((e) => e.signal === 'EXACT_IDENTIFIER')?.contribution).toBe(100);
  });

  it('an exact-identifier match always outranks a candidate with every other signal maxed but no exact match (spec §15 generalized)', () => {
    const exactMatch = combineSignals({ EXACT_IDENTIFIER: 1 });
    const nonExactMaxed = combineSignals({
      FIELD_MATCH: 1, AUTHORITY: 1, FRESHNESS: 1, APPROVAL_STATUS: 1, KNOWLEDGE_QUALITY: 1,
      GRAPH_DISTANCE: 1, STRUCTURED_FACT_CONFIDENCE: 1, CITATION_QUALITY: 1, REVIEW_STATUS: 1,
      CONFLICT_STATUS: 1, POPULARITY: 1, HISTORICAL_ACCURACY: 1, EMBEDDING_SIMILARITY: 1, BUSINESS_CONTEXT: 1,
    });
    expect(exactMatch.score).toBeGreaterThan(nonExactMaxed.score);
  });

  it('exactIdentifierAlwaysWins() structurally confirms the guarantee holds for the default weights', () => {
    expect(exactIdentifierAlwaysWins(DEFAULT_SIGNAL_WEIGHTS)).toBe(true);
  });

  it('honestly assigns zero weight to signals with no real data source in this environment (spec §8)', () => {
    expect(DEFAULT_SIGNAL_WEIGHTS.POPULARITY).toBe(0);
    expect(DEFAULT_SIGNAL_WEIGHTS.HISTORICAL_ACCURACY).toBe(0);
    expect(DEFAULT_SIGNAL_WEIGHTS.BUSINESS_CONTEXT).toBe(0);
  });

  it('missing signal values default to 0, never fabricating a value', () => {
    const result = combineSignals({});
    expect(result.score).toBe(0);
  });

  it('HeuristicRankerProvider (the LTR abstraction seam, spec §10) delegates to the same real combineSignals() logic', () => {
    const provider = new HeuristicRankerProvider();
    const result = provider.rank({ EXACT_IDENTIFIER: 1 });
    expect(result.score).toBe(100);
    expect(provider.name).toBe('HEURISTIC_WEIGHTED_SIGNALS');
  });
});
