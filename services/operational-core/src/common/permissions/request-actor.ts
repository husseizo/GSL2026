import { Role } from '@prisma/client';

export interface RequestActor {
  role?: Role;
  userId?: string;
  branchId?: string;
  warehouseId?: string;
  sessionId?: string;
  authMethod?: 'jwt' | 'api-key' | 'header-stand-in';
}

// Phase 1's RolesGuard trusted an `x-user-role` header as a stand-in for
// real auth. Phase 5's Identity Platform (JwtAuthContextGuard, a global
// guard — see src/identity/jwt-auth-context.guard.ts) now runs first on
// every request and, when a valid `Authorization: Bearer <jwt>` or
// `x-api-key` is present, attaches a verified `request.verifiedActor`
// before this function ever runs. getRequestActor() prefers that verified
// actor and only falls back to the legacy headers when no verified
// credential was presented — same return shape either way, so every
// existing PermissionsGuard/RolesGuard call site from Phases 1-4 needed
// zero changes. See docs/architecture/identity-platform.md and
// docs/architecture/rbac-permissions.md §"Scope limitations" for exactly
// which endpoints still rely on the (now legacy, still supported) header
// stand-in.
export function getRequestActor(request: {
  headers: Record<string, string | string[] | undefined>;
  verifiedActor?: RequestActor;
}): RequestActor {
  if (request.verifiedActor) return request.verifiedActor;

  const header = (name: string): string | undefined => {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    role: header('x-user-role') as Role | undefined,
    userId: header('x-user-id'),
    branchId: header('x-branch-id'),
    warehouseId: header('x-warehouse-id'),
    authMethod: header('x-user-role') ? 'header-stand-in' : undefined,
  };
}
