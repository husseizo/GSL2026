import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

// DGX Prototype 1.7.1 — real key-rotation support for encrypted-at-rest
// document content (spec §10), structurally identical to
// src/identity/jwt-key.service.ts's proven current+previous key pattern:
// ENCRYPTION_KEYS_PREVIOUS (JSON map of keyId -> secret) stays valid for
// decrypting already-encrypted content through its remaining lifetime,
// while every new encryption uses ENCRYPTION_KEY_CURRENT under
// ENCRYPTION_KID_CURRENT. Rotating is: generate a new current
// secret/keyId, move the old current into "previous", redeploy — no
// re-encryption forced immediately. Deliberately does NOT touch
// src/common/crypto/field-encryption.ts (shared with MFA secrets; changing
// its format would be a breaking, non-additive change outside this
// phase's remit) — see file-encryption-adapter.ts's versioned functions.
@Injectable()
export class DocumentEncryptionKeyService {
  private readonly keys: Record<string, string>;
  private readonly currentKeyId: string;

  constructor() {
    this.currentKeyId = process.env.ENCRYPTION_KID_CURRENT ?? 'k1';
    const currentSecret = process.env.ENCRYPTION_KEY_CURRENT ?? process.env.ENCRYPTION_KEY ?? 'dev-insecure-encryption-key-change-me-in-production';
    let previous: Record<string, string> = {};
    if (process.env.ENCRYPTION_KEYS_PREVIOUS) {
      try {
        previous = JSON.parse(process.env.ENCRYPTION_KEYS_PREVIOUS);
      } catch {
        previous = {};
      }
    }
    this.keys = { ...previous, [this.currentKeyId]: currentSecret };
  }

  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  getCurrentKey(): Buffer {
    return this.deriveKey(this.keys[this.currentKeyId]);
  }

  getKeyForId(keyId: string): Buffer | undefined {
    const secret = this.keys[keyId];
    return secret ? this.deriveKey(secret) : undefined;
  }

  private deriveKey(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
  }
}
