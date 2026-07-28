import { computeBenchmarkChecksum } from './checksum';

describe('computeBenchmarkChecksum', () => {
  it('is deterministic for the same set of ids regardless of input order', () => {
    const a = computeBenchmarkChecksum(['case-1', 'case-2', 'case-3']);
    const b = computeBenchmarkChecksum(['case-3', 'case-1', 'case-2']);
    expect(a).toBe(b);
  });

  it('changes when the case set changes', () => {
    const a = computeBenchmarkChecksum(['case-1', 'case-2']);
    const b = computeBenchmarkChecksum(['case-1', 'case-2', 'case-3']);
    expect(a).not.toBe(b);
  });

  it('produces a real sha256 hex digest', () => {
    const checksum = computeBenchmarkChecksum(['case-1']);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
