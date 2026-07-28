# RBAC and Permissions (Phase 2)

Phase 1 shipped a role-only guard (`RolesGuard`/`@Roles`) trusting an `x-user-role` header as a stand-in for real authentication (no auth module exists yet — there's still no login, no JWT, no session). Phase 2 adds a **permission-based** layer alongside it — `PermissionsGuard`/`@RequirePermissions` — without touching or replacing `RolesGuard`; existing Phase 1 controllers (vehicles, parts, integration) keep using roles directly, Phase 2 controllers use permissions.

## Role enum — extended, not renamed

`Role` (Prisma enum, `prisma/schema.prisma`) keeps every Phase 1 value exactly as-is (`SYSTEM_ADMINISTRATOR`, `OWNER`, `GENERAL_MANAGER`, `BRANCH_MANAGER`, `PARTS_MANAGER`, `STOREKEEPER`, `PURCHASING_MANAGER`, `DATA_QUALITY_REVIEWER`, `READ_ONLY_VIEWER`) and adds four new values the Phase 2 spec needs: `LUBRICANTS_MANAGER`, `PURCHASING_OFFICER`, `SALESPERSON`, `AUDITOR`.

The Phase 2 spec's own role list uses slightly different names than Phase 1 chose (`SYSTEM_ADMIN` vs. `SYSTEM_ADMINISTRATOR`, `VIEWER` vs. `READ_ONLY_VIEWER`). Rather than rename Phase 1's enum values — which the task explicitly said not to do — this maps them:

| Spec's name | This system's `Role` value |
|---|---|
| `SYSTEM_ADMIN` | `SYSTEM_ADMINISTRATOR` |
| `VIEWER` | `READ_ONLY_VIEWER` |
| (all others) | same name |

## Permission set

`src/common/permissions/permission.ts` — a fixed, code-level list (`organization.read`/`.manage`, `warehouse.*`, `customer.*`, `parts.*`, `lubricants.*`, `sales.read`/`.import`, `purchases.read`/`.import`, `inventory.read`/`.adjust`, `logs.read`/`.import`, `lostSales.read`/`.review`, `recommendations.read`/`.generate`/`.approve`, `supplierAnalytics.read`, `audit.read`) — exactly the spec's list.

`src/common/permissions/role-permissions.ts` maps each `Role` to its granted permission set, explicitly (no "inherits from" chain to trace) — see [decision-log.md](decision-log.md) for why this is a static map, not a DB-backed permission table.

## Enforcement

`@RequirePermissions('inventory.adjust')` + `PermissionsGuard` — requires **all** listed permissions, throws `ForbiddenException` naming the missing one(s) if the actor's role doesn't have them. Tested directly (no DB, mocked `ExecutionContext`) in `permissions.guard.spec.ts`: denial for a role lacking the permission, denial with no role header at all, denial when only some of several required permissions are granted, and the allow path.

## Scope limitations (explicitly not fully enforced yet)

`src/common/permissions/request-actor.ts` extends Phase 1's header-based actor stand-in with `x-branch-id`/`x-warehouse-id` headers, but **branch/warehouse scoping is not enforced on every endpoint** — it's a placeholder for a later phase once real authentication (and therefore a trustworthy actor identity) exists. Concretely: a `BRANCH_MANAGER` can currently call inventory/sales endpoints for *any* branch, not just their own, as long as their role has the permission. Do not treat the presence of `x-branch-id` as an access-control guarantee.

## Auditor role

`AUDITOR` gets every `*.read` permission and nothing else — read-only oversight across the whole system, distinct from `READ_ONLY_VIEWER` (same grants today, kept as separate roles since the spec names them separately and a later phase may want to diverge, e.g. giving `AUDITOR` access to raw audit-log detail a generic viewer shouldn't see).
