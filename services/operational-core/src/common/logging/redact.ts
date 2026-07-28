// Pure, recursive sensitive-field redaction — applied before anything is
// logged (see all-exceptions.filter.ts and any future request-logging
// interceptor). A hardcoded case-insensitive key-name match rather than a
// value-pattern heuristic: simple, predictable, and easy for a reviewer to
// extend by adding one string to SENSITIVE_KEYS. See
// docs/architecture/security-production.md.
const SENSITIVE_KEYS = ['password', 'passwordhash', 'token', 'refreshtoken', 'accesstoken', 'secret', 'mfasecret', 'apikey', 'authorization', 'signature', 'encryptionkey'];

const REDACTED = '[REDACTED]';

export function redactSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > 10) return value; // guard against pathological circular/deep structures
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
        result[key] = REDACTED;
      } else {
        result[key] = redactSensitiveFields(val, depth + 1);
      }
    }
    return result;
  }

  return value;
}
