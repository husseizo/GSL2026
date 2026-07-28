import { generateApiKey, generateOpaqueToken, hashOpaqueToken } from './token-hash';

describe('token-hash', () => {
  it('generateOpaqueToken produces a high-entropy, unique value each call', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });

  it('hashOpaqueToken is deterministic for the same input', () => {
    const token = generateOpaqueToken();
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it('hashOpaqueToken differs for different inputs', () => {
    expect(hashOpaqueToken('a')).not.toBe(hashOpaqueToken('b'));
  });

  it('generateApiKey produces a full key whose prefix matches and whose hash matches hashOpaqueToken(fullKey)', () => {
    const { fullKey, keyPrefix, keyHash } = generateApiKey();
    expect(fullKey.startsWith('sk_live_')).toBe(true);
    expect(fullKey.startsWith(keyPrefix)).toBe(true);
    expect(keyHash).toBe(hashOpaqueToken(fullKey));
  });
});
