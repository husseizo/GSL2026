import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ScopeGuard } from './scope.guard';

function makeContext(headers: Record<string, string>, params: Record<string, string> = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers, params, query: {}, body: {} }) }),
  } as unknown as ExecutionContext;
}

describe('ScopeGuard', () => {
  function makeGuard(scopeField: string | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(scopeField) } as unknown as Reflector;
    return new ScopeGuard(reflector);
  }

  it('is a no-op when the route has no @RequireBranchScope metadata', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext({ 'x-user-role': Role.BRANCH_MANAGER }, { branchId: 'branch-other' }))).toBe(true);
  });

  it('allows an org-wide role regardless of the resource branch', () => {
    const guard = makeGuard('branchId');
    expect(guard.canActivate(makeContext({ 'x-user-role': Role.GENERAL_MANAGER }, { branchId: 'branch-anything' }))).toBe(true);
  });

  it('allows a branch-scoped role when the resource branch matches its own', () => {
    const guard = makeGuard('branchId');
    expect(guard.canActivate(makeContext({ 'x-user-role': Role.BRANCH_MANAGER, 'x-branch-id': 'branch-a' }, { branchId: 'branch-a' }))).toBe(true);
  });

  it('denies a branch-scoped role when the resource branch differs from its own', () => {
    const guard = makeGuard('branchId');
    expect(() => guard.canActivate(makeContext({ 'x-user-role': Role.BRANCH_MANAGER, 'x-branch-id': 'branch-a' }, { branchId: 'branch-b' }))).toThrow(ForbiddenException);
  });

  it('passes through when no role is present (PermissionsGuard is responsible for that rejection)', () => {
    const guard = makeGuard('branchId');
    expect(guard.canActivate(makeContext({}, { branchId: 'branch-a' }))).toBe(true);
  });
});
