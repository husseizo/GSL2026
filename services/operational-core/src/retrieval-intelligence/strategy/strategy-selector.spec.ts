import { selectRetrievalStrategy } from './strategy-selector';
import { ClassifiedQuery } from '../query-understanding/query-classifier';

function classified(queryClass: ClassifiedQuery['queryClass']): ClassifiedQuery {
  return { queryClass, language: 'en', confidence: 0.9, matchedRule: 'test' };
}

describe('strategy-selector', () => {
  it('selects exact-match-first strategies for an identifier-shaped class, never running semantic search unnecessarily (spec §7)', () => {
    const selection = selectRetrievalStrategy(classified('OEM_PART_NUMBER'));
    expect(selection.strategies).toContain('EXACT_MATCH');
    expect(selection.strategies).not.toContain('SEMANTIC_SEARCH');
    expect(selection.strategies).not.toContain('VECTOR_SEARCH');
  });

  it('always includes permission/freshness/conflict-aware strategies regardless of query class', () => {
    for (const cls of ['OEM_PART_NUMBER', 'FREE_TEXT_QUESTION', 'UNKNOWN'] as const) {
      const selection = selectRetrievalStrategy(classified(cls));
      expect(selection.strategies).toEqual(expect.arrayContaining(['PERMISSION_AWARE_SEARCH', 'FRESHNESS_AWARE_SEARCH', 'CONFLICT_AWARE_SEARCH']));
    }
  });

  it('includes graph expansion on top of (never instead of) exact match for identifier classes, per spec §15', () => {
    const selection = selectRetrievalStrategy(classified('VEHICLE_VIN'));
    expect(selection.strategies).toContain('EXACT_MATCH');
    expect(selection.strategies).toContain('GRAPH_EXPANSION');
  });

  it('selects hybrid+semantic strategies for free-text/language classes', () => {
    const selection = selectRetrievalStrategy(classified('SWAHILI'));
    expect(selection.strategies).toContain('SEMANTIC_SEARCH');
    expect(selection.strategies).toContain('VECTOR_SEARCH');
  });

  it('falls back to plain vector search for UNKNOWN, never guessing a targeted strategy', () => {
    const selection = selectRetrievalStrategy(classified('UNKNOWN'));
    expect(selection.mode).toBe('VECTOR');
    expect(selection.strategies).not.toContain('EXACT_MATCH');
  });

  it('selects a fuzzy-fallback strategy set for TYPO queries', () => {
    const selection = selectRetrievalStrategy(classified('TYPO'));
    expect(selection.strategies).toContain('NORMALIZED_MATCH');
    expect(selection.strategies).toContain('VECTOR_SEARCH');
  });
});
