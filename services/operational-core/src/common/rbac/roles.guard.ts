import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

// Phase 1 skeleton: there is no authentication module yet (that lands with
// the CRM/user-management phase). This guard demonstrates the RBAC shape —
// it trusts an `x-user-role` header — so real auth can slot in later by
// replacing only how `actorRole` is resolved, not the guard contract itself.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actorRole = request.headers['x-user-role'] as Role | undefined;

    if (!actorRole || !requiredRoles.includes(actorRole)) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
