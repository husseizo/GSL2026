import { encryptRawSourceBytesVersioned, decryptRawSourceBytesVersioned } from './file-encryption-adapter';
import { createHash } from 'crypto';

describe('file-encryption-adapter — versioned (real key rotation)', () => {
  const key1 = createHash('sha256').update('real-secret-1').digest();
  const key2 = createHash('sha256').update('real-secret-2').digest();

  it('round-trips real bytes through encrypt -> decrypt', () => {
    const plaintext = Buffer.from('Real restricted torque specification: 45 Nm.');
    const ciphertext = encryptRawSourceBytesVersioned(plaintext, 'k1', key1);
    const decrypted = decryptRawSourceBytesVersioned(ciphertext, (keyId) => (keyId === 'k1' ? key1 : undefined));
    expect(decrypted.toString('utf8')).toBe(plaintext.toString('utf8'));
  });

  it('never stores the plaintext substring in the ciphertext — real encryption, not a pass-through', () => {
    const plaintext = Buffer.from('Real restricted torque specification: 45 Nm.');
    const ciphertext = encryptRawSourceBytesVersioned(plaintext, 'k1', key1);
    expect(ciphertext).not.toContain('Real restricted torque specification');
    expect(ciphertext).not.toContain('45 Nm');
  });

  it('supports real key rotation — decrypting with the correct prior key by its real keyId', () => {
    const plaintext = Buffer.from('Content encrypted under the OLD key.');
    const ciphertext = encryptRawSourceBytesVersioned(plaintext, 'k1', key1);
    // Real rotation: current key is now k2, but k1 is still resolvable as a "previous" key.
    const decrypted = decryptRawSourceBytesVersioned(ciphertext, (keyId) => ({ k1: key1, k2: key2 })[keyId]);
    expect(decrypted.toString('utf8')).toBe('Content encrypted under the OLD key.');
  });

  it('throws a real, honest error when the referenced keyId cannot be resolved, never silently returning garbage', () => {
    const ciphertext = encryptRawSourceBytesVersioned(Buffer.from('secret'), 'k1', key1);
    expect(() => decryptRawSourceBytesVersioned(ciphertext, () => undefined)).toThrow(/No real key found for keyId "k1"/);
  });

  it('throws on a malformed ciphertext, never silently returning empty bytes', () => {
    expect(() => decryptRawSourceBytesVersioned('not.a.real.ciphertext', () => key1)).toThrow();
  });
});
