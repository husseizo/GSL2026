import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { PERMISSIONS_KEY } from '../common/permissions/permissions.decorator';
import { RequestActor } from '../common/permissions/request-actor';
import { RolesGuard } from '../common/rbac/roles.guard';
import { ROLES_KEY } from '../common/rbac/roles.decorator';
import { IntegrationController } from './integration.controller';

// Platform Remediation PEP-3 (WP-3.1 — Integration Controller Permission
// Migration). These tests exercise the REAL decorator metadata NestJS
// attaches to IntegrationController (via a real, unmocked Reflector),
// fed through a REAL (unmocked) PermissionsGuard instance — not a
// hand-simulated re-implementation of the guard's logic, which is
// already covered by permissions.guard.spec.ts. This proves the actual
// migrated controller, not just the general guard mechanism.
describe('IntegrationController authorization (post-WP-3.1 migration)', () => {
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
      getClass: () => IntegrationController,
      switchToHttp: () => ({ getRequest: () => ({ headers, verifiedActor }) }),
    } as unknown as ExecutionContext;
  }

  describe('class-level guard migration', () => {
    it('is decorated with PermissionsGuard, not RolesGuard', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, IntegrationController) as unknown[];
      expect(guards).toContain(PermissionsGuard);
      expect(guards).not.toContain(RolesGuard);
    });
  });

  describe('method-level decorator migration', () => {
    it.each([
      ['syncVehicles', ['integration.sync']],
      ['syncParts', ['integration.sync']],
      ['listDeadLetters', ['integration.deadLetters.read']],
      ['resolveDeadLetter', ['integration.deadLetters.resolve']],
    ])('%s carries @RequirePermissions(%p) and no @Roles metadata', (methodName, expectedPermissions) => {
      const handler = (IntegrationController.prototype as unknown as Record<string, () => unknown>)[methodName];
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(expectedPermissions);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
    });
  });

  describe.each([
    {
      name: 'syncVehicles',
      handler: IntegrationController.prototype.syncVehicles,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR],
      deniedRoles: [Role.DATA_QUALITY_REVIEWER, Role.PARTS_MANAGER, Role.GENERAL_MANAGER, Role.STOREKEEPER],
    },
    {
      name: 'syncParts',
      handler: IntegrationController.prototype.syncParts,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR],
      deniedRoles: [Role.DATA_QUALITY_REVIEWER, Role.PARTS_MANAGER, Role.GENERAL_MANAGER, Role.STOREKEEPER],
    },
    {
      name: 'listDeadLetters',
      handler: IntegrationController.prototype.listDeadLetters,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.DATA_QUALITY_REVIEWER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR, Role.DATA_QUALITY_REVIEWER],
      deniedRoles: [Role.PARTS_MANAGER, Role.GENERAL_MANAGER, Role.STOREKEEPER],
    },
    {
      name: 'resolveDeadLetter',
      handler: IntegrationController.prototype.resolveDeadLetter,
      grantedRoles: [Role.SYSTEM_ADMINISTRATOR, Role.OWNER, Role.DATA_QUALITY_REVIEWER],
      previouslyValidRoles: [Role.SYSTEM_ADMINISTRATOR, Role.DATA_QUALITY_REVIEWER],
      deniedRoles: [Role.PARTS_MANAGER, Role.GENERAL_MANAGER, Role.STOREKEEPER],
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

    it('no endpoint loses protection: an unrecognized/absent role is still rejected, never silently allowed', () => {
      expect(() => guard.canActivate(makeContext(handler, { 'x-user-role': undefined as unknown as Role }))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('approved, intentional exception — OWNER (documented in the Technical Specification mapping table)', () => {
    it('OWNER gains access on all four migrated endpoints — an explicit, approved broadening, not a regression (OWNER already holds every permission platform-wide via the pre-existing ROLE_PERMISSIONS spread; RolesGuard previously blocked OWNER here purely because it never consulted that map)', () => {
      const handlers = [
        IntegrationController.prototype.syncVehicles,
        IntegrationController.prototype.syncParts,
        IntegrationController.prototype.listDeadLetters,
        IntegrationController.prototype.resolveDeadLetter,
      ];
      for (const handler of handlers) {
        expect(guard.canActivate(makeContext(handler, { 'x-user-role': Role.OWNER }))).toBe(true);
      }
    });
  });
});
