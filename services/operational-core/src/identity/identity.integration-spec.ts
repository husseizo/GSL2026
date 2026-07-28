import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from './api-keys.service';
import { AuthTokenService } from './auth-token.service';
import { generateMfaToken } from './mfa';
import { IdentityService } from './identity.service';
import { JwtKeyService } from './jwt-key.service';

describe('IdentityService (integration, real Postgres + real bcrypt/JWT/TOTP)', () => {
  let prisma: PrismaService;
  let identity: IdentityService;
  let tokens: AuthTokenService;
  let apiKeys: ApiKeysService;

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = 'integration-test-encryption-key-not-for-prod';
    prisma = new PrismaService();
    await prisma.$connect();
    tokens = new AuthTokenService(new JwtService(), new JwtKeyService());
    identity = new IdentityService(prisma, tokens);
    apiKeys = new ApiKeysService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('registers a user with a hashed password, never storing plaintext, and never returns sensitive fields in the response', async () => {
    const user = await identity.register({ email: 'alice@example.com', name: 'Alice', password: 'Str0ng!Passw0rd', role: 'GENERAL_MANAGER' });

    // Real security regression test (DGX Prototype 1.5): register() used to
    // return the raw Prisma User row, leaking passwordHash and
    // mfaSecretEncrypted directly in the HTTP response — confirmed via a
    // real live call during the Prototype 1 final acceptance pass. See
    // docs/ai-tuning/security-hotfix.md.
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('mfaSecretEncrypted');
    expect(user).not.toHaveProperty('failedLoginCount');
    expect(user).not.toHaveProperty('lockedUntil');
    expect(user).not.toHaveProperty('passwordChangedAt');
    expect(Object.keys(user).sort()).toEqual(['branchId', 'createdAt', 'email', 'id', 'isActive', 'isEmailVerified', 'mfaEnabled', 'name', 'role', 'updatedAt'].sort());

    // The password hash still exists in real storage — checked directly
    // against the database, not via any API response.
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBeDefined();
    expect(stored.passwordHash).not.toBe('Str0ng!Passw0rd');
  });

  it('rejects registration with a policy-violating password', async () => {
    await expect(identity.register({ email: 'weak@example.com', name: 'Weak', password: 'short', role: 'GENERAL_MANAGER' })).rejects.toThrow();
  });

  it('rejects duplicate email registration', async () => {
    await expect(identity.register({ email: 'alice@example.com', name: 'Alice 2', password: 'Str0ng!Passw0rd', role: 'GENERAL_MANAGER' })).rejects.toThrow();
  });

  it('logs in with correct credentials and issues a real verifiable JWT + opaque refresh token', async () => {
    const result = await identity.login({ email: 'alice@example.com', password: 'Str0ng!Passw0rd' });
    expect(result.tokens).toBeDefined();
    const claims = tokens.verifyAccessToken(result.tokens!.accessToken);
    expect(claims.email).toBe('alice@example.com');
    expect(claims.role).toBe('GENERAL_MANAGER');

    const history = await prisma.loginHistoryEntry.findMany({ where: { email: 'alice@example.com', success: true } });
    expect(history.length).toBeGreaterThan(0);
  });

  it('rejects an incorrect password and records login history', async () => {
    await expect(identity.login({ email: 'alice@example.com', password: 'WrongPassword123!' })).rejects.toThrow();
    const failures = await prisma.loginHistoryEntry.findMany({ where: { email: 'alice@example.com', success: false } });
    expect(failures.length).toBeGreaterThan(0);
  });

  it('locks the account after repeated failed attempts and records a SecurityEvent', async () => {
    const user = await identity.register({ email: 'lockout@example.com', name: 'Lockout Test', password: 'Str0ng!Passw0rd', role: 'TECHNICIAN' });

    for (let i = 0; i < 5; i++) {
      await identity.login({ email: 'lockout@example.com', password: 'WrongPassword!' }).catch(() => undefined);
    }

    const locked = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(locked.lockedUntil).not.toBeNull();

    await expect(identity.login({ email: 'lockout@example.com', password: 'Str0ng!Passw0rd' })).rejects.toThrow('locked');

    const securityEvents = await prisma.securityEvent.findMany({ where: { eventType: 'ACCOUNT_LOCKOUT', userId: user.id } });
    expect(securityEvents.length).toBeGreaterThan(0);
  });

  it('requires MFA when enabled, and rejects login without a valid token', async () => {
    const user = await identity.register({ email: 'mfa@example.com', name: 'MFA User', password: 'Str0ng!Passw0rd', role: 'TECHNICIAN' });
    const { secret } = await identity.enrollMfa(user.id);
    const validToken = await generateMfaToken(secret);
    await identity.confirmMfa(user.id, validToken);

    const withoutToken = await identity.login({ email: 'mfa@example.com', password: 'Str0ng!Passw0rd' });
    expect(withoutToken.mfaRequired).toBe(true);
    expect(withoutToken.tokens).toBeUndefined();

    await expect(identity.login({ email: 'mfa@example.com', password: 'Str0ng!Passw0rd', mfaToken: '000000' })).rejects.toThrow();

    const freshToken = await generateMfaToken(secret);
    const withToken = await identity.login({ email: 'mfa@example.com', password: 'Str0ng!Passw0rd', mfaToken: freshToken });
    expect(withToken.tokens).toBeDefined();
  });

  it('rotates refresh tokens on use and detects reuse of an already-rotated token as theft', async () => {
    const user = await identity.register({ email: 'rotate@example.com', name: 'Rotate User', password: 'Str0ng!Passw0rd', role: 'TECHNICIAN' });
    const loginResult = await identity.login({ email: 'rotate@example.com', password: 'Str0ng!Passw0rd' });
    const firstRefreshToken = loginResult.tokens!.refreshToken;

    const refreshed = await identity.refresh({ refreshToken: firstRefreshToken });
    expect(refreshed.refreshToken).not.toBe(firstRefreshToken);

    // Reusing the now-rotated (revoked) first token must be treated as theft.
    await expect(identity.refresh({ refreshToken: firstRefreshToken })).rejects.toThrow();

    const securityEvents = await prisma.securityEvent.findMany({ where: { eventType: 'REFRESH_TOKEN_REUSE_DETECTED', userId: user.id } });
    expect(securityEvents.length).toBeGreaterThan(0);

    // The entire family (including the second, legitimately-issued token) is now revoked.
    await expect(identity.refresh({ refreshToken: refreshed.refreshToken })).rejects.toThrow();
  });

  it('supports logout, session listing, and session revocation', async () => {
    const user = await identity.register({ email: 'sessions@example.com', name: 'Sessions User', password: 'Str0ng!Passw0rd', role: 'TECHNICIAN' });
    await identity.login({ email: 'sessions@example.com', password: 'Str0ng!Passw0rd' });
    await identity.login({ email: 'sessions@example.com', password: 'Str0ng!Passw0rd' });

    const sessions = await identity.listSessions(user.id);
    expect(sessions.length).toBeGreaterThanOrEqual(2);

    await identity.revokeSession(sessions[0].id);
    const afterRevoke = await prisma.userSession.findUniqueOrThrow({ where: { id: sessions[0].id } });
    expect(afterRevoke.revokedAt).not.toBeNull();
  });

  it('supports the password-reset flow end to end', async () => {
    await identity.register({ email: 'reset@example.com', name: 'Reset User', password: 'Str0ng!Passw0rd', role: 'TECHNICIAN' });
    const rawToken = await identity.requestPasswordReset('reset@example.com');
    expect(rawToken).toBeTruthy();

    await identity.resetPassword(rawToken!, 'NewStr0ng!Passw0rd');

    await expect(identity.login({ email: 'reset@example.com', password: 'Str0ng!Passw0rd' })).rejects.toThrow();
    const loginResult = await identity.login({ email: 'reset@example.com', password: 'NewStr0ng!Passw0rd' });
    expect(loginResult.tokens).toBeDefined();

    // A used token cannot be replayed.
    await expect(identity.resetPassword(rawToken!, 'AnotherStr0ng!Pass')).rejects.toThrow();
  });

  it('returns null (not an error) for password reset on a non-existent email, to avoid account enumeration', async () => {
    const result = await identity.requestPasswordReset('doesnotexist@example.com');
    expect(result).toBeNull();
  });

  it('supports email verification end to end', async () => {
    const user = await identity.register({ email: 'verify@example.com', name: 'Verify User', password: 'Str0ng!Passw0rd', role: 'TECHNICIAN' });
    const rawToken = await identity.requestEmailVerification(user.id);
    await identity.verifyEmail(rawToken);
    const verified = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(verified.isEmailVerified).toBe(true);
  });

  it('ApiKeysService creates a real hashed key, verifies it, and revokes it — never exposing keyHash', async () => {
    const created = await apiKeys.create({ name: 'CI service account', role: 'PARTS_MANAGER', isServiceAccount: true });
    expect(created.fullKey).toBeDefined();
    // Real security regression test (DGX Prototype 1.5): create()/list()
    // previously spread/returned the raw ApiKey row, leaking keyHash. See
    // docs/ai-tuning/security-hotfix.md.
    expect(created).not.toHaveProperty('keyHash');

    const listed = await apiKeys.list({ isServiceAccount: true });
    expect(listed.some((k) => k.id === created.id)).toBe(true);
    expect(listed.every((k) => !('keyHash' in k))).toBe(true);

    const verified = await apiKeys.verify(created.fullKey);
    expect(verified.id).toBe(created.id);

    const revoked = await apiKeys.revoke(created.id);
    expect(revoked).not.toHaveProperty('keyHash');
    await expect(apiKeys.verify(created.fullKey)).rejects.toThrow();
  });
});
