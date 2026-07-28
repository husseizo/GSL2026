import { DocumentEncryptionKeyService } from './document-encryption-key.service';

describe('DocumentEncryptionKeyService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses ENCRYPTION_KID_CURRENT/ENCRYPTION_KEY_CURRENT for the current key', () => {
    process.env.ENCRYPTION_KID_CURRENT = 'k2';
    process.env.ENCRYPTION_KEY_CURRENT = 'real-current-secret';
    const service = new DocumentEncryptionKeyService();
    expect(service.getCurrentKeyId()).toBe('k2');
    expect(service.getCurrentKey()).toBeInstanceOf(Buffer);
    expect(service.getCurrentKey().length).toBe(32); // real 256-bit AES key
  });

  it('supports real rotation — a previous key remains resolvable by its keyId', () => {
    process.env.ENCRYPTION_KID_CURRENT = 'k2';
    process.env.ENCRYPTION_KEY_CURRENT = 'real-current-secret';
    process.env.ENCRYPTION_KEYS_PREVIOUS = JSON.stringify({ k1: 'real-old-secret' });
    const service = new DocumentEncryptionKeyService();
    expect(service.getKeyForId('k1')).toBeInstanceOf(Buffer);
    expect(service.getKeyForId('k1')).not.toEqual(service.getCurrentKey());
  });

  it('returns undefined for an unknown keyId, never fabricating a key', () => {
    const service = new DocumentEncryptionKeyService();
    expect(service.getKeyForId('unknown-key-id')).toBeUndefined();
  });
});
