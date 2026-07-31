import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ApiKeysService } from './api-keys.service';
import { AuthTokenService } from './auth-token.service';
import { JwtAuthContextGuard } from './jwt-auth-context.guard';

function makeContext(headers: Record<string, string>): ExecutionContext & { requestRef: Record<string, unknown> } {
  const request: Record<string, unknown> = { headers };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext & { requestRef: Record<string, unknown> };
  context.requestRef = request;
  return context;
}

describe('JwtAuthContextGuard', () => {
  function makeGuard(options: {
    verifyAccessToken?: () => unknown;
    verifyApiKey?: () => unknown;
    requiresPermissions?: boolean;
    requiresRoles?: boolean;
  }) {
    const tokens = {
      verifyAccessToken: jest.fn(options.verifyAccessToken ?? (() => ({}))),
    } as unknown as AuthTokenService;
    const apiKeys = {
      verify: jest.fn(options.verifyApiKey ?? (() => Promise.resolve({}))),
    } as unknown as ApiKeysService;
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === 'permissions') return options.requiresPermissions ? ['some.permission'] : undefined;
        if (key === 'roles') return options.requiresRoles ? [Role.SYSTEM_ADMINISTRATOR] : undefined;
        return undefined;
      }),
    } as unknown as Reflector;
    return new JwtAuthContextGuard(tokens, apiKeys, reflector);
  }

  it('allows the request through with no verified actor when no credential is presented, regardless of handler requirements', async () => {
    const guard = makeGuard({ requiresPermissions: true });
    const context = makeContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.requestRef.verifiedActor).toBeUndefined();
  });

  it('allows the request through and attaches a verified actor when a valid JWT is presented', async () => {
    const claims = { role: Role.SYSTEM_ADMINISTRATOR, sub: 'user-1', branchId: 'branch-1', sessionId: 'session-1' };
    const guard = makeGuard({ verifyAccessToken: () => claims });
    const context = makeContext({ authorization: 'Bearer valid-token' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.requestRef.verifiedActor).toEqual({
      role: Role.SYSTEM_ADMINISTRATOR,
      userId: 'user-1',
      branchId: 'branch-1',
      sessionId: 'session-1',
      authMethod: 'jwt',
    });
  });

  it('rejects an invalid/expired credential when the resolved handler requires a permission', async () => {
    const guard = makeGuard({
      verifyAccessToken: () => {
        throw new UnauthorizedException('Invalid or expired access token');
      },
      requiresPermissions: true,
    });
    const context = makeContext({ authorization: 'Bearer invalid-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid/expired credential when the resolved handler requires a role', async () => {
    const guard = makeGuard({
      verifyAccessToken: () => {
        throw new UnauthorizedException('Invalid or expired access token');
      },
      requiresRoles: true,
    });
    const context = makeContext({ authorization: 'Bearer invalid-token' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('tolerates an invalid/expired credential when the resolved handler requires neither a permission nor a role (open route)', async () => {
    const guard = makeGuard({
      verifyAccessToken: () => {
        throw new UnauthorizedException('Invalid or expired access token');
      },
    });
    const context = makeContext({ authorization: 'Bearer invalid-token' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.requestRef.verifiedActor).toBeUndefined();
  });

  it('rejects an invalid/revoked API key when the resolved handler requires a permission', async () => {
    const guard = makeGuard({
      verifyApiKey: () => {
        throw new UnauthorizedException('Invalid or revoked API key');
      },
      requiresPermissions: true,
    });
    const context = makeContext({ 'x-api-key': 'bad-key' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('tolerates an invalid/revoked API key when the resolved handler requires neither a permission nor a role', async () => {
    const guard = makeGuard({
      verifyApiKey: () => {
        throw new UnauthorizedException('Invalid or revoked API key');
      },
    });
    const context = makeContext({ 'x-api-key': 'bad-key' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.requestRef.verifiedActor).toBeUndefined();
  });

  // PEP-4 (WP-4.0): closes the one coverage gap the PEP-1 Verification and
  // Phase Closure report explicitly flagged as non-blocking but worth
  // hardening — the valid-API-key success path was never separately
  // asserted, only its failure paths were. This is pre-existing,
  // unmodified guard code (PEP-1 only wrapped the surrounding catch
  // block), added here as pure test coverage.

  it('allows the request through and attaches a verified actor when a valid API key (owned by a user) is presented', async () => {
    const guard = makeGuard({
      verifyApiKey: () => Promise.resolve({ role: Role.STOREKEEPER, ownerUserId: 'user-42' }),
    });
    const context = makeContext({ 'x-api-key': 'valid-key' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.requestRef.verifiedActor).toEqual({
      role: Role.STOREKEEPER,
      userId: 'user-42',
      authMethod: 'api-key',
    });
  });

  it('attaches a verified actor with no userId when a valid API key belongs to a service account (no owning user)', async () => {
    const guard = makeGuard({
      verifyApiKey: () => Promise.resolve({ role: Role.SYSTEM_ADMINISTRATOR, ownerUserId: null }),
    });
    const context = makeContext({ 'x-api-key': 'service-account-key' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.requestRef.verifiedActor).toEqual({
      role: Role.SYSTEM_ADMINISTRATOR,
      userId: undefined,
      authMethod: 'api-key',
    });
  });
});
