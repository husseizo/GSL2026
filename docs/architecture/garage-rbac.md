# Garage RBAC (Phase 3)

Extends [rbac-permissions.md](rbac-permissions.md) additively — the same two-layer model (`RolesGuard`/`@Roles` from Phase 1, `PermissionsGuard`/`@RequirePermissions` from Phase 2) with garage-specific roles and permissions added, nothing renamed or removed.

## New roles

`Role` (Prisma enum) gains, additively: `GARAGE_MANAGER`, `WORKSHOP_SUPERVISOR`, `RECEPTION`, `TECHNICIAN`, `DIAGNOSTIC_TECHNICIAN`, `QUALITY_INSPECTOR`, `SERVICE_ADVISOR`, applied via migration `20260711030919_phase3_garage_roles` (`ALTER TYPE "Role" ADD VALUE ...`).

## New permissions

`src/common/permissions/permission.ts` adds, in a clearly-marked "Phase 3 — garage operations" block: `reception.read`/`.manage`, `jobcard.read`/`.manage`/`.transition`, `inspection.read`/`.manage`, `diagnostics.read`/`.manage`, `estimate.read`/`.manage`/`.approve`, `labour.read`/`.manage`, `technician.read`/`.manage`, `qc.read`/`.manage`, `timeline.read`, `notifications.read`/`.manage`. `ALL_READ` (used by `AUDITOR`/`READ_ONLY_VIEWER`) is extended with the new `*.read` permissions so auditor/viewer oversight automatically covers the garage domain without a second grant list.

## Role → permission mapping (`role-permissions.ts`)

| Role | Scope |
|---|---|
| `GARAGE_MANAGER` | Full garage read/manage + `jobcard.transition` + `estimate.approve` + inventory read/adjust + recommendation read/generate + customer read — the single role that can run the whole garage floor end to end. |
| `WORKSHOP_SUPERVISOR` | Job/inspection/diagnostics/labour/technician/QC read+manage + `jobcard.transition`, but **not** `estimate.approve` — day-to-day workshop floor control without customer-facing commercial authority. |
| `RECEPTION` | `reception.manage`, `jobcard.read` (not manage), `customer.read`, `timeline.read` — check-in only, no workflow authority. |
| `TECHNICIAN` | `jobcard.transition` + inspection/diagnostics/labour manage + `technician.read` — can do the work and move the job forward, cannot approve estimates or manage other technicians. |
| `DIAGNOSTIC_TECHNICIAN` | Narrower than `TECHNICIAN`: diagnostics + inspection manage, no labour/technician management, no `jobcard.transition` — a specialist who feeds findings into the job, not one who drives its workflow. |
| `QUALITY_INSPECTOR` | `qc.manage` + read-only elsewhere — final-check authority, no upstream editing rights. |
| `SERVICE_ADVISOR` | `estimate.manage`, `reception.read`, `customer.manage`, `notifications.manage` — the customer-facing commercial role; no job-transition or QC authority. |

Existing Phase 1/2 roles (`GENERAL_MANAGER`, `BRANCH_MANAGER`) are extended with the relevant garage `*.manage`/`.transition`/`.approve` grants so a general/branch manager retains cross-domain authority without needing a second garage-specific role.

## Enforcement and scope limitations — unchanged from Phase 2

`PermissionsGuard` requires **all** listed permissions per endpoint, same as Phase 2. Branch/warehouse scoping is still a placeholder — a `WORKSHOP_SUPERVISOR` can call job-card endpoints for any branch, not just their own, exactly the same limitation already documented in [rbac-permissions.md §"Scope limitations"](rbac-permissions.md). Real authentication (and therefore a trustworthy actor identity to scope against) remains a later-phase dependency.
