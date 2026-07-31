# PEP-3 WP-3.2 — Parts Controller Permission Migration — Implementation Report

## Status: IMPLEMENTATION COMPLETE — INTEGRATION AND VEHICLES CONTROLLERS UNTOUCHED

---

## Document Control

| Field | Value |
|---|---|
| Document | WP-3.2 Parts Controller Permission Migration Implementation Report |
| Phase | PEP-3 (Permission Migration) — Work Package WP-3.2 (Parts Controller) |
| Authorized by | `docs/engineering/PEP3A_READINESS_AND_SCOPE_LOCK.md`; `docs/engineering/verification/WP3_0_PERMISSION_FOUNDATION_IMPLEMENTATION.md`; `docs/engineering/verification/WP3_1_INTEGRATION_CONTROLLER_MIGRATION.md` |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md` §4 (PRTS-003) mapping table |
| Effective date | 2026-07-31 |

---

## 1. Executive Summary

WP-3.2 migrates exactly one controller — `src/parts/parts.controller.ts` — from `@UseGuards(RolesGuard)` + `@Roles(...)` to `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`, using only the two permission constants WP-3.0 already introduced for this controller (`parts.create`, `parts.matchCandidates.manage`). The change is a pure guard/decorator swap: every business-logic line, constructor dependency, endpoint path, DTO, and Prisma/service call is byte-for-byte unchanged — confirmed by diff (§5). The two undecorated `GET` endpoints (`list`, `findById`) remain exactly as they were — open, no permission requirement — matching the Technical Specification's own explicit out-of-scope decision. No other controller, service, module, DTO, permission constant, or schema file was touched. A new authorization test file (39 tests) exercises the real, migrated controller's actual decorator metadata through a real (unmocked) `PermissionsGuard` and `Reflector`, following the identical pattern WP-3.1 established. The full repository suite passes at 107/107 suites, 798/798 tests (up from the WP-3.1 baseline of 106/759 by exactly the 39 new tests, zero regressions). `tsc --noEmit` and `eslint` both report zero issues.

---

## 2. Authorization Changes

| Aspect | Before (RolesGuard) | After (PermissionsGuard) |
|---|---|---|
| Class-level guard | `@UseGuards(RolesGuard)` | `@UseGuards(PermissionsGuard)` |
| Method-level decorator (4 endpoints) | `@Roles(Role.X, Role.Y, ...)` | `@RequirePermissions('permission.name')` |
| Undecorated endpoints (`list`, `findById`) | No decorator (open) | Unchanged — still no decorator, still open |
| Actor resolution | `RolesGuard` reads `request.headers['x-user-role']` directly — never consults `getRequestActor()` | `PermissionsGuard` calls `getRequestActor()`, preferring a verified actor and falling back to the legacy header only when none was presented |
| Imports removed | `Role` (`@prisma/client`), `Roles` (`../common/rbac/roles.decorator`), `RolesGuard` (`../common/rbac/roles.guard`) | — |
| Imports added | — | `PermissionsGuard` (`../common/permissions/permissions.guard`), `RequirePermissions` (`../common/permissions/permissions.decorator`) |

`MatchCandidateStatus` (from `@prisma/client`) remains imported and used unchanged — only the now-unused `Role` import was removed, following the same pattern WP-3.1 used for `integration.controller.ts`.

---

## 3. Permission Mapping Applied

Exactly as specified in PRTS-003 and already implemented in WP-3.0 — no new permission introduced, none renamed, no role mapping modified:

| Endpoint | Pre-migration `@Roles(...)` | New `@RequirePermissions(...)` | Role grant (from WP-3.0's `role-permissions.ts`, unchanged by this task) |
|---|---|---|---|
| `POST /parts` | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER`, `STOREKEEPER` | `parts.create` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER`, `STOREKEEPER` |
| `POST /parts/match-candidates/run` | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER` | `parts.matchCandidates.manage` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER` |
| `GET /parts/match-candidates` | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER` | `parts.matchCandidates.manage` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER` |
| `PATCH /parts/match-candidates/:id/review` | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER` | `parts.matchCandidates.manage` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER` |
| `GET /parts` | *(none — open today)* | *(none — unchanged)* | Remains open; out of scope (Technical Specification §5) |
| `GET /parts/:id` | *(none — open today)* | *(none — unchanged)* | Remains open; out of scope |

**Approved, intentional exception — `OWNER`**: as with WP-3.1, `OWNER` gains access to the four decorated endpoints where it previously did not have it under `RolesGuard`. This is the same, explicit, pre-approved outcome the Technical Specification's mapping table authorizes: `OWNER` already holds every permission platform-wide via the pre-existing `ROLE_PERMISSIONS[Role.OWNER] = [...PERMISSIONS]` spread, and was blocked only because `RolesGuard` never consulted that map. `STOREKEEPER` correctly gains no access to the match-candidates endpoints (never in their original `@Roles(...)` list, and not part of `parts.matchCandidates.manage`'s grant) — directly tested (§7).

---

## 4. Endpoints Reviewed

All six of `parts.controller.ts`'s endpoints:

1. `POST /parts` — **migrated** (`parts.create`)
2. `GET /parts` — **unchanged**, remains open (out of scope)
3. `GET /parts/:id` — **unchanged**, remains open (out of scope)
4. `POST /parts/match-candidates/run` — **migrated** (`parts.matchCandidates.manage`)
5. `GET /parts/match-candidates` — **migrated** (`parts.matchCandidates.manage`)
6. `PATCH /parts/match-candidates/:id/review` — **migrated** (`parts.matchCandidates.manage`)

Four endpoints migrated; two correctly left untouched, matching the Technical Specification's explicit scope boundary.

---

## 5. Business Logic Validation

| Check | Result |
|---|---|
| Service invocation changes | **None** — `this.parts.create(dto)`, `this.parts.list(...)`, `this.parts.findById(id)`, `this.matcher.runRuleBasedMatching()`/`runSimilarityMatching()`/`listCandidates(status)`/`reviewCandidate(...)` calls are identical, same arguments, same order |
| Repository/Prisma query changes | **None** — `PartsService`, `PartMatcherService` are untouched; absent from the diff |
| Transaction changes | **None** — no transaction boundary exists in this controller |
| Validation changes | **None** — `CreatePartDto`, `ReviewMatchCandidateDto` unchanged, absent from the diff |
| Logging changes | **None** — no logging statement exists in this controller |
| Exception behavior changes | **None** — `NotFoundException` in `findById` is unchanged; `PermissionsGuard` throws `ForbiddenException` on denial exactly as `RolesGuard` did |
| Endpoint behavior / routing changes | **None** — same HTTP methods, same paths, same parameter decorators (`@Query`, `@Param`, `@Body`) |
| Request/response contract / ORM behavior changes | **None** — return types and query/path/body shapes are byte-for-byte unchanged |

`git diff` confirms exactly 25 lines changed (17 insertions, 8 deletions) across the entire file — import lines, the class-level guard decorator, the header comment, and the four method-level decorators. Zero lines inside any method body changed; the two undecorated `GET` methods (`list`, `findById`) are entirely absent from the diff.

---

## 6. Architectural Validation

| Check | Result | Evidence |
|---|---|---|
| Controller responsibility unchanged | **Confirmed** | Constructor signature and all six method bodies unchanged |
| Dependency direction unchanged | **Confirmed** | Controller now depends on `src/common/permissions/` instead of `src/common/rbac/` — the same lateral swap WP-3.1 already established as architecturally sound |
| Module wiring unchanged | **Confirmed** | `parts.module.ts` absent from the diff — no module-level change required, confirmed during the PEP-3 Readiness assessment and re-confirmed here |
| Authorization architecture consistent with WP-3.1 | **Confirmed** | Identical pattern: `@UseGuards(PermissionsGuard)` at class level, `@RequirePermissions('...')` per decorated method |
| No circular dependency introduced | **Confirmed** | `src/common/permissions/` does not import anything from `src/parts/`; `tsc --noEmit` (which would surface a circular type-resolution failure) reports zero errors |
| No runtime behavior changes | **Confirmed** | §5 |
| No duplicate authorization | **Confirmed** | Exactly one guard, one decorator per decorated endpoint; `RolesGuard`/`@Roles` absent from this file (confirmed by test, §7) |
| No orphan authorization | **Confirmed** | All three permission strings used here (`parts.create`, `parts.matchCandidates.manage` ×3) were confirmed to exist in `PERMISSIONS` by WP-3.0's own still-passing test suite |

---

## 7. Authorization Test Results

New file: `src/parts/parts.controller.authorization.spec.ts` (39 tests, all passing), following the identical structure WP-3.1's `integration.controller.authorization.spec.ts` established — real `Reflector`, real `PermissionsGuard`, real `PartsController` class:

| Test category | Coverage |
|---|---|
| Class-level guard migration | `PermissionsGuard` present, `RolesGuard` absent from real `GUARDS_METADATA` |
| Method-level decorator migration | Each of the 4 migrated handlers carries exactly the right `@RequirePermissions(...)`, no leftover `@Roles` metadata |
| Undecorated endpoints confirmed unchanged | `list` and `findById` carry neither `PERMISSIONS_KEY` nor `ROLES_KEY` metadata — proving they remain open, not accidentally tightened |
| Permission granted / previously-valid remains valid (per migrated endpoint) | Every currently-mapped and every pre-migration-valid role succeeds |
| Permission denied / previously denied remain denied (per migrated endpoint) | Roles outside the mapping table rejected with `ForbiddenException`, including the specific check that `STOREKEEPER` (valid for `parts.create` but not for match-candidates endpoints) is correctly denied on the three match-candidates endpoints |
| Missing authentication (per migrated endpoint) | No header, no verified actor → `ForbiddenException` |
| Authenticated but unauthorized (per migrated endpoint) | Verified-JWT `SALESPERSON` → `ForbiddenException` |
| Administrator access (per migrated endpoint) | Verified-JWT `SYSTEM_ADMINISTRATOR` → allowed |
| Owner access (per migrated endpoint) | Verified-JWT `OWNER` → allowed |
| No endpoint becomes publicly accessible (per migrated endpoint) | Absent/unrecognized role rejected, never silently allowed |
| Approved, intentional exception | `OWNER` succeeds via header stand-in on all four migrated endpoints, explicitly documented as the approved mapping-table broadening (§3) |

All 39 tests pass.

---

## 8. Regression Results

| Suite | Result |
|---|---|
| `parts.controller.authorization.spec.ts` (new) | 39/39 pass |
| `permissions.guard.spec.ts` (pre-existing) | Pass, unaffected |
| `role-permissions.spec.ts` (WP-3.0) | Pass, unaffected |
| `integration.controller.authorization.spec.ts` (WP-3.1) | Pass, unaffected — confirms WP-3.1's migration remains stable |
| `part-matcher.service.spec.ts`, `similarity-scorer.spec.ts` (pre-existing) | Pass, unaffected — confirm business logic behind the controller is untouched |
| Full repository unit suite | **107/107 suites, 798/798 tests pass** — up from the WP-3.1 baseline (106 suites/759 tests) by exactly the 39 new tests; zero regressions |
| `tsc --noEmit` | 0 errors |
| `eslint` (changed/new files, and repository-wide) | 0 errors, 0 warnings |

Compared directly against the verified WP-3.1 baseline (106/759): the only delta is the addition of this task's own new test suite — no pre-existing test's outcome changed.

---

## 9. Rollback Verification

| Check | Result |
|---|---|
| Rollback scope | Revert `parts.controller.ts` to its pre-WP-3.2 state (restoring `RolesGuard`/`@Roles(...)` and the `Role`/`Roles`/`RolesGuard` imports) and delete `parts.controller.authorization.spec.ts` |
| Any other file depends on this change | **No** — `parts.module.ts` requires no change to support either state; `integration.controller.ts` and `vehicles.controller.ts` are independent, unaffected either way |
| Rollback validation | Full regression suite would return to exactly 106/106 suites, 759/759 tests, identical to the pre-WP-3.2 (post-WP-3.1) baseline |
| Rollback required this session | **No** — no regression or scope violation was found |

---

## 10. Repository Validation

| Check | Result |
|---|---|
| `git status --short` before implementation | Clean |
| `git diff --stat` after implementation | Exactly 1 file modified (`parts.controller.ts`, 17 insertions/8 deletions), 1 file added (`parts.controller.authorization.spec.ts`) |
| `integration.controller.ts` modified | **No** |
| `vehicles.controller.ts` modified | **No** |
| `permission.ts`, `role-permissions.ts` modified | **No** |
| Any service, repository, DTO, module, schema, or migration modified | **No** |
| Full unit suite | 107/107 suites, 798/798 tests pass |
| Type check | 0 errors |
| Lint | 0 errors, 0 warnings |

---

## 11. GitHub Actions Status

This change touches only TypeScript source and test files under `services/operational-core/src/parts/`, none of which fall under the Documentation Mermaid Validation, Documentation Lint, or Documentation Link Check workflows' path filters (`**/*.md`, `.github/workflows/docs-*.yml`, `scripts/ci/*`). No documentation-CI workflow is expected to run or be affected by this commit. No dedicated CI workflow exists in this repository for `services/operational-core`'s own unit test suite — repository-wide validation for this change is therefore the local, fresh verification recorded in §8/§10 above, consistent with WP-3.0's and WP-3.1's own reports.

---

## 12. Ready for WP-3.3 Assessment

| Precondition for WP-3.3 (`vehicles.controller.ts` migration) | Status |
|---|---|
| `vehicle.create`, `vehicle.correct` exist and are correctly granted (WP-3.0) | **Ready** — unaffected by this task, still verified passing |
| WP-3.2's full regression pass recorded | **Confirmed** — 107/107 suites |
| No premature change to `vehicles.controller.ts` | **Confirmed** — absent from this task's diff |
| `integration.controller.ts` (WP-3.1) and `parts.controller.ts` (WP-3.2) migrations independently verified and stable | **Confirmed** — 34 + 39 dedicated authorization tests, zero regressions |

**WP-3.2 is complete. WP-3.3 (vehicles.controller.ts migration) may begin as a separate, subsequent work package — not performed by this document or this commit.**

---

*End of WP-3.2 Parts Controller Permission Migration Implementation Report.*
