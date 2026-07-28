import { validateCitations } from './citation-validator';

describe('validateCitations', () => {
  it('is correct when every cited id was actually retrieved', () => {
    const result = validateCitations(['a', 'b'], ['a', 'b', 'c']);
    expect(result.correct).toBe(true);
    expect(result.missingSourceIds).toHaveLength(0);
  });

  it('flags a fabricated citation not among the real retrieved documents', () => {
    const result = validateCitations(['a', 'z'], ['a', 'b']);
    expect(result.correct).toBe(false);
    expect(result.missingSourceIds).toEqual(['z']);
  });

  it('reports retrieved-but-uncited documents informationally, without affecting correctness', () => {
    const result = validateCitations(['a'], ['a', 'b', 'c']);
    expect(result.correct).toBe(true);
    expect(result.extraRetrievedNotCited).toEqual(['b', 'c']);
  });
});
