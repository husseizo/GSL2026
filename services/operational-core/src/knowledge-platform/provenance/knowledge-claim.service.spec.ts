import { extractCandidateClaims } from './knowledge-claim.service';

describe('extractCandidateClaims', () => {
  it('extracts a real torque-value candidate claim with its exact evidence quote', () => {
    const claims = extractCandidateClaims('Remove the old filter. Tighten the drain plug to 25 Nm. Refill with fresh oil.');
    const torqueClaim = claims.find((c) => c.claimType === 'torque_value');
    expect(torqueClaim).toBeDefined();
    expect(torqueClaim?.evidenceQuote).toBe('Tighten the drain plug to 25 Nm.');
  });

  it('extracts a real supersession statement', () => {
    const claims = extractCandidateClaims('Part 12345 supersedes part 67890 effective immediately.');
    expect(claims.some((c) => c.claimType === 'supersession_statement')).toBe(true);
  });

  it('does not extract a candidate claim from a sentence with no technical signal', () => {
    const claims = extractCandidateClaims('This is just a friendly greeting with no technical content whatsoever.');
    expect(claims).toHaveLength(0);
  });

  it('returns an empty array for empty content', () => {
    expect(extractCandidateClaims('')).toHaveLength(0);
  });
});
