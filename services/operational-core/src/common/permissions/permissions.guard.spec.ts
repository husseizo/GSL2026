import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { REQUIRE_VERIFIED_ACTOR_KEY } from './require-verified-actor.decorator';
import { RequestActor } from './request-actor';

function makeContext(headers: Record<string, string>, verifiedActor?: RequestActor): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers, verifiedActor }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  function makeGuard(requiredPermissions: string[] | undefined, requiresVerifiedActor = false) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === PERMISSIONS_KEY) return requiredPermissions;
        if (key === REQUIRE_VERIFIED_ACTOR_KEY) return requiresVerifiedActor;
        return undefined;
      }),
    } as unknown as Reflector;
    return new PermissionsGuard(reflector);
  }

  it('allows the request through when no permissions are required', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext({ 'x-user-role': Role.READ_ONLY_VIEWER }))).toBe(true);
  });

  it('denies a role that lacks the required permission', () => {
    const guard = makeGuard(['inventory.adjust']);
    // READ_ONLY_VIEWER only has *.read permissions, not inventory.adjust
    expect(() => guard.canActivate(makeContext({ 'x-user-role': Role.READ_ONLY_VIEWER }))).toThrow(ForbiddenException);
  });

  it('allows a role that has the required permission', () => {
    const guard = makeGuard(['inventory.adjust']);
    expect(guard.canActivate(makeContext({ 'x-user-role': Role.STOREKEEPER }))).toBe(true);
  });

  it('denies when no role header is present at all', () => {
    const guard = makeGuard(['sales.read']);
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('denies when multiple permissions are required and only some are granted', () => {
    const guard = makeGuard(['sales.read', 'inventory.adjust']);
    // SALESPERSON has sales.read but not inventory.adjust
    expect(() => guard.canActivate(makeContext({ 'x-user-role': Role.SALESPERSON }))).toThrow(ForbiddenException);
  });

  // Platform Remediation PEP-2 — RequireVerifiedActor opt-in mechanism.

  it('denies a handler marked @RequireVerifiedActor when the actor is only a header stand-in', () => {
    const guard = makeGuard(undefined, true);
    expect(() => guard.canActivate(makeContext({ 'x-user-role': Role.SYSTEM_ADMINISTRATOR }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies a handler marked @RequireVerifiedActor when no actor is present at all', () => {
    const guard = makeGuard(undefined, true);
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('allows a handler marked @RequireVerifiedActor when the actor was verified via JWT', () => {
    const guard = makeGuard(undefined, true);
    const verifiedActor: RequestActor = { role: Role.SYSTEM_ADMINISTRATOR, userId: 'user-1', authMethod: 'jwt' };
    expect(guard.canActivate(makeContext({}, verifiedActor))).toBe(true);
  });

  it('allows a handler marked @RequireVerifiedActor when the actor was verified via API key', () => {
    const guard = makeGuard(undefined, true);
    const verifiedActor: RequestActor = { role: Role.SYSTEM_ADMINISTRATOR, authMethod: 'api-key' };
    expect(guard.canActivate(makeContext({}, verifiedActor))).toBe(true);
  });

  it('enforces both @RequireVerifiedActor and @RequirePermissions together when both are present', () => {
    const guard = makeGuard(['inventory.adjust'], true);
    const verifiedActor: RequestActor = { role: Role.STOREKEEPER, authMethod: 'jwt' };
    expect(guard.canActivate(makeContext({}, verifiedActor))).toBe(true);
    // Same permission requirement, but only a header stand-in actor — must still be denied
    expect(() => guard.canActivate(makeContext({ 'x-user-role': Role.STOREKEEPER }))).toThrow(ForbiddenException);
  });

  it('leaves handlers without @RequireVerifiedActor entirely unaffected (default parameter false)', () => {
    const guard = makeGuard(['inventory.adjust']);
    expect(guard.canActivate(makeContext({ 'x-user-role': Role.STOREKEEPER }))).toBe(true);
  });
});
