import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { PERMISSIONS_KEY } from '../common/permissions/permissions.decorator';
import { RequestActor } from '../common/permissions/request-actor';
import { RolesGuard } from '../common/rbac/roles.guard';
import { ROLES_KEY } from '../common/rbac/roles.decorator';
import { PartsController } from './parts.controller';

// Platform Remediation PEP-3 (WP-3.2 — Parts Controller Permission
// Migration). Mirrors integration.controller.authorization.spec.ts's
// (WP-3.1) approach exactly: exercises the REAL decorator metadata
// NestJS attaches to PartsController (via a real, unmocked Reflector),
// fed through a REAL (unmocked) PermissionsGuard instance — not a
// hand-simulated re-implementation of the guard's logic, which is
// already covered by permissions.guard.spec.ts.
describe('PartsController authorization (post-WP-3.2 migration)', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  // Accepts any of the controller's real handler methods — their parameter
  // signatures vary (some take no args, some take DTOs), and only the
  // function reference itself (for Reflector metadata lookup) matters here.
  function makeContext(
    handler: (...args: any[]) => unknown,
    headers: Record<string, string>,
    verifiedActor?: RequestActor,
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => PartsController,
      switchToHttp: () => ({ getRequest: () => ({ headers, verifiedActor }) }),
    } as unknown as ExecutionContext;
  }

  describe('class-level guard migration', () => {
    it('is decorated with PermissionsGuard, not RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, PartsController) as unknown[];
      expect(guards).toContain(PermissionsGuard);
      expect(guards).not.toContain(RolesGuard);
    });
  });

  describe('method-level decorator migration', () => {
    it.each([
      ['create', ['parts.create']],
      ['runMatching', ['parts.matchCandidates.manage']],
      ['listMatchCandidates', ['parts.matchCandidates.manage']],
      ['reviewMatchCandidate', ['parts.matchCandidates.manage']],
    ])('%s carries @RequirePermissions(%p) and no @Roles metadata', (methodName, expectedPermissions) => {
      const handler = (PartsController.prototype as unknown as Record<string, () => unknown>)[methodName];
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(expectedPermissions);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
    });

    it('list and findById (GET /parts, GET /parts/:id) remain undecorated — open today, explicitly out of scope', () => {
      for (const methodName of ['list', 'findById']) {
        const handler = (PartsController.prototype as unknown as Record<string, () => unknown>)[methodName];
        expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toBeUndefined();
        expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
      }
    });
  });

  describe.each([
    {
      name: 'create (POST /parts)',
      handler: PartsController.prototype.create,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.PARTS_MANAGER, Role.STOREKEEPER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER, Role.STOREKEEPER],
      deniedRoles: [Role.DATA_QUALITY_REVIEWER, Role.GENERAL_MANAGER, Role.BRANCH_MANAGER, Role.LUBRICANTS_MANAGER],
    },
    {
      name: 'runMatching (POST /parts/match-candidates/run)',
      handler: PartsController.prototype.runMatching,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.PARTS_MANAGER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER],
      deniedRoles: [Role.STOREKEEPER, Role.DATA_QUALITY_REVIEWER, Role.GENERAL_MANAGER, Role.BRANCH_MANAGER],
    },
    {
      name: 'listMatchCandidates (GET /parts/match-candidates)',
      handler: PartsController.prototype.listMatchCandidates,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.PARTS_MANAGER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER],
      deniedRoles: [Role.STOREKEEPER, Role.DATA_QUALITY_REVIEWER, Role.GENERAL_MANAGER, Role.BRANCH_MANAGER],
    },
    {
      name: 'reviewMatchCandidate (PATCH /parts/match-candidates/:id/review)',
      handler: PartsController.prototype.reviewMatchCandidate,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.PARTS_MANAGER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR, Role.PARTS_MANAGER],
      deniedRoles: [Role.STOREKEEPER, Role.DATA_QUALITY_REVIEWER, Role.GENERAL_MANAGER, Role.BRANCH_MANAGER],
    },
  ])('$name', ({ handler, grantedRoles, previouslyValidRoles, deniedRoles }) => {
    it('grants access to every currently-mapped role (header stand-in)', () => {
      for (const role of grantedRoles) {
        expect(guard.canActivate(makeContext(handler, { 'x-user-role': role }))).toBe(true);
      }
    });

    it('every previously-valid role (pre-migration @Roles(...)) remains valid', () => {
      for (const role of previouslyValidRoles) {
        expect(guard.canActivate(makeContext(handler, { 'x-user-role': role }))).toBe(true);
      }
    });

    it('denies roles outside the mapping table (previously denied, remain denied)', () => {
      for (const role of deniedRoles) {
        expect(() => guard.canActivate(makeContext(handler, { 'x-user-role': role }))).toThrow(ForbiddenException);
      }
    });

    it('denies when no credential/header is present at all (missing authentication)', () => {
      expect(() => guard.canActivate(makeContext(handler, {}))).toThrow(ForbiddenException);
    });

    it('denies an authenticated (verified JWT) actor whose role lacks the permission', () => {
      const verifiedActor: RequestActor = { role: Role.SALESPERSON, userId: 'user-1', authMethod: 'jwt' };
      expect(() => guard.canActivate(makeContext(handler, {}, verifiedActor))).toThrow(ForbiddenException);
    });

    it('allows a verified-JWT System Administrator (administrator access)', () => {
      const verifiedActor: RequestActor = { role: Role.SYSTEM_ADMINISTRATOR, userId: 'admin-1', authMethod: 'jwt' };
      expect(guard.canActivate(makeContext(handler, {}, verifiedActor))).toBe(true);
    });

    it('allows a verified-JWT Owner (owner access — approved mapping-table exception)', () => {
      const verifiedActor: RequestActor = { role: Role.OWNER, userId: 'owner-1', authMethod: 'jwt' };
      expect(guard.canActivate(makeContext(handler, {}, verifiedActor))).toBe(true);
    });

    it('no endpoint becomes publicly accessible: an unrecognized/absent role is still rejected, never silently allowed', () => {
      expect(() => guard.canActivate(makeContext(handler, { 'x-user-role': undefined as unknown as Role }))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('approved, intentional exception — OWNER (documented in the Technical Specification mapping table)', () => {
    it('OWNER gains access on all four migrated endpoints — an explicit, approved broadening, not a regression (OWNER already holds every permission platform-wide via the pre-existing ROLE_PERMISSIONS spread; RolesGuard previously blocked OWNER here purely because it never consulted that map)', () => {
      const handlers = [
        PartsController.prototype.create,
        PartsController.prototype.runMatching,
        PartsController.prototype.listMatchCandidates,
        PartsController.prototype.reviewMatchCandidate,
      ];
      for (const handler of handlers) {
        expect(guard.canActivate(makeContext(handler, { 'x-user-role': Role.OWNER }))).toBe(true);
      }
    });
  });
});
