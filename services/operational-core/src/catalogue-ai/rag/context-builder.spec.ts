import { buildContext, ContextCandidate } from './context-builder';

function candidate(overrides: Partial<ContextCandidate>): ContextCandidate {
  return {
    documentId: 'doc-1',
    documentTitle: 'Test Document',
    text: 'some evidence text',
    score: 0.8,
    sourceType: 'PARTS_DOCUMENTATION',
    confidence: 1.0,
    isApproved: true,
    hasConflict: false,
    ...overrides,
  };
}

describe('buildContext', () => {
  it('groups a high-confidence approved candidate as VERIFIED_FACTS', () => {
    const built = buildContext([candidate({ documentId: 'a', confidence: 1.0, isApproved: true })], 5);
    expect(built.sectionCounts.VERIFIED_FACTS).toBe(1);
    expect(built.renderedText).toContain('Verified facts');
  });

  it('groups a low-confidence or unapproved candidate as CANDIDATE_MATCHES, never VERIFIED_FACTS', () => {
    const built = buildContext([candidate({ documentId: 'a', confidence: 0.6, isApproved: true })], 5);
    expect(built.sectionCounts.CANDIDATE_MATCHES).toBe(1);
    expect(built.sectionCounts.VERIFIED_FACTS).toBe(0);
  });

  it('a conflicted candidate is always placed in CONFLICT_EVIDENCE, even with high confidence', () => {
    const built = buildContext([candidate({ documentId: 'a', confidence: 1.0, isApproved: true, hasConflict: true })], 5);
    expect(built.sectionCounts.CONFLICT_EVIDENCE).toBe(1);
    expect(built.sectionCounts.VERIFIED_FACTS).toBe(0);
  });

  it('groups a lubricant-sourced candidate as LUBRICANT_APPROVAL_EVIDENCE', () => {
    const built = buildContext([candidate({ documentId: 'a', sourceType: 'LUBRICANT_DOCUMENTATION' })], 5);
    expect(built.sectionCounts.LUBRICANT_APPROVAL_EVIDENCE).toBe(1);
  });

  it('context minimization keeps only the top N candidates', () => {
    const candidates = [candidate({ documentId: 'a' }), candidate({ documentId: 'b' }), candidate({ documentId: 'c' })];
    const built = buildContext(candidates, 2);
    expect(built.includedDocumentIds).toEqual(['a', 'b']);
    expect(built.excludedDocumentIds).toEqual(['c']);
  });

  it('reports missing information when there are no candidates at all', () => {
    const built = buildContext([], 5);
    expect(built.renderedText).toContain('Missing information');
    expect(built.includedDocumentIds).toHaveLength(0);
  });
});
