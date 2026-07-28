import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateApiKey, hashOpaqueToken } from './token-hash';

// Real security fix (DGX Prototype 1.5): create()/list()/revoke() previously
// returned (or spread) the raw Prisma ApiKey row, which includes keyHash —
// internal security metadata analogous to a refresh-token hash, never
// intended for the client, per the same audit that found the
// IdentityService.register() leak. API_KEY_SAFE_SELECT means keyHash is
// never fetched from the database for these responses. See
// docs/ai-tuning/security-hotfix.md.
export interface ApiKeySafeView {
  id: string;
  name: string;
  keyPrefix: string;
  ownerUserId: string | null;
  isServiceAccount: boolean;
  role: Role;
  scopes: unknown;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

const API_KEY_SAFE_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  ownerUserId: true,
  isServiceAccount: true,
  role: true,
  scopes: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

// Machine identities and personal API keys are the same primitive — a
// hashed secret that resolves to a Role — so service accounts
// (isServiceAccount: true, no ownerUserId) and user-owned keys share one
// model and one verification path. See docs/architecture/identity-platform.md.
@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: { name: string; role: Role; ownerUserId?: string; isServiceAccount?: boolean; expiresAt?: Date }): Promise<ApiKeySafeView & { fullKey: string }> {
    const { fullKey, keyPrefix, keyHash } = generateApiKey();
    const record = await this.prisma.apiKey.create({
      data: {
        name: params.name,
        keyHash,
        keyPrefix,
        role: params.role,
        ownerUserId: params.ownerUserId,
        isServiceAccount: params.isServiceAccount ?? false,
        expiresAt: params.expiresAt,
      },
      select: API_KEY_SAFE_SELECT,
    });
    // The only moment the raw key is ever available — the DB only ever
    // stores its hash, exactly like refresh tokens and reset tokens.
    return { ...record, fullKey };
  }

  list(filter: { ownerUserId?: string; isServiceAccount?: boolean } = {}): Promise<ApiKeySafeView[]> {
    return this.prisma.apiKey.findMany({ where: { ...filter, revokedAt: null }, orderBy: { createdAt: 'desc' }, select: API_KEY_SAFE_SELECT });
  }

  revoke(id: string): Promise<ApiKeySafeView> {
    return this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() }, select: API_KEY_SAFE_SELECT });
  }

  // Internal-only: used by the API-key auth guard to resolve a raw
  // presented key to a role. Its result (including keyHash) must never be
  // returned directly from an HTTP controller — no controller in this
  // codebase does so; kept as a full-record fetch since callers need
  // record.id for the lastUsedAt update below.
  async verify(rawKey: string) {
    const keyHash = hashOpaqueToken(rawKey);
    const record = await this.prisma.apiKey.findUnique({ where: { keyHash } });

    if (!record || record.revokedAt) throw new UnauthorizedException('Invalid or revoked API key');
    if (record.expiresAt && record.expiresAt < new Date()) throw new UnauthorizedException('API key has expired');

    await this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return record;
  }
}
