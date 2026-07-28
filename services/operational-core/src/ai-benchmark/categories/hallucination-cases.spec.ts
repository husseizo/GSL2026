import { computeHallucinationSubScore } from './hallucination-cases';

describe('computeHallucinationSubScore', () => {
  it('returns all-zero rates with zero samples', () => {
    const score = computeHallucinationSubScore([]);
    expect(score.overallHallucinationRate).toBe(0);
    expect(score.casesScored).toBe(0);
  });

  it('computes a real per-subtype rate independently of other subtypes', () => {
    const score = computeHallucinationSubScore([
      { subtype: 'INVALID_OEM', assertedAsFact: true },
      { subtype: 'INVALID_OEM', assertedAsFact: false },
      { subtype: 'UNSUPPORTED_DIAGNOSIS', assertedAsFact: false },
    ]);
    expect(score.invalidOemRate).toBe(0.5);
    expect(score.unsupportedDiagnosisRate).toBe(0);
    expect(score.overallHallucinationRate).toBeCloseTo(1 / 3);
  });
});
