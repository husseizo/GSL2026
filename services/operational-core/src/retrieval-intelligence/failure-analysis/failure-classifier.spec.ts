import { classifyRetrievalFailure, FailureClassificationInput } from './failure-classifier';

function baseInput(overrides: Partial<FailureClassificationInput> = {}): FailureClassificationInput {
  return {
    expectedEntityId: 'part-1',
    expectedNoAnswer: false,
    topCandidateId: 'part-1',
    candidateRank: 0,
    candidateCount: 1,
    isIdentifierClass: true,
    hasEmbeddingScore: true,
    graphExpansionExpected: false,
    graphExpansionRan: false,
    hasActiveSnapshot: true,
    citationResolved: true,
    permissionDenied: false,
    hasOpenConflict: false,
    freshnessExcluded: false,
    ...overrides,
  };
}

describe('failure-classifier', () => {
  it('returns null when the expected entity was correctly returned in first place', () => {
    expect(classifyRetrievalFailure(baseInput())).toBeNull();
  });

  it('returns null for a correctly-empty no-answer case', () => {
    expect(classifyRetrievalFailure(baseInput({ expectedNoAnswer: true, expectedEntityId: null, candidateCount: 0, candidateRank: null, topCandidateId: null, isIdentifierClass: false }))).toBeNull();
  });

  it('classifies a real permission denial before any other cause', () => {
    expect(classifyRetrievalFailure(baseInput({ candidateRank: 1, permissionDenied: true }))).toBe('PERMISSION_ERROR');
  });

  it('classifies a real no-answer-expected case that returned false results as FALSE_RESULT', () => {
    expect(classifyRetrievalFailure(baseInput({ expectedNoAnswer: true, expectedEntityId: null, candidateCount: 1, candidateRank: null, isIdentifierClass: false }))).toBe('FALSE_RESULT');
  });

  it('classifies a real answer-expected case that returned nothing as NO_RESULT', () => {
    expect(classifyRetrievalFailure(baseInput({ candidateCount: 0, candidateRank: null, topCandidateId: null }))).toBe('NO_RESULT');
  });

  it('classifies a wrong top identifier match as WRONG_IDENTIFIER', () => {
    expect(classifyRetrievalFailure(baseInput({ topCandidateId: 'part-2', candidateRank: 3 }))).toBe('WRONG_IDENTIFIER');
  });

  it('classifies a correctly-present-but-lower-ranked non-identifier result as WRONG_RANKING', () => {
    expect(classifyRetrievalFailure(baseInput({ isIdentifierClass: false, candidateRank: 2, topCandidateId: 'part-2' }))).toBe('WRONG_RANKING');
  });

  it('classifies a missing embedding for a non-identifier class as MISSING_EMBEDDING', () => {
    expect(classifyRetrievalFailure(baseInput({ isIdentifierClass: false, hasEmbeddingScore: false, candidateRank: 1, topCandidateId: 'part-2' }))).toBe('MISSING_EMBEDDING');
  });

  it('classifies an unresolved citation as WRONG_CITATION', () => {
    expect(classifyRetrievalFailure(baseInput({ candidateRank: 1, citationResolved: false }))).toBe('WRONG_CITATION');
  });

  it('classifies an open conflict as CONFLICT_ERROR', () => {
    expect(classifyRetrievalFailure(baseInput({ candidateRank: 1, hasOpenConflict: true }))).toBe('CONFLICT_ERROR');
  });
});
