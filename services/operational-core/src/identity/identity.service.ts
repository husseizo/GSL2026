import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { decryptField, encryptField } from '../common/crypto/field-encryption';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenService } from './auth-token.service';
import { AuthTokens, LoginDto, RefreshDto, RegisterDto, USER_SAFE_SELECT, UserSafeView } from './dto/auth.dto';
import { generateMfaSecret, getMfaKeyUri, verifyMfaToken } from './mfa';
import { validatePasswordPolicy } from './password-policy';
import { generateOpaqueToken, hashOpaqueToken } from './token-hash';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = REFRESH_TOKEN_TTL_MS;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export interface LoginResult {
  mfaRequired?: boolean;
  tokens?: AuthTokens;
}

// The production Identity Service that replaces the Phase 1-4 x-user-role
// header stand-in as the *preferred* auth path — see
// src/common/permissions/request-actor.ts for how a verified JWT and the
// legacy header stand-in now coexist, so every existing Phase 1-4 test and
// verification script keeps working unmodified. See
// docs/architecture/identity-platform.md.
@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: AuthTokenService,
  ) {}

  // Real security fix (DGX Prototype 1.5): this previously returned the raw
  // Prisma User row, leaking passwordHash and mfaSecretEncrypted directly in
  // the HTTP response — confirmed via a real live call during the Prototype
  // 1 final acceptance pass. USER_SAFE_SELECT means the sensitive columns
  // are never fetched from the database for this response in the first
  // place, not fetched-then-stripped. See docs/ai-tuning/security-hotfix.md.
  async register(dto: RegisterDto): Promise<UserSafeView> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException(`A user with email ${dto.email} already exists`);

    const policy = validatePasswordPolicy(dto.password);
    if (!policy.valid) throw new BadRequestException({ message: 'Password does not meet policy requirements', violations: policy.violations });

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        branchId: dto.branchId,
        passwordHash,
        passwordChangedAt: new Date(),
      },
      select: USER_SAFE_SELECT,
    });
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.passwordHash) {
      await this.recordLoginHistory(null, dto.email, false, 'user_not_found', dto.ipAddress, dto.userAgent);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginHistory(user.id, dto.email, false, 'account_locked', dto.ipAddress, dto.userAgent);
      await this.recordSecurityEvent('LOGIN_ATTEMPT_WHILE_LOCKED', user.id, user.role, dto.ipAddress, `Login attempted while account locked until ${user.lockedUntil.toISOString()}`);
      throw new UnauthorizedException('Account is temporarily locked due to too many failed login attempts');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.handleFailedLogin(user.id, dto.email, dto.ipAddress, dto.userAgent);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.recordLoginHistory(user.id, dto.email, false, 'account_inactive', dto.ipAddress, dto.userAgent);
      throw new UnauthorizedException('Account is inactive');
    }

    if (user.mfaEnabled) {
      if (!dto.mfaToken) {
        return { mfaRequired: true };
      }
      const secret = decryptField(user.mfaSecretEncrypted!);
      const mfaValid = await verifyMfaToken(dto.mfaToken, secret);
      if (!mfaValid) {
        await this.recordLoginHistory(user.id, dto.email, false, 'invalid_mfa_token', dto.ipAddress, dto.userAgent);
        await this.recordSecurityEvent('MFA_VERIFICATION_FAILED', user.id, user.role, dto.ipAddress, 'Invalid MFA token presented at login');
        throw new UnauthorizedException('Invalid MFA token');
      }
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await this.recordLoginHistory(user.id, dto.email, true, undefined, dto.ipAddress, dto.userAgent);

    const device = dto.deviceFingerprint ? await this.upsertTrustedDevice(user.id, dto.deviceFingerprint, dto.deviceName) : null;
    const tokens = await this.issueSessionAndTokens(user.id, user.email, user.role, user.branchId, device?.id, dto.ipAddress, dto.userAgent);
    return { tokens };
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    const tokenHash = hashOpaqueToken(dto.refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true, session: true } });

    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    if (existing.revokedAt) {
      // A previously-rotated token being presented again means the token
      // was copied/stolen — revoke the whole family and the session, not
      // just this one token. Standard refresh-token-theft detection.
      await this.revokeTokenFamily(existing.familyId, 'reuse_detected');
      await this.prisma.userSession.update({ where: { id: existing.sessionId }, data: { revokedAt: new Date(), revokedReason: 'refresh_token_reuse_detected' } });
      await this.recordSecurityEvent('REFRESH_TOKEN_REUSE_DETECTED', existing.userId, existing.user.role, dto.ipAddress, `Refresh token family ${existing.familyId} reused after rotation — session revoked`);
      throw new UnauthorizedException('Refresh token has already been used — session revoked for security');
    }

    if (existing.expiresAt < new Date()) throw new UnauthorizedException('Refresh token has expired');
    if (existing.session.revokedAt) throw new UnauthorizedException('Session has been revoked');

    const newRefreshTokenRaw = generateOpaqueToken();
    const newRefreshTokenHash = hashOpaqueToken(newRefreshTokenRaw);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const newToken = await this.prisma.refreshToken.create({
      data: {
        sessionId: existing.sessionId,
        userId: existing.userId,
        tokenHash: newRefreshTokenHash,
        familyId: existing.familyId,
        expiresAt: newExpiresAt,
      },
    });

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), revokedReason: 'rotated', replacedByTokenId: newToken.id },
    });
    await this.prisma.userSession.update({ where: { id: existing.sessionId }, data: { lastSeenAt: new Date() } });

    const accessToken = this.tokens.signAccessToken({
      sub: existing.userId,
      email: existing.user.email,
      role: existing.user.role,
      branchId: existing.user.branchId ?? undefined,
      sessionId: existing.sessionId,
    });

    return { accessToken, refreshToken: newRefreshTokenRaw, expiresIn: 15 * 60 };
  }

  async logout(sessionId: string, reason = 'user_logout') {
    await this.prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date(), revokedReason: reason } });
    await this.prisma.refreshToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  }

  listSessions(userId: string) {
    return this.prisma.userSession.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' } });
  }

  revokeSession(sessionId: string) {
    return this.logout(sessionId, 'revoked_by_user');
  }

  listLoginHistory(userId: string, limit = 50) {
    return this.prisma.loginHistoryEntry.findMany({ where: { userId }, orderBy: { occurredAt: 'desc' }, take: limit });
  }

  // --- MFA enrollment -------------------------------------------------------

  async enrollMfa(userId: string): Promise<{ secret: string; keyUri: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = await generateMfaSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecretEncrypted: encryptField(secret) } });
    return { secret, keyUri: getMfaKeyUri(user.email, secret) };
  }

  async confirmMfa(userId: string, token: string): Promise<{ enabled: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEncrypted) throw new BadRequestException('MFA has not been enrolled for this user yet');
    const secret = decryptField(user.mfaSecretEncrypted);
    const valid = await verifyMfaToken(token, secret);
    if (!valid) throw new UnauthorizedException('Invalid MFA token');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
  }

  async disableMfa(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecretEncrypted: null } });
    return { enabled: false };
  }

  // --- Password reset ---------------------------------------------------

  // Returns the raw token so a caller (NotificationService) can deliver it —
  // never returned from the public HTTP endpoint itself, to avoid leaking
  // whether an email address has an account.
  async requestPasswordReset(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const rawToken = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
    });
    return rawToken;
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) throw new BadRequestException({ message: 'Password does not meet policy requirements', violations: policy.violations });

    const tokenHash = hashOpaqueToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
  }

  // --- Email verification -----------------------------------------------

  // Real security fix (DGX Prototype 1.5): the raw token this returns must
  // never reach the HTTP response — the controller now discards it and
  // returns a generic message, matching requestPasswordReset's existing
  // safe pattern. Returning it directly (the previous controller behavior)
  // let an authenticated caller self-verify their own email without ever
  // proving control of the mailbox, defeating the point of email
  // verification. See docs/ai-tuning/security-hotfix.md.
  async requestEmailVerification(userId: string): Promise<string> {
    const rawToken = generateOpaqueToken();
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS) },
    });
    return rawToken;
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired email verification token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { isEmailVerified: true } }),
      this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
  }

  // --- User directory (for the Web Management Portal's User Management screen) ---

  async listUsers(): Promise<Omit<UserSafeView, 'updatedAt'>[]> {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, branchId: true, isActive: true, isEmailVerified: true, mfaEnabled: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setUserActive(userId: string, isActive: boolean): Promise<Pick<UserSafeView, 'id' | 'email' | 'isActive'>> {
    return this.prisma.user.update({ where: { id: userId }, data: { isActive }, select: { id: true, email: true, isActive: true } });
  }

  // --- Internal helpers ---------------------------------------------------

  private async handleFailedLogin(userId: string, email: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { failedLoginCount: { increment: 1 } } });

    if (user.failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await this.prisma.user.update({ where: { id: userId }, data: { lockedUntil } });
      await this.recordSecurityEvent('ACCOUNT_LOCKOUT', userId, user.role, ipAddress, `Account locked until ${lockedUntil.toISOString()} after ${user.failedLoginCount} failed attempts`);
    }

    await this.recordLoginHistory(userId, email, false, 'invalid_password', ipAddress, userAgent);
  }

  private async issueSessionAndTokens(
    userId: string,
    email: string,
    role: Role,
    branchId: string | null,
    deviceId: string | undefined,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const session = await this.prisma.userSession.create({
      data: { userId, deviceId, ipAddress, userAgent, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });

    const refreshTokenRaw = generateOpaqueToken();
    await this.prisma.refreshToken.create({
      data: {
        sessionId: session.id,
        userId,
        tokenHash: hashOpaqueToken(refreshTokenRaw),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const accessToken = this.tokens.signAccessToken({ sub: userId, email, role, branchId: branchId ?? undefined, sessionId: session.id });
    return { accessToken, refreshToken: refreshTokenRaw, expiresIn: 15 * 60 };
  }

  private async upsertTrustedDevice(userId: string, fingerprint: string, deviceName?: string) {
    return this.prisma.trustedDevice.upsert({
      where: { deviceFingerprint: fingerprint },
      create: { userId, deviceFingerprint: fingerprint, deviceName },
      update: { lastSeenAt: new Date() },
    });
  }

  private async revokeTokenFamily(familyId: string, reason: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  private recordLoginHistory(userId: string | null, email: string, success: boolean, failureReason?: string, ipAddress?: string, userAgent?: string) {
    return this.prisma.loginHistoryEntry.create({
      data: { userId, email, success, failureReason, ipAddress, userAgent },
    });
  }

  private recordSecurityEvent(eventType: string, userId: string | undefined, actorRole: string | undefined, ipAddress: string | undefined, message: string) {
    return this.prisma.securityEvent.create({
      data: { eventType, userId, actorRole, ipAddress, message },
    });
  }
}
