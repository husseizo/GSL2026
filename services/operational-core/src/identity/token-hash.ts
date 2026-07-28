import { createHash, randomBytes } from 'crypto';

// Refresh tokens, password-reset tokens, email-verification tokens, and API
// keys are all "a random secret the caller presents later, that we look up
// by hash." SHA-256 (not bcrypt) is deliberate here: these are
// high-entropy, randomly generated 256-bit values, not human-chosen
// passwords — there's no dictionary-attack risk to slow down against, and a
// fast deterministic hash is what makes an indexed `WHERE tokenHash = ?`
// lookup possible at all. Passwords themselves still go through bcrypt
// (identity.service.ts) specifically because they're low-entropy and need
// the slow, salted comparison.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// e.g. "sk_live_" + 32 random chars — the prefix stays visible in the UI so
// a user can tell keys apart without ever re-displaying the secret itself.
export function generateApiKey(prefix = 'sk_live_'): { fullKey: string; keyPrefix: string; keyHash: string } {
  const secret = randomBytes(24).toString('base64url');
  const fullKey = `${prefix}${secret}`;
  return { fullKey, keyPrefix: fullKey.slice(0, prefix.length + 6), keyHash: hashOpaqueToken(fullKey) };
}
