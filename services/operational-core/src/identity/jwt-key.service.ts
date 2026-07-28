import { Injectable } from '@nestjs/common';

// Supports signing-key rotation without a hard cutover: JWT_SECRETS_PREVIOUS
// (JSON map of kid -> secret) stays valid for verification of
// already-issued tokens through their remaining lifetime, while every new
// token is signed with JWT_SECRET_CURRENT under JWT_KID_CURRENT. Rotating
// is: generate a new current secret/kid, move the old current into
// "previous", redeploy — no forced logout, no downtime. See
// docs/architecture/security-production.md.
@Injectable()
export class JwtKeyService {
  private readonly keys: Record<string, string>;
  private readonly currentKid: string;

  constructor() {
    this.currentKid = process.env.JWT_KID_CURRENT ?? 'k1';
    const currentSecret = process.env.JWT_SECRET_CURRENT ?? 'dev-insecure-jwt-secret-change-me-in-production';
    let previous: Record<string, string> = {};
    if (process.env.JWT_SECRETS_PREVIOUS) {
      try {
        previous = JSON.parse(process.env.JWT_SECRETS_PREVIOUS);
      } catch {
        previous = {};
      }
    }
    this.keys = { ...previous, [this.currentKid]: currentSecret };
  }

  getCurrentKid(): string {
    return this.currentKid;
  }

  getCurrentSecret(): string {
    return this.keys[this.currentKid];
  }

  getSecretForKid(kid: string): string | undefined {
    return this.keys[kid];
  }
}
