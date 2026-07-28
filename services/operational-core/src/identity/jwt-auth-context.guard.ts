import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RequestActor } from '../common/permissions/request-actor';
import { ApiKeysService } from './api-keys.service';
import { AuthTokenService } from './auth-token.service';

// Registered as a global guard (APP_GUARD in identity.module.ts) so it runs
// on every request ahead of any route-specific guard, without a single
// existing controller's @UseGuards(...) list needing to change. Its only
// job is enrichment: if a valid Bearer JWT or x-api-key is presented, it
// resolves the real actor and attaches it to the request; if not, or if the
// credential is invalid, it does nothing and returns true, letting
// PermissionsGuard/RolesGuard fall back to the legacy header stand-in via
// getRequestActor(). This guard never itself rejects a request — an
// invalid/expired JWT is not a 401 from here, it's simply "no verified
// actor," and whatever guard actually requires a permission decides what to
// do with that. See docs/architecture/identity-platform.md.
@Injectable()
export class JwtAuthContextGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly apiKeys: ApiKeysService,
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
      } catch {
        // Invalid/expired token — leave verifiedActor unset, fall back to headers.
      }
    } else if (apiKeyHeader) {
      try {
        const key = await this.apiKeys.verify(apiKeyHeader);
        request.verifiedActor = {
          role: key.role,
          userId: key.ownerUserId ?? undefined,
          authMethod: 'api-key',
        } satisfies RequestActor;
      } catch {
        // Invalid/revoked key — same fallback behavior.
      }
    }

    return true;
  }

  private headerValue(value: unknown): string | undefined {
    return Array.isArray(value) ? value[0] : (value as string | undefined);
  }
}
