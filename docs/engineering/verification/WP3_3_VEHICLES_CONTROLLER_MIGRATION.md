# PEP-3 WP-3.3 — Vehicles Controller Permission Migration — Implementation Report

## Status: IMPLEMENTATION COMPLETE — PEP-3 CONTROLLER MIGRATION FULLY COMPLETE

---

## Document Control

| Field | Value |
|---|---|
| Document | WP-3.3 Vehicles Controller Permission Migration Implementation Report |
| Phase | PEP-3 (Permission Migration) — Work Package WP-3.3 (Vehicles Controller) — final controller-migration work package |
| Authorized by | `docs/engineering/PEP3A_READINESS_AND_SCOPE_LOCK.md`; `docs/engineering/verification/WP3_0_PERMISSION_FOUNDATION_IMPLEMENTATION.md`; `docs/engineering/verification/WP3_1_INTEGRATION_CONTROLLER_MIGRATION.md`; `docs/engineering/verification/WP3_2_PARTS_CONTROLLER_MIGRATION.md` |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md` §4 (PRTS-003) mapping table |
| Effective date | 2026-07-31 |

---

## 1. Executive Summary

WP-3.3 migrates the third and final controller — `src/vehicles/vehicles.controller.ts` — from `@UseGuards(RolesGuard)` + `@Roles(...)` to `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`, using only the two permission constants WP-3.0 already introduced for this controller (`vehicle.create`, `vehicle.correct`). The change is a pure guard/decorator swap: every business-logic line, constructor dependency, endpoint path, DTO, and service call is byte-for-byte unchanged. The three undecorated `GET` endpoints (`list`, `findByVin`, `findById`) remain exactly as they were — open, no permission requirement — matching the Technical Specification's explicit out-of-scope decision. No other controller, service, module, DTO, permission constant, or schema file was touched. A new authorization test file (22 tests) exercises the real, migrated controller's actual decorator metadata through a real (unmocked) `PermissionsGuard` and `Reflector`, following the identical pattern WP-3.1 and WP-3.2 established. A direct, cross-controller comparison (§7) confirms all three migrated controllers now follow an identical authorization pattern with zero residual `RolesGuard`/`@Roles` code. The full repository suite passes at 108/108 suites, 820/820 tests (up from the WP-3.2 baseline of 107/798 by exactly the 22 new tests, zero regressions). `tsc --noEmit` and `eslint` both report zero issues. **This completes PEP-3's controller-migration scope (PRTS-003) — all three previously `RolesGuard`-gated controllers now consult `getRequestActor()` uniformly.**

---

## 2. Authorization Changes

| Aspect | Before (RolesGuard) | After (PermissionsGuard) |
|---|---|---|
| Class-level guard | `@UseGuards(RolesGuard)` | `@UseGuards(PermissionsGuard)` |
| Method-level decorator (2 endpoints) | `@Roles(Role.X, Role.Y, Role.Z)` | `@RequirePermissions('permission.name')` |
| Undecorated endpoints (`list`, `findByVin`, `findById`) | No decorator (open) | Unchanged — still no decorator, still open |
| Actor resolution | `RolesGuard` reads `request.headers['x-user-role']` directly — never consults `getRequestActor()` | `PermissionsGuard` calls `getRequestActor()`, preferring a verified actor and falling back to the legacy header only when none was presented |
| Imports removed | `Role` (`@prisma/client`), `Roles` (`../common/rbac/roles.decorator`), `RolesGuard` (`../common/rbac/roles.guard`) | — |
| Imports added | — | `PermissionsGuard` (`../common/permissions/permissions.guard`), `RequirePermissions` (`../common/permissions/permissions.decorator`) |

---

## 3. Permission Mapping Applied

Exactly as specified in PRTS-003 and already implemented in WP-3.0 — no new permission introduced, none renamed, no role mapping modified:

| Endpoint | Pre-migration `@Roles(...)` | New `@RequirePermissions(...)` | Role grant (from WP-3.0's `role-permissions.ts`, unchanged by this task) |
|---|---|---|---|
| `POST /vehicles` | `SYSTEM_ADMINISTRATOR`, `BRANCH_MANAGER`, `PARTS_MANAGER` | `vehicle.create` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `BRANCH_MANAGER`, `PARTS_MANAGER` |
| `PATCH /vehicles/:id/attribute-correction` | `SYSTEM_ADMINISTRATOR`, `BRANCH_MANAGER`, `PARTS_MANAGER` | `vehicle.correct` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `BRANCH_MANAGER`, `PARTS_MANAGER` |
| `GET /vehicles` | *(none — open today)* | *(none — unchanged)* | Remains open; out of scope (Technical Specification §5) |
| `GET /vehicles/vin/:vin` | *(none — open today)* | *(none — unchanged)* | Remains open; out of scope |
| `GET /vehicles/:id` | *(none — open today)* | *(none — unchanged)* | Remains open; out of scope |

**Approved, intentional exception — `OWNER`**: consistent with WP-3.1 and WP-3.2, `OWNER` gains access to both decorated endpoints where it previously did not have it under `RolesGuard` — the same, explicit, pre-approved outcome the Technical Specification's mapping table authorizes (`OWNER` already holds every permission platform-wide via the pre-existing `ROLE_PERMISSIONS[Role.OWNER] = [...PERMISSIONS]` spread; `RolesGuard` blocked it only because it never consulted that map).

---

## 4. Endpoints Reviewed

All five of `vehicles.controller.ts`'s endpoints:

1. `POST /vehicles` — **migrated** (`vehicle.create`)
2. `GET /vehicles` — **unchanged**, remains open (out of scope)
3. `GET /vehicles/vin/:vin` — **unchanged**, remains open (out of scope)
4. `GET /vehicles/:id` — **unchanged**, remains open (out of scope)
5. `PATCH /vehicles/:id/attribute-correction` — **migrated** (`vehicle.correct`)

Two endpoints migrated; three correctly left untouched, matching the Technical Specification's explicit scope boundary — the largest proportion of intentionally-open endpoints of the three migrated controllers, all preserved exactly.

---

## 5. Business Logic Validation

| Check | Result |
|---|---|
| Service invocation changes | **None** — `this.vehicles.create(dto)`, `this.vehicles.list(...)`, `this.vehicles.findByVin(vin)`, `this.vehicles.findById(id)`, `this.vehicles.correctAttribute(id, dto)` calls are identical, same arguments, same order |
| Repository/Prisma query changes | **None** — `VehiclesService` untouched; absent from the diff |
| Transaction changes | **None** — no transaction boundary exists in this controller |
| Validation changes | **None** — `CreateVehicleDto`, `CorrectVehicleAttributeDto` unchanged, absent from the diff |
| Logging changes | **None** — no logging statement exists in this controller |
| Exception behavior changes | **None** — both `NotFoundException` throws in `findByVin`/`findById` are unchanged; `PermissionsGuard` throws `ForbiddenException` on denial exactly as `RolesGuard` did |
| Endpoint behavior / routing changes | **None** — same HTTP methods, same paths, same parameter decorators |
| Request/response contract / ORM behavior changes | **None** — return types and query/path/body shapes are byte-for-byte unchanged |

`git diff` confirms exactly 20 lines changed (14 insertions, 6 deletions) across the entire file — import lines, the class-level guard decorator, the header comment, and the two method-level decorators. Zero lines inside any method body changed; the "Corrections are their own endpoint..." explanatory comment above `correctAttribute` is preserved verbatim; the three undecorated `GET` methods are entirely absent from the diff.

---

## 6. Architectural Validation

| Check | Result | Evidence |
|---|---|---|
| Controller responsibility unchanged | **Confirmed** | Constructor signature and all five method bodies unchanged |
| Dependency direction unchanged | **Confirmed** | Controller now depends on `src/common/permissions/` instead of `src/common/rbac/` — the same lateral swap WP-3.1/WP-3.2 already established |
| Module wiring unchanged | **Confirmed** | `vehicles.module.ts` absent from the diff |
| Architecture consistent with WP-3.1 and WP-3.2 | **Confirmed** | §7 |
| No circular dependency introduced | **Confirmed** | `src/common/permissions/` does not import anything from `src/vehicles/`; `tsc --noEmit` reports zero errors |
| No runtime behavior changes | **Confirmed** | §5 |
| No duplicate authorization | **Confirmed** | Exactly one guard, one decorator per decorated endpoint |
| No orphan authorization | **Confirmed** | Both permission strings used here were confirmed to exist in `PERMISSIONS` by WP-3.0's own still-passing test suite |
| Intentionally public endpoints preserved exactly | **Confirmed** | `list`, `findByVin`, `findById` carry no `PERMISSIONS_KEY`/`ROLES_KEY` metadata — directly tested (§8) |

---

## 7. Cross-Controller Consistency Validation

Direct comparison of all three migrated controllers, performed fresh for this report:

| Check | Integration | Parts | Vehicles | Consistent? |
|---|---|---|---|---|
| Class-level guard | `@UseGuards(PermissionsGuard)` | `@UseGuards(PermissionsGuard)` | `@UseGuards(PermissionsGuard)` | **Yes** |
| Guard import path | `../common/permissions/permissions.guard` | `../common/permissions/permissions.guard` | `../common/permissions/permissions.guard` | **Yes** |
| Decorator import path | `../common/permissions/permissions.decorator` | `../common/permissions/permissions.decorator` | `../common/permissions/permissions.decorator` | **Yes** |
| Method decorator form | `@RequirePermissions('permission.name')` | `@RequirePermissions('permission.name')` | `@RequirePermissions('permission.name')` | **Yes** |
| Permission naming convention | `integration.sync`, `integration.deadLetters.read/resolve` (camelCase segments, dot-namespaced) | `parts.create`, `parts.matchCandidates.manage` | `vehicle.create`, `vehicle.correct` | **Yes** — consistent dot-namespaced, camelCase convention throughout |
| Residual `RolesGuard`/`@Roles`/`Role` import | None (removed) | None (removed) | None (removed) | **Yes** |
| Explanatory header comment convention | "Platform Remediation PEP-3 (WP-3.X...)" citing PRTS-003 | Same | Same | **Yes** |
| Undecorated (open) endpoints preserved | N/A (none exist on this controller) | `list`, `findById` preserved exactly | `list`, `findByVin`, `findById` preserved exactly | **Yes** |
| Test file naming/location | `integration.controller.authorization.spec.ts`, colocated | `parts.controller.authorization.spec.ts`, colocated | `vehicles.controller.authorization.spec.ts`, colocated | **Yes** |
| Test file structure | Class-level guard test, method-decorator `it.each`, `describe.each` per-endpoint scenario block, OWNER-exception block | Same, plus undecorated-endpoint check | Same, plus undecorated-endpoint check and open-endpoint-allowed check | **Yes** — Parts/Vehicles extend the same base pattern Integration established, adapted only for each controller's own open-endpoint count |

**No controller deviates from the approved migration pattern.** The only differences across the three controllers are the number of decorated vs. undecorated endpoints and the specific permission strings used — both are content differences dictated by the approved mapping table, not structural or stylistic deviations.

---

## 8. Authorization Test Results

New file: `src/vehicles/vehicles.controller.authorization.spec.ts` (22 tests, all passing), following the identical structure WP-3.1/WP-3.2 established:

| Test category | Coverage |
|---|---|
| Class-level guard migration | `PermissionsGuard` present, `RolesGuard` absent from real `GUARDS_METADATA` |
| Method-level decorator migration | Each of the 2 migrated handlers carries exactly the right `@RequirePermissions(...)`, no leftover `@Roles` metadata |
| Undecorated endpoints confirmed unchanged | `list`, `findByVin`, `findById` carry neither `PERMISSIONS_KEY` nor `ROLES_KEY` metadata |
| Permission granted / previously-valid remains valid (per migrated endpoint) | Every currently-mapped and every pre-migration-valid role succeeds |
| Permission denied / previously denied remain denied (per migrated endpoint) | Roles outside the mapping table rejected with `ForbiddenException` |
| Missing authentication (per migrated endpoint) | No header, no verified actor → `ForbiddenException` |
| Authenticated but unauthorized (per migrated endpoint) | Verified-JWT `SALESPERSON` → `ForbiddenException` |
| Administrator access (per migrated endpoint) | Verified-JWT `SYSTEM_ADMINISTRATOR` → allowed |
| Owner access (per migrated endpoint) | Verified-JWT `OWNER` → allowed |
| No endpoint becomes publicly accessible (per migrated endpoint) | Absent/unrecognized role rejected, never silently allowed |
| Approved, intentional exception | `OWNER` succeeds via header stand-in on both migrated endpoints |
| Intentionally public endpoints preserved | The guard allows `list`, `findByVin`, `findById` through with **no** headers/actor at all — direct proof the pre-existing open behavior is unchanged |

All 22 tests pass.

---

## 9. Regression Results

| Suite | Result |
|---|---|
| `vehicles.controller.authorization.spec.ts` (new) | 22/22 pass |
| `permissions.guard.spec.ts` (pre-existing) | Pass, unaffected |
| `role-permissions.spec.ts` (WP-3.0) | Pass, unaffected |
| `integration.controller.authorization.spec.ts` (WP-3.1) | Pass, unaffected |
| `parts.controller.authorization.spec.ts` (WP-3.2) | Pass, unaffected |
| `vehicles.service.spec.ts` (pre-existing) | Pass, unaffected — confirms business logic behind the controller is untouched |
| Full repository unit suite | **108/108 suites, 820/820 tests pass** — up from the WP-3.2 baseline (107 suites/798 tests) by exactly the 22 new tests; zero regressions |
| `tsc --noEmit` | 0 errors |
| `eslint` (changed/new files, and repository-wide) | 0 errors, 0 warnings |

Compared directly against the verified WP-3.2 baseline (107/798): the only delta is the addition of this task's own new test suite.

---

## 10. Rollback Verification

| Check | Result |
|---|---|
| Rollback scope | Revert `vehicles.controller.ts` to its pre-WP-3.3 state (restoring `RolesGuard`/`@Roles(...)` and the `Role`/`Roles`/`RolesGuard` imports) and delete `vehicles.controller.authorization.spec.ts` |
| Any other file depends on this change | **No** — `vehicles.module.ts` requires no change either way; `integration.controller.ts` and `parts.controller.ts` are independent, unaffected |
| Rollback validation | Full regression suite would return to exactly 107/107 suites, 798/798 tests, identical to the pre-WP-3.3 (post-WP-3.2) baseline |
| Rollback required this session | **No** — no regression or scope violation was found |

---

## 11. Repository Validation

| Check | Result |
|---|---|
| `git status --short` before implementation | Clean |
| `git diff --stat` after implementation | Exactly 1 file modified (`vehicles.controller.ts`, 14 insertions/6 deletions), 1 file added (`vehicles.controller.authorization.spec.ts`) |
| `integration.controller.ts` modified | **No** |
| `parts.controller.ts` modified | **No** |
| `permission.ts`, `role-permissions.ts` modified | **No** |
| Any service, repository, DTO, module, schema, or migration modified | **No** |
| Full unit suite | 108/108 suites, 820/820 tests pass |
| Type check | 0 errors |
| Lint | 0 errors, 0 warnings |

---

## 12. GitHub Actions Status

This change touches only TypeScript source and test files under `services/operational-core/src/vehicles/`, none of which fall under the Documentation Mermaid Validation, Documentation Lint, or Documentation Link Check workflows' path filters (`**/*.md`, `.github/workflows/docs-*.yml`, `scripts/ci/*`). No documentation-CI workflow is expected to run or be affected by this commit. No dedicated CI workflow exists in this repository for `services/operational-core`'s own unit test suite — repository-wide validation for this change is therefore the local, fresh verification recorded in §9/§11 above, consistent with WP-3.0's, WP-3.1's, and WP-3.2's own reports.

---

## 13. Ready for Independent PEP-3 Verification

| Precondition for Independent PEP-3 Verification (a separate, future engineering phase) | Status |
|---|---|
| All three controllers migrated to `PermissionsGuard`/`@RequirePermissions` | **Confirmed** — `integration` (WP-3.1), `parts` (WP-3.2), `vehicles` (WP-3.3) |
| Zero remaining real `RolesGuard` controller usages | **Confirmed** — `grep` across all three files shows no `RolesGuard`/`@Roles(...)` code, only historical comments citing the pre-migration mechanism by name |
| Cross-controller consistency confirmed | **Confirmed** — §7 |
| Full regression baseline is green | **Confirmed** — 108/108 suites, 820/820 tests |
| Per-controller mapping-table equivalence confirmed (not assumed) | **Confirmed** — 34 + 39 + 22 = 95 dedicated authorization tests across the three controllers, each independently verifying granted/denied/missing-auth/unauthorized/admin/owner scenarios against the real, migrated decorator metadata |

**WP-3.3 is complete. This concludes PEP-3's controller-migration scope. Per this task's own explicit instruction, Independent PEP-3 Verification is a separate engineering phase and is NOT authorized or performed by this document or this commit — it must be initiated as its own, distinct task.**

---

*End of WP-3.3 Vehicles Controller Permission Migration Implementation Report.*
