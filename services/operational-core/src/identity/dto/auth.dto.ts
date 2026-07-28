import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

// The safe, public shape of a User row — every identity endpoint that
// returns user data must return this shape (or a subset of it), never the
// raw Prisma User entity. Excludes passwordHash, mfaSecretEncrypted,
// failedLoginCount, lockedUntil, passwordChangedAt — see
// docs/ai-tuning/security-hotfix.md for the real leak this fixes and
// USER_SAFE_SELECT below for the corresponding Prisma `select` clause,
// which is the actual enforcement point (the sensitive columns are never
// fetched from the database in the first place, not fetched-then-stripped).
export interface UserSafeView {
  id: string;
  email: string;
  name: string;
  role: Role;
  branchId: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  branchId: true,
  isActive: true,
  isEmailVerified: true,
  mfaEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

// A real class (not a plain interface) — this is the actual fix. NestJS's
// global ValidationPipe (main.ts) only validates a @Body() parameter whose
// reflected type is a real class; a plain TypeScript interface is erased
// at compile time and reaches the pipe as generic `Object`, which
// ValidationPipe explicitly skips. Before this, an empty/malformed
// /auth/register body sailed straight through to
// `this.prisma.user.findUnique({ where: { email: undefined } })`, which
// Prisma correctly rejected — but as a raw, unhandled 500 exposing the
// full internal query shape, not a clean 400. See
// docs/ai-tuning/security-hotfix.md for the related response-shape fixes
// on this same endpoint.
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export interface LoginDto {
  email: string;
  password: string;
  mfaToken?: string;
  deviceFingerprint?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshDto {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
