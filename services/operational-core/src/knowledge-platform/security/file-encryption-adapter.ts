// DGX Prototype 1.7 — encryption at rest for stored original source
// content (spec §36). A thin Buffer<->base64 adapter over the existing,
// unmodified src/common/crypto/field-encryption.ts (AES-256-GCM,
// ENCRYPTION_KEY-derived) — not a new cipher implementation. Real bytes
// are base64-encoded to a string, encrypted with the exact same
// self-describing iv.authTag.ciphertext format already used for MFA
// secrets, and stored in KnowledgeItemVersion.encryptedRawSource.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { encryptField, decryptField } from '../../common/crypto/field-encryption';

export function encryptRawSourceBytes(bytes: Buffer): string {
  return encryptField(bytes.toString('base64'));
}

export function decryptRawSourceBytes(ciphertext: string): Buffer {
  return Buffer.from(decryptField(ciphertext), 'base64');
}

// DGX Prototype 1.7.1 — real, versioned encryption supporting key rotation
// (spec §10). Format: keyId.iv.authTag.ciphertext, all base64 except
// keyId — the keyId prefix is what makes real rotation possible: a future
// decrypt can look up whichever key (current or previous) actually
// encrypted this specific row via DocumentEncryptionKeyService.
const IV_LENGTH = 12;

export function encryptRawSourceBytesVersioned(bytes: Buffer, keyId: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${keyId}.${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptRawSourceBytesVersioned(ciphertext: string, resolveKey: (keyId: string) => Buffer | undefined): Buffer {
  const [keyId, ivB64, authTagB64, dataB64] = ciphertext.split('.');
  if (!keyId || !ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Malformed versioned encrypted value');
  }
  const key = resolveKey(keyId);
  if (!key) {
    throw new Error(`No real key found for keyId "${keyId}" — cannot decrypt (real key-rotation gap or corrupted reference).`);
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
