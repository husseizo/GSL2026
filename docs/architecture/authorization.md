# Phase 5 — Policy-Based Authorization

Layers hierarchical scope-checking on top of the existing Phase 1–3 static `ROLE_PERMISSIONS` map (`src/common/permissions/role-permissions.ts`) — it is not replaced. See [identity-platform.md](identity-platform.md) for how a request gets an authenticated actor in the first place.

## Design

`src/authorization/policy-engine.ts` is pure functions, no DI, no I/O:

- `ORG_WIDE_ROLES` — `SYSTEM_ADMINISTRATOR`, `OWNER`, `GENERAL_MANAGER`, `AUDITOR`, `READ_ONLY_VIEWER`. These roles bypass branch/warehouse scope checks entirely (an auditor must be able to see every branch).
- `isOrgWideRole(role)` — the bypass check.
- `isWithinScope(actor, resourceBranchId)` — true if the actor's role is org-wide, or the actor's `branchId` matches the resource's. Same shape for warehouse scope.
- `isOwner(actor, resourceOwnerId)` — for vehicle-ownership/document-ownership/approval-authority checks (e.g. a technician editing their own job card vs. someone else's).

These compose with, rather than replace, the existing permission-name checks (`garage.jobs.create`, `inventory.issue`, `vehicle.edit`, etc. — all still resolved through `ROLE_PERMISSIONS`). Phase 5 adds new permission names additively for its own new resources: `system.admin`, `identity.manage`, `apikeys.manage`, `security.read`, `integration.manage`, `branchGateway.read`/`.manage`, `backup.manage`, `observability.read` (`src/common/permissions/permission.ts`).

## Enforcement

`@RequireBranchScope('branchId')` (`src/authorization/scope.decorator.ts`) marks a route parameter as the resource's branch; `ScopeGuard` (`src/authorization/scope.guard.ts`) reads it, calls `isWithinScope()`, and throws `ForbiddenException` on a mismatch — same enforcement point pattern as the existing `RolesGuard`/`PermissionsGuard`, just for a different axis (scope, not role-permission). Applied so far to `branch-gateway.controller.ts`.

## Hierarchy

Org → Branch → Warehouse/Garage/Department → Role → Permission → ownership. Only the levels that have real data in this build (organization, branch, warehouse) are enforced by `isWithinScope()`; garage/department are represented in the data model (`GarageJob.branchId`, technician assignment) but don't yet have a distinct scope-check axis of their own — they inherit branch scope.

## Tests

`policy-engine.spec.ts` (pure unit tests, all role/scope/ownership combinations), `scope.guard.spec.ts`.

## Known limitations

- Not a general-purpose policy DSL (no Rego/Cedar/OPA) — deliberately a small set of composable pure functions, consistent with the existing decision to keep `ROLE_PERMISSIONS` a static, auditable-by-reading map (see [decision-log.md](decision-log.md)). A rules engine is a reasonable addition once permission structures need to change without a deploy.
- `ScopeGuard` is applied per-controller, not globally — each Phase 5 controller that needs branch/warehouse scoping opts in explicitly, the same pattern as `@UseGuards(RolesGuard)` in every prior phase.
