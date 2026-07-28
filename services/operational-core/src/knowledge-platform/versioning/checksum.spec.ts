import { computeContentChecksum } from './checksum';

describe('computeContentChecksum', () => {
  it('is deterministic for identical content', () => {
    expect(computeContentChecksum('hello world')).toBe(computeContentChecksum('hello world'));
  });

  it('changes when content changes', () => {
    expect(computeContentChecksum('hello world')).not.toBe(computeContentChecksum('hello world!'));
  });

  it('produces a real sha256 hex digest', () => {
    expect(computeContentChecksum('x')).toMatch(/^[a-f0-9]{64}$/);
  });
});
