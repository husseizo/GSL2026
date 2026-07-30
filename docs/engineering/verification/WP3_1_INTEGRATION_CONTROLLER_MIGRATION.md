# PEP-3 WP-3.1 — Integration Controller Permission Migration — Implementation Report

## Status: IMPLEMENTATION COMPLETE — PARTS AND VEHICLES CONTROLLERS UNTOUCHED

---

## Document Control

| Field | Value |
|---|---|
| Document | WP-3.1 Integration Controller Permission Migration Implementation Report |
| Phase | PEP-3 (Permission Migration) — Work Package WP-3.1 (Integration Controller) |
| Authorized by | `docs/engineering/PEP3A_READINESS_AND_SCOPE_LOCK.md`; `docs/engineering/verification/WP3_0_PERMISSION_FOUNDATION_IMPLEMENTATION.md` |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md` §4 (PRTS-003) mapping table |
| Effective date | 2026-07-31 |

---

## 1. Executive Summary

WP-3.1 migrates exactly one controller — `src/integration/integration.controller.ts` — from `@UseGuards(RolesGuard)` + `@Roles(...)` to `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`, using only the three permission constants WP-3.0 already introduced (`integration.sync`, `integration.deadLetters.read`, `integration.deadLetters.resolve`). The change is a pure guard/decorator swap: every business-logic line, every constructor dependency, every endpoint path, and every request/response shape is byte-for-byte unchanged — confirmed by diff (§5). No other controller, service, module, DTO, permission constant, or schema file was touched. A new, dedicated authorization test file exercises the real, migrated controller's actual decorator metadata through a real (unmocked) `PermissionsGuard` and `Reflector` — not a re-simulation of guard logic already covered elsewhere — proving 34 scenarios across all four migrated endpoints. The full repository suite passes at 106/106 suites, 759/759 tests (up from the WP-3.0 baseline of 105/725 by exactly the 34 new tests, zero regressions). `tsc --noEmit` and `eslint` both report zero issues on the changed/new files and repository-wide.

---

## 2. Authorization Changes

| Aspect | Before (RolesGuard) | After (PermissionsGuard) |
|---|---|---|
| Class-level guard | `@UseGuards(RolesGuard)` | `@UseGuards(PermissionsGuard)` |
| Method-level decorator | `@Roles(Role.X, Role.Y, ...)` | `@RequirePermissions('permission.name')` |
| Actor resolution | `RolesGuard` reads `request.headers['x-user-role']` directly — never consults `getRequestActor()`, never sees a verified JWT/API-key actor | `PermissionsGuard` calls `getRequestActor()`, which prefers a verified actor (`request.verifiedActor`, attached by `JwtAuthContextGuard`) and falls back to the legacy header only when no verified credential was presented |
| Imports removed | `Role` (`@prisma/client`), `Roles` (`../common/rbac/roles.decorator`), `RolesGuard` (`../common/rbac/roles.guard`) | — |
| Imports added | — | `PermissionsGuard` (`../common/permissions/permissions.guard`), `RequirePermissions` (`../common/permissions/permissions.decorator`) |

This closes the specific gap the Technical Specification named for this controller: a caller presenting a real, verified JWT is now actually consulted, where previously `RolesGuard` never looked at it.

---

## 3. Permission Mapping Applied

Exactly as specified in PRTS-003 and already implemented in WP-3.0 — no new permission introduced, none renamed:

| Endpoint | Pre-migration `@Roles(...)` | New `@RequirePermissions(...)` | Role grant (from WP-3.0's `role-permissions.ts`, unchanged by this task) |
|---|---|---|---|
| `POST /integration/sync/vehicles` | `SYSTEM_ADMINISTRATOR` | `integration.sync` | `SYSTEM_ADMINISTRATOR`, `OWNER` |
| `POST /integration/sync/parts` | `SYSTEM_ADMINISTRATOR` | `integration.sync` | `SYSTEM_ADMINISTRATOR`, `OWNER` |
| `GET /integration/dead-letters` | `SYSTEM_ADMINISTRATOR`, `DATA_QUALITY_REVIEWER` | `integration.deadLetters.read` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `DATA_QUALITY_REVIEWER` |
| `PATCH /integration/dead-letters/:id/resolve` | `SYSTEM_ADMINISTRATOR`, `DATA_QUALITY_REVIEWER` | `integration.deadLetters.resolve` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `DATA_QUALITY_REVIEWER` |

**Approved, intentional exception — `OWNER`**: `OWNER` gains access to all four endpoints where it previously did not have it under `RolesGuard`. This is not a scope violation — it is the exact, explicit outcome the Technical Specification's own mapping table (§4, PRTS-003) authorizes: `OWNER` already holds every permission platform-wide via the pre-existing `ROLE_PERMISSIONS[Role.OWNER] = [...PERMISSIONS]` spread (a fact that predates this entire remediation), and was blocked only because `RolesGuard` never consulted that map at all. No other role gains or loses access. This exception is directly tested (§7).

---

## 4. Endpoints Reviewed

All four of `integration.controller.ts`'s endpoints — the controller has no undecorated endpoint (unlike `parts.controller.ts`/`vehicles.controller.ts`, which each retain open `GET` endpoints out of this phase's scope):

1. `POST /integration/sync/vehicles`
2. `POST /integration/sync/parts`
3. `GET /integration/dead-letters`
4. `PATCH /integration/dead-letters/:id/resolve`

Every one is migrated; none is left on `RolesGuard`; none is left without a permission requirement.

---

## 5. Business Logic Validation

| Check | Result |
|---|---|
| Service invocation changes | **None** — `this.integration.runSync(...)`, `this.integration.listDeadLetters(...)`, `this.integration.resolveDeadLetter(...)` calls are identical, same arguments, same order |
| Repository changes | **None** — `IntegrationService`, `VehicleSyncHandler`, `PartSyncHandler`, `FileDropAdapter` are untouched; not present in the diff |
| Transactional behavior changes | **None** — no transaction boundary exists in this controller; unaffected either way |
| Exception behavior changes | **None** — the controller itself throws nothing directly; `PermissionsGuard` throws `ForbiddenException` on denial, exactly as `RolesGuard` did (same exception type, different message text — an authorization-layer detail, not a business-logic change) |
| Logging behavior changes | **None** — no logging statement exists in this controller |
| Endpoint behavior changes | **None** — same HTTP methods, same paths, same parameter decorators (`@Query`, `@Param`, `@Body`) |
| Request/response contract changes | **None** — `ResolveDeadLetterDto`, return types, and query/path parameter shapes are byte-for-byte unchanged |

`git diff` confirms exactly 23 lines changed (15 insertions, 8 deletions) across the entire file, all of them import lines, the class-level guard decorator, and the four method-level decorators — zero lines inside any method body changed.

---

## 6. Architectural Validation

| Check | Result | Evidence |
|---|---|---|
| Controller responsibility unchanged | **Confirmed** | Constructor signature, all four method bodies, all route paths/HTTP verbs unchanged |
| Dependency direction unchanged | **Confirmed** | The controller now depends on `src/common/permissions/` instead of `src/common/rbac/` — a lateral swap to the same-tier authorization layer, not a new direction; matches the already-approved target architecture (§8 of the Readiness and Scope Lock) |
| Authorization architecture improved without changing application behavior | **Confirmed** | The controller now consults `getRequestActor()` (verified-actor-aware) instead of a raw header read — an authorization-layer improvement; every business-logic path is untouched |
| No duplicate authorization | **Confirmed** | Exactly one guard (`PermissionsGuard`) and one decorator per endpoint; `RolesGuard`/`@Roles` no longer appear anywhere in this file (confirmed by test, §7) |
| No orphan authorization | **Confirmed** | Every endpoint carries exactly one `@RequirePermissions(...)`; none is left with a decorator referencing a non-existent permission (all three permission strings used here were confirmed to exist in `PERMISSIONS` by WP-3.0's own test suite, which still passes unmodified) |
| No unreachable endpoints | **Confirmed** | No route path, guard ordering, or module registration changed; `integration.module.ts` (unmodified, confirmed absent from diff) still declares `IntegrationController` exactly as before |

---

## 7. Authorization Test Results

New file: `src/integration/integration.controller.authorization.spec.ts` (34 tests, all passing). Unlike a guard-logic-only test (already covered by the pre-existing `permissions.guard.spec.ts`), these tests exercise the **real** `IntegrationController` class's actual decorator metadata — read via a real, unmocked `Reflector` — fed through a real, unmocked `PermissionsGuard` instance:

| Test category | Coverage |
|---|---|
| Class-level guard migration | Confirms `PermissionsGuard` is present and `RolesGuard` is absent from the real `GUARDS_METADATA` on `IntegrationController` |
| Method-level decorator migration | Confirms each of the 4 real handler methods carries exactly the right `@RequirePermissions(...)` value and carries no leftover `@Roles` (`ROLES_KEY`) metadata |
| Permission granted (per endpoint) | Every currently-mapped role succeeds via header stand-in |
| Previously-valid requests remain valid (per endpoint) | Every role from the pre-migration `@Roles(...)` list still succeeds |
| Permission denied / previously denied remain denied (per endpoint) | Roles outside the mapping table (`PARTS_MANAGER`, `GENERAL_MANAGER`, `STOREKEEPER`, and — for the sync endpoints — `DATA_QUALITY_REVIEWER`) are rejected with `ForbiddenException` |
| Missing authentication (per endpoint) | No header, no verified actor at all → `ForbiddenException` |
| Authenticated but unauthorized (per endpoint) | A verified-JWT `SALESPERSON` actor → `ForbiddenException` |
| Administrator access (per endpoint) | A verified-JWT `SYSTEM_ADMINISTRATOR` actor → allowed |
| No endpoint loses protection (per endpoint) | An absent/unrecognized role value is rejected, never silently allowed |
| Approved, intentional exception | `OWNER` succeeds on all four endpoints, explicitly documented as the approved mapping-table broadening (§3), not a regression |

All 34 tests pass. Combined with the pre-existing, unmodified `permissions.guard.spec.ts` (still passing), this confirms the guard's general logic and this specific controller's real decorator wiring are both independently verified.

---

## 8. Regression Results

| Suite | Result |
|---|---|
| `integration.controller.authorization.spec.ts` (new) | 34/34 pass |
| `permissions.guard.spec.ts` (pre-existing) | Pass, unaffected |
| `role-permissions.spec.ts` (WP-3.0) | Pass, unaffected — confirms permission constants/grants are still exactly as WP-3.0 left them |
| `integration.service.spec.ts`, all 3 adapter specs (pre-existing) | Pass, unaffected — confirm business logic behind the controller is untouched |
| Full repository unit suite | **106/106 suites, 759/759 tests pass** — up from the WP-3.0 baseline (105 suites/725 tests) by exactly the 34 new tests; zero regressions |
| `tsc --noEmit` | 0 errors |
| `eslint` (changed/new files, and repository-wide) | 0 errors, 0 warnings |

---

## 9. Rollback Verification

| Check | Result |
|---|---|
| Rollback scope | Revert `integration.controller.ts` to its pre-WP-3.1 state (restoring `RolesGuard`/`@Roles(...)` and the `Role`/`Roles`/`RolesGuard` imports) and delete `integration.controller.authorization.spec.ts` |
| Any other file depends on this change | **No** — `integration.module.ts` requires no change to support either state; no other controller, service, or module references this controller's guard/decorator choice |
| Rollback validation | Full regression suite would return to exactly 105/105 suites, 725/725 tests, identical to the pre-WP-3.1 (post-WP-3.0) baseline |
| Rollback required this session | **No** — no regression or scope violation was found; this section documents the verified procedure |

---

## 10. Repository Validation

| Check | Result |
|---|---|
| `git status --short` before implementation | Clean |
| `git diff --stat` after implementation | Exactly 1 file modified (`integration.controller.ts`, 15 insertions/8 deletions), 1 file added (`integration.controller.authorization.spec.ts`) |
| `parts.controller.ts` modified | **No** |
| `vehicles.controller.ts` modified | **No** |
| Any service, repository, DTO, module, `permission.ts`, `role-permissions.ts`, schema, or migration modified | **No** |
| Full unit suite | 106/106 suites, 759/759 tests pass |
| Type check | 0 errors |
| Lint | 0 errors, 0 warnings |

---

## 11. GitHub Actions Status

This change touches only TypeScript source and test files under `services/operational-core/src/integration/`, none of which fall under the Documentation Mermaid Validation, Documentation Lint, or Documentation Link Check workflows' path filters (`**/*.md`, `.github/workflows/docs-*.yml`, `scripts/ci/*`). No documentation-CI workflow is expected to run or be affected by this commit. No dedicated CI workflow exists in this repository for `services/operational-core`'s own unit test suite — repository-wide validation for this change is therefore the local, fresh verification recorded in §8/§10 above, which is authoritative for this work package, consistent with WP-3.0's own report.

---

## 12. Ready for WP-3.2 Assessment

| Precondition for WP-3.2 (`parts.controller.ts` migration) | Status |
|---|---|
| `parts.create`, `parts.matchCandidates.manage` exist and are correctly granted (WP-3.0) | **Ready** — unaffected by this task, still verified passing |
| WP-3.1's full regression pass recorded | **Confirmed** — 106/106 suites |
| No premature change to `parts.controller.ts` or `vehicles.controller.ts` | **Confirmed** — absent from this task's diff |
| `integration.controller.ts`'s migration independently verified and stable | **Confirmed** — 34 dedicated authorization tests, zero regressions |

**WP-3.1 is complete. WP-3.2 (parts.controller.ts migration) may begin as a separate, subsequent work package — not performed by this document or this commit.**

---

*End of WP-3.1 Integration Controller Permission Migration Implementation Report.*
