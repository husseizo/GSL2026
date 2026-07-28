import { verifyAndCleanClaims } from './claim-verifier';

describe('verifyAndCleanClaims', () => {
  it('removes a sentence that references an identifier not present in the evidence', () => {
    const answer = 'The brake pad is BOSCH-1234. It is also known as GHOST-9999 in some catalogues.';
    const evidence = 'Part: Brake Pad Set. OEM number: BOSCH-1234. Brand: Bosch.';
    const result = verifyAndCleanClaims(answer, evidence);

    expect(result.removedCount).toBe(1);
    expect(result.cleanedAnswer).toContain('BOSCH-1234');
    expect(result.cleanedAnswer).not.toContain('GHOST-9999');
    expect(result.claims.find((c) => c.text.includes('GHOST-9999'))?.status).toBe('UNSUPPORTED');
  });

  it('keeps a sentence whose identifier is verbatim in the evidence', () => {
    const answer = 'The part is VAG10767.';
    const evidence = 'Alternate numbers: VAG10767, 036145933G';
    const result = verifyAndCleanClaims(answer, evidence);

    expect(result.removedCount).toBe(0);
    expect(result.cleanedAnswer).toBe(answer);
    expect(result.claims[0].status).toBe('SUPPORTED');
  });

  it('marks a low-lexical-overlap, identifier-free sentence as NOT_VERIFIABLE but keeps it', () => {
    const answer = 'This might be useful for your workshop needs today.';
    const evidence = 'Part: Brake Pad Set. OEM number: BOSCH-1234.';
    const result = verifyAndCleanClaims(answer, evidence);

    expect(result.claims[0].status).toBe('NOT_VERIFIABLE');
    expect(result.cleanedAnswer).toBe(answer);
    expect(result.removedCount).toBe(0);
  });

  it('returns allRemoved=true when every sentence is unsupported', () => {
    const answer = 'The part is FAKE-0001.';
    const evidence = 'Part: Something entirely different. OEM number: REAL-9999.';
    const result = verifyAndCleanClaims(answer, evidence);

    expect(result.allRemoved).toBe(true);
    expect(result.cleanedAnswer).toBe('');
  });

  it('handles an empty answer without throwing', () => {
    const result = verifyAndCleanClaims('', 'some evidence');
    expect(result.claims).toHaveLength(0);
    expect(result.allRemoved).toBe(false);
  });
});
