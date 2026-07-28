import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from './permission';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { getRequestActor } from './request-actor';
import { ROLE_PERMISSIONS } from './role-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actor = getRequestActor(request);

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
