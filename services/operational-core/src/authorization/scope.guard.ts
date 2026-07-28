import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRequestActor } from '../common/permissions/request-actor';
import { isWithinScope } from './policy-engine';
import { SCOPE_FIELD_KEY } from './scope.decorator';

// Additive to PermissionsGuard, not a replacement — applied alongside it
// via @UseGuards(PermissionsGuard, ScopeGuard) on routes that opt in with
// @RequireBranchScope(). Routes that don't use the decorator are
// unaffected (this guard is a no-op without metadata), which is what keeps
// every existing Phase 1-4 controller working without modification. See
// docs/architecture/authorization.md.
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const field = this.reflector.getAllAndOverride<string>(SCOPE_FIELD_KEY, [context.getHandler(), context.getClass()]);
    if (!field) return true;

    const request = context.switchToHttp().getRequest();
    const actor = getRequestActor(request);
    if (!actor.role) return true; // PermissionsGuard already rejects a missing role; nothing new to add here.

    const resourceBranchId = request.params?.[field] ?? request.query?.[field] ?? request.body?.[field];

    const allowed = isWithinScope({ actorRole: actor.role, actorBranchId: actor.branchId, actorWarehouseId: actor.warehouseId }, { branchId: resourceBranchId });
    if (!allowed) {
      throw new ForbiddenException(`Role ${actor.role} is not authorized for branch ${resourceBranchId}`);
    }
    return true;
  }
}
