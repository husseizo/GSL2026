import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

// PEP-4 (WP-4.0 — Regression Consolidation & RolesGuard Test Coverage, see
// docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
// §4, PRTS-004). RolesGuard itself is unchanged — this file only adds the
// dedicated unit test coverage the Technical Specification identified as
// missing. As of PEP-3's own completion, RolesGuard has zero real callers
// in the codebase (every controller that used it now uses PermissionsGuard
// instead), but the guard's existing, unchanged behavior is still worth
// regression-protecting for as long as the file is retained (removal
// remains a separate, future, out-of-scope decision).
//
// Uses a real, unmocked Reflector reading real @Roles(...) metadata off
// real fixture classes below — not a hand-simulated re-implementation of
// Reflector.getAllAndOverride — so these tests exercise the actual
// decorator/guard interaction, matching the same rigor already applied to
// PermissionsGuard's own real-metadata tests in PEP-3.

// No decorator anywhere on this class — represents a genuinely open route.
class UndecoratedController {
  openMethod() {}
}

@Roles(Role.SYSTEM_ADMINISTRATOR)
class RolesGuardFixtureController {
  // No method-level @Roles — falls back to the class-level metadata above.
  classLevelOnly() {}

  // A method-level @Roles OVERRIDES the class-level one entirely
  // (Reflector.getAllAndOverride semantics are "override", not "merge").
  // Also proves RolesGuard grants OWNER no implicit bypass: unlike
  // PermissionsGuard (whose ROLE_PERMISSIONS map gives OWNER every
  // permission), RolesGuard checks only the literal @Roles(...) list, so
  // OWNER is correctly denied here.
  @Roles(Role.PARTS_MANAGER)
  methodLevelOverride() {}

  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.OWNER)
  multiRoleMethod() {}
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function makeContext(
    handler: (...args: any[]) => unknown,
    targetClass: unknown,
    headers: Record<string, string | undefined>,
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext;
  }

  describe('missing role metadata (genuinely open route)', () => {
    it('allows the request through unconditionally, with or without a role header', () => {
      expect(
        guard.canActivate(makeContext(UndecoratedController.prototype.openMethod, UndecoratedController, {})),
      ).toBe(true);
      expect(
        guard.canActivate(
          makeContext(UndecoratedController.prototype.openMethod, UndecoratedController, {
            'x-user-role': Role.SALESPERSON,
          }),
        ),
      ).toBe(true);
    });
  });

  describe('class-level @Roles metadata (decorator/reflector interaction)', () => {
    it('grants access when the header matches the class-level required role (administrator behaviour)', () => {
      expect(
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.classLevelOnly, RolesGuardFixtureController, {
            'x-user-role': Role.SYSTEM_ADMINISTRATOR,
          }),
        ),
      ).toBe(true);
    });

    it('denies access when the header does not match the class-level required role', () => {
      expect(() =>
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.classLevelOnly, RolesGuardFixtureController, {
            'x-user-role': Role.SALESPERSON,
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('denies access when no x-user-role header is present at all (missing authentication)', () => {
      expect(() =>
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.classLevelOnly, RolesGuardFixtureController, {}),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('method-level @Roles overrides class-level metadata entirely', () => {
    it('grants access to the method-level required role, not the class-level one', () => {
      expect(
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.methodLevelOverride, RolesGuardFixtureController, {
            'x-user-role': Role.PARTS_MANAGER,
          }),
        ),
      ).toBe(true);
    });

    it('denies the class-level role once a method-level override is present — override, not merge', () => {
      expect(() =>
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.methodLevelOverride, RolesGuardFixtureController, {
            'x-user-role': Role.SYSTEM_ADMINISTRATOR,
          }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('denies OWNER when OWNER is not explicitly listed — RolesGuard performs no implicit superuser bypass (owner behaviour, contrasted with PermissionsGuard)', () => {
      expect(() =>
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.methodLevelOverride, RolesGuardFixtureController, {
            'x-user-role': Role.OWNER,
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('multiple required roles', () => {
    it('grants access to every explicitly listed role (administrator and owner behaviour)', () => {
      expect(
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.multiRoleMethod, RolesGuardFixtureController, {
            'x-user-role': Role.SYSTEM_ADMINISTRATOR,
          }),
        ),
      ).toBe(true);
      expect(
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.multiRoleMethod, RolesGuardFixtureController, {
            'x-user-role': Role.OWNER,
          }),
        ),
      ).toBe(true);
    });

    it('denies a role not in the list', () => {
      expect(() =>
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.multiRoleMethod, RolesGuardFixtureController, {
            'x-user-role': Role.STOREKEEPER,
          }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('regression: exact denial message is preserved', () => {
    it('the ForbiddenException lists every required role, in declaration order', () => {
      expect(() =>
        guard.canActivate(
          makeContext(RolesGuardFixtureController.prototype.multiRoleMethod, RolesGuardFixtureController, {}),
        ),
      ).toThrow(`Requires one of roles: ${Role.SYSTEM_ADMINISTRATOR}, ${Role.OWNER}`);
    });
  });
});
