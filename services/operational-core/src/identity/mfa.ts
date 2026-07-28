import { generate, generateSecret, generateURI, verify } from 'otplib';

// Thin wrapper around otplib's real TOTP implementation (RFC 6238) — no
// external MFA provider needed, the same algorithm Google
// Authenticator/Authy/1Password use client-side. otplib v13's API is
// async/top-level-function based (not the v12 `authenticator` object), so
// every function here is async even though the underlying crypto is fast.
// See docs/architecture/identity-platform.md.
export async function generateMfaSecret(): Promise<string> {
  return generateSecret();
}

export function getMfaKeyUri(email: string, secret: string, issuer = 'AIOS'): string {
  return generateURI({ secret, issuer, label: email });
}

export async function verifyMfaToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

export async function generateMfaToken(secret: string): Promise<string> {
  return generate({ secret });
}
