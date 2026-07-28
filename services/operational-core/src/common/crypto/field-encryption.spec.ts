import { decryptField, encryptField } from './field-encryption';

describe('field-encryption', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-passphrase-not-for-production-use';
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'; // a plausible-looking TOTP secret
    const ciphertext = encryptField(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptField(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const a = encryptField('same-value');
    const b = encryptField('same-value');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('same-value');
    expect(decryptField(b)).toBe('same-value');
  });

  it('throws on a tampered ciphertext rather than silently returning garbage', () => {
    const ciphertext = encryptField('secret-value');
    const tampered = ciphertext.slice(0, -4) + 'abcd';
    expect(() => decryptField(tampered)).toThrow();
  });

  it('throws if ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptField('x')).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = 'test-passphrase-not-for-production-use';
  });
});
