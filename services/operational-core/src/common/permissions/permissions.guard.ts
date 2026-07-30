import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from './permission';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { REQUIRE_VERIFIED_ACTOR_KEY } from './require-verified-actor.decorator';
import { getRequestActor } from './request-actor';
import { ROLE_PERMISSIONS } from './role-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actor = getRequestActor(request);

    // Platform Remediation PEP-2 (docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
    // §4, PRTS-002): additive, opt-in — checked before any permission
    // evaluation, and independent of whether @RequirePermissions is also
    // present, so a handler can mandate a verified identity on its own. No
    // existing handler uses this decorator, so this check is a no-op for
    // every current caller.
    const requiresVerifiedActor = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_ACTOR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiresVerifiedActor && actor.authMethod !== 'jwt' && actor.authMethod !== 'api-key') {
      throw new ForbiddenException('This action requires a verified identity (JWT or API key), not a legacy role header');
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    if (!actor.role) {
      throw new ForbiddenException('Missing x-user-role header');
    }

    const granted = ROLE_PERMISSIONS[actor.role] ?? [];
    const missing = required.filter((permission) => !granted.includes(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(`Role ${actor.role} is missing permission(s): ${missing.join(', ')}`);
    }

    return true;
  }
}
