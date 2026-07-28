import { citationCompleteness, citationCorrectness, groundednessScore, isValidStructuredAnswer, unsupportedTechnicalClaimRate } from './generation-metrics';

describe('citationCorrectness', () => {
  it('is 1.0 when every cited source was actually retrieved', () => {
    expect(citationCorrectness([{ citedSourceIds: ['a', 'b'], retrievedSourceIds: ['a', 'b', 'c'] }])).toBe(1);
  });

  it('penalizes a fabricated citation not among the real retrieved sources', () => {
    expect(citationCorrectness([{ citedSourceIds: ['a', 'z'], retrievedSourceIds: ['a', 'b'] }])).toBe(0.5);
  });

  it('defaults to 1.0 when nothing was cited at all', () => {
    expect(citationCorrectness([{ citedSourceIds: [], retrievedSourceIds: ['a'] }])).toBe(1);
  });

  it('defaults to 1.0 for an empty case list', () => {
    expect(citationCorrectness([])).toBe(1);
  });
});

describe('citationCompleteness', () => {
  it('is 1.0 when every material source was cited', () => {
    expect(citationCompleteness([{ materialSourceIds: ['a', 'b'], citedSourceIds: ['a', 'b'] }])).toBe(1);
  });

  it('penalizes a material source that was never cited', () => {
    expect(citationCompleteness([{ materialSourceIds: ['a', 'b'], citedSourceIds: ['a'] }])).toBe(0.5);
  });
});

describe('groundednessScore', () => {
  it('delegates to the shared grounding-score computation (reused, not reimplemented)', () => {
    const score = groundednessScore('the part is a brake pad', ['the part is a brake pad for a sedan']);
    expect(score).toBeGreaterThan(0.5);
  });
});

describe('unsupportedTechnicalClaimRate', () => {
  it('is 0 when every identifier-shaped token in the answer appears in the source text', () => {
    expect(unsupportedTechnicalClaimRate('The OEM number is ABC1234.', ['This part has OEM number ABC1234 confirmed.'])).toBe(0);
  });

  it('flags a fabricated identifier not present anywhere in the retrieved evidence', () => {
    expect(unsupportedTechnicalClaimRate('The OEM number is ZZZ9999.', ['This part has OEM number ABC1234 confirmed.'])).toBe(1);
  });

  it('is 0 for an answer containing no identifier-shaped tokens at all', () => {
    expect(unsupportedTechnicalClaimRate('this part fits many vehicles', ['some source text'])).toBe(0);
  });
});

describe('isValidStructuredAnswer', () => {
  const validAnswer = {
    directAnswer: 'x',
    matchingProducts: [],
    matchBasis: 'x',
    verifiedFitment: [],
    alternatives: [],
    conflictsOrWarnings: [],
    sources: [],
    confidence: 'LOW',
    recommendedNextAction: 'x',
  };

  it('is true when every required key from the rag-answer contract is present', () => {
    expect(isValidStructuredAnswer(validAnswer)).toBe(true);
  });

  it('is false when a required key is missing', () => {
    const { confidence: _confidence, ...withoutConfidence } = validAnswer;
    expect(isValidStructuredAnswer(withoutConfidence)).toBe(false);
  });
});
