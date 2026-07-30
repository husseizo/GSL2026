import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Permission } from '../common/permissions/permission';
import { PERMISSIONS_KEY } from '../common/permissions/permissions.decorator';
import { RequestActor } from '../common/permissions/request-actor';
import { ROLES_KEY } from '../common/rbac/roles.decorator';
import { ApiKeysService } from './api-keys.service';
import { AuthTokenService } from './auth-token.service';

// Registered as a global guard (APP_GUARD in identity.module.ts) so it runs
// on every request ahead of any route-specific guard, without a single
// existing controller's @UseGuards(...) list needing to change. If a valid
// Bearer JWT or x-api-key is presented, it resolves the real actor and
// attaches it to the request. If no credential is presented at all, it does
// nothing and returns true, letting PermissionsGuard/RolesGuard fall back to
// the legacy header stand-in via getRequestActor() — this preserves every
// endpoint that intentionally requires no actor (health checks, the
// authentication endpoints themselves, undecorated read endpoints, etc.).
// See docs/architecture/identity-platform.md.
//
// Platform Remediation PEP-1 (docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
// §4, PRTS-001): a credential that IS presented but fails verification is no
// longer silently treated the same as no credential at all — but only on a
// route whose resolved handler already carries @RequirePermissions(...) or
// @Roles(...) metadata. On a route with neither, an invalid credential is
// still tolerated exactly as before, preserving backward compatibility for
// every genuinely open endpoint.
@Injectable()
export class JwtAuthContextGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly apiKeys: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = this.headerValue(request.headers.authorization);
    const apiKeyHeader = this.headerValue(request.headers['x-api-key']);

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length);
      try {
        const claims = this.tokens.verifyAccessToken(token);
        request.verifiedActor = {
          role: claims.role,
          userId: claims.sub,
          branchId: claims.branchId,
          sessionId: claims.sessionId,
          authMethod: 'jwt',
        } satisfies RequestActor;
      } catch (error) {
        if (this.requiresActorCheck(context)) {
          throw error;
        }
        // Invalid/expired token on a route with no permission/role
        // requirement — leave verifiedActor unset, fall back to headers.
      }
    } else if (apiKeyHeader) {
      try {
        const key = await this.apiKeys.verify(apiKeyHeader);
        request.verifiedActor = {
          role: key.role,
          userId: key.ownerUserId ?? undefined,
          authMethod: 'api-key',
        } satisfies RequestActor;
      } catch (error) {
        if (this.requiresActorCheck(context)) {
          throw error;
        }
        // Invalid/revoked key — same fallback behavior.
      }
    }

    return true;
  }

  // True when the resolved handler already requires a permission or role —
  // i.e., the route is not one of the deliberately open ones (health
  // checks, /auth/* login endpoints, undecorated read endpoints).
  private requiresActorCheck(context: ExecutionContext): boolean {
    const permissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    return Boolean(permissions?.length) || Boolean(roles?.length);
  }

  private headerValue(value: unknown): string | undefined {
    return Array.isArray(value) ? value[0] : (value as string | undefined);
  }
}
