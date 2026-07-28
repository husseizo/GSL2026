import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  function makeGuard(requiredPermissions: string[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions) } as unknown as Reflector;
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
});
