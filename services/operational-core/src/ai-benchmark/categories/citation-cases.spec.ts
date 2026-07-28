import { computeCitationSubScore } from './citation-cases';

describe('computeCitationSubScore', () => {
  it('returns perfect scores with zero samples rather than dividing by zero', () => {
    const score = computeCitationSubScore([]);
    expect(score.correctness).toBe(1);
    expect(score.completeness).toBe(1);
    expect(score.casesScored).toBe(0);
  });

  it('flags a real wrong citation (cited but not retrieved) via wrongCitationCount', () => {
    const score = computeCitationSubScore([{ citedSourceIds: ['a', 'fabricated'], retrievedSourceIds: ['a'], materialSourceIds: ['a'] }]);
    expect(score.wrongCitationCount).toBe(1);
    expect(score.correctness).toBe(0.5);
  });

  it('flags a real missing citation (material source never cited)', () => {
    const score = computeCitationSubScore([{ citedSourceIds: [], retrievedSourceIds: ['a'], materialSourceIds: ['a'] }]);
    expect(score.missingCitationCount).toBe(1);
    expect(score.completeness).toBe(0);
  });
});
