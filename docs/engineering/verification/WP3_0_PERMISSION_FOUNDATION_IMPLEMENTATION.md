# PEP-3 WP-3.0 — Permission Constants Foundation — Implementation Report

## Status: IMPLEMENTATION COMPLETE — NO CONTROLLER MIGRATION PERFORMED

---

## Document Control

| Field | Value |
|---|---|
| Document | WP-3.0 Permission Foundation Implementation Report |
| Phase | PEP-3 (Permission Migration) — Work Package WP-3.0 (Permission Constants Foundation) |
| Governance note | "PEP-3A" is retired per the Program Governance Board's confirmation; this and all subsequent work under this phase are identified as **PEP-3**, work packages **WP-3.0–WP-3.3** |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md` §4 (PRTS-003); `docs/engineering/DGX3_PLATFORM_REMEDIATION_ENGINEERING_EXECUTION_PLAN_1.md` Phase 3; `docs/engineering/PEP3A_READINESS_AND_SCOPE_LOCK.md` |
| Effective date | 2026-07-31 |

---

## 1. Executive Summary

WP-3.0 adds exactly the permission foundation PEP-3's approved mapping table requires: 7 new permission constants in `permission.ts` and their exact role grants in `role-permissions.ts`. No controller, service, module, guard, decorator, schema, migration, API, or endpoint was modified — confirmed by diff (§4) and by the architectural validation below (§5). The new constants and grants are additive only and are consumed by zero current caller: no controller has been migrated to reference them, so this work package introduces no runtime or authorization-flow change of any kind. A new, dedicated test file (`role-permissions.spec.ts`, 21 tests) proves every new constant exists, is granted to exactly the roles the mapping table specifies, introduces no duplicate, and leaves every pre-existing mapping — including roles entirely outside PEP-3's scope — unchanged. The full repository regression suite passes with zero failures (105/105 suites, 725/725 tests — up from the pre-WP-3.0 baseline of 104/704 by exactly the 21 new tests, with zero regressions). `tsc --noEmit` and `eslint` both report zero issues.

---

## 2. Permission Constants Added

Added to `services/operational-core/src/common/permissions/permission.ts`, appended to the end of the `PERMISSIONS` array (additive only — no existing entry renamed, reordered, or removed):

| Permission constant | Confirmed not previously present |
|---|---|
| `integration.sync` | Yes — `PERMISSIONS` previously had no entry with this exact string |
| `integration.deadLetters.read` | Yes |
| `integration.deadLetters.resolve` | Yes |
| `parts.create` | Yes |
| `parts.matchCandidates.manage` | Yes |
| `vehicle.create` | Yes |
| `vehicle.correct` | Yes |

All 7 exactly match the strings the Technical Specification's PRTS-003 mapping table names — no naming deviation. A dedicated test (`role-permissions.spec.ts`, "no duplicate permission constants") confirms `PERMISSIONS` contains no duplicate entries after this addition, and that none of the 7 new strings collided with any of the 140+ pre-existing entries.

---

## 3. Role Mapping Changes

Extended `services/operational-core/src/common/permissions/role-permissions.ts` — additive only, no existing array entry removed or reordered:

| Permission | Roles granted | Change made |
|---|---|---|
| `integration.sync` | `SYSTEM_ADMINISTRATOR`, `OWNER` | No explicit edit required — both roles already spread the entire `PERMISSIONS` array (`[...PERMISSIONS]`), so they receive this automatically once it exists in `permission.ts` |
| `integration.deadLetters.read`, `integration.deadLetters.resolve` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `DATA_QUALITY_REVIEWER` | Both strings appended to `ROLE_PERMISSIONS[Role.DATA_QUALITY_REVIEWER]` |
| `parts.create` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER`, `STOREKEEPER` | Appended to `ROLE_PERMISSIONS[Role.PARTS_MANAGER]` and `ROLE_PERMISSIONS[Role.STOREKEEPER]` |
| `parts.matchCandidates.manage` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER` | Appended to `ROLE_PERMISSIONS[Role.PARTS_MANAGER]` |
| `vehicle.create`, `vehicle.correct` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `BRANCH_MANAGER`, `PARTS_MANAGER` | Both strings appended to `ROLE_PERMISSIONS[Role.BRANCH_MANAGER]` and `ROLE_PERMISSIONS[Role.PARTS_MANAGER]` |

**Deliberately excluded**: `GENERAL_MANAGER` receives none of the 7 new permissions — confirmed directly by test (`role-permissions.spec.ts`, "GENERAL_MANAGER... has none of the 7 new permissions"). This matches the Technical Specification's own explicit finding: granting these to `GENERAL_MANAGER` would over-grant access relative to each endpoint's pre-migration `@Roles(...)` list, since `GENERAL_MANAGER` is not currently listed on any of the three controllers' decorators.

**No duplication introduced**: verified by test — no role's permission array contains more than one instance of any new permission string.

**No existing mapping changed**: verified by test — `SYSTEM_ADMINISTRATOR`/`OWNER` still spread the exact, unchanged `PERMISSIONS` array; a sample of pre-existing grants on every touched role (`STOREKEEPER`, `PARTS_MANAGER`, `BRANCH_MANAGER`, `DATA_QUALITY_REVIEWER`) remains present; all 14 roles entirely outside the mapping table have none of the 7 new permissions.

---

## 4. Files Modified

| File | Type | Confirmed scope |
|---|---|---|
| `services/operational-core/src/common/permissions/permission.ts` | Modified (existing) | +15 lines, 0 removed — additive only |
| `services/operational-core/src/common/permissions/role-permissions.ts` | Modified (existing) | +27 lines, −1 line (the `STOREKEEPER` single-line array was reformatted to multi-line to accommodate its new entry with an explanatory comment — no value in the array was removed or reordered) |
| `services/operational-core/src/common/permissions/role-permissions.spec.ts` | New | New test file only |

`git diff --stat` confirms exactly these three files changed — no controller, service, module, guard, decorator, DTO, schema, or migration file appears in the diff.

---

## 5. Architectural Validation

| Check | Result | Evidence |
|---|---|---|
| No controller depends on the new permissions yet | **Confirmed** | `grep -rn "'integration\.sync'\|'integration\.deadLetters\.read'\|'integration\.deadLetters\.resolve'\|'parts\.create'\|'parts\.matchCandidates\.manage'\|'vehicle\.create'\|'vehicle\.correct'" src/` (matching the quoted string literals, excluding the two edited files and the new spec) returns zero matches. Note: an earlier, looser grep without quoting matched unrelated dotted method calls — `this.parts.create(dto)` in `parts.controller.ts` (a `PartsService` method call) and `prisma.vehicle.create(...)` in `vehicles.service.ts`/several integration specs (Prisma's own ORM method) — neither is a reference to the new permission string; this was caught and corrected before this report was finalized, not left as an unverified claim. |
| No runtime behavior changes | **Confirmed** | The 7 new constants and their grants are static data, never read by any code path a real request exercises today (`integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts` still use `RolesGuard`/`@Roles(...)`, confirmed unchanged by diff) |
| No authorization path changes | **Confirmed** | `permissions.guard.ts`, `permissions.decorator.ts`, `request-actor.ts`, `require-verified-actor.decorator.ts` — zero of these appear in the diff |
| No endpoint behavior changes | **Confirmed** | All three controllers' files are absent from the diff; their existing `@UseGuards(RolesGuard)`/`@Roles(...)` decorations are untouched |
| No regression introduced | **Confirmed** | Full suite: 105/105 suites, 725/725 tests pass (§6) |

---

## 6. Tests Executed

| Suite | Result |
|---|---|
| `role-permissions.spec.ts` (new, 21 tests) | **21/21 pass** — permission-constant existence (7), no-duplicate checks (2), exact role-mapping equivalence per permission (7), no-duplicate-within-role-array (1), `GENERAL_MANAGER` exclusion (1), unchanged pre-existing mechanism/mappings (2), 14 uninvolved roles have zero new permissions (1) |
| `permissions.guard.spec.ts` (pre-existing) | **Pass, unaffected** — re-run fresh, confirms `PermissionsGuard`'s own logic is untouched |
| `jwt-auth-context.guard.spec.ts` (pre-existing) | **Pass, unaffected** |
| Full repository unit suite | **105/105 suites, 725/725 tests pass** — up from the pre-WP-3.0 baseline (104 suites/704 tests) by exactly the 21 new tests; zero regressions |
| `tsc --noEmit` | **0 errors** |
| `eslint` (on the 3 changed/new files) | **0 errors, 0 warnings** |

---

## 7. Rollback Verification

| Check | Result |
|---|---|
| Rollback scope | Reverting `permission.ts`, `role-permissions.ts`, and deleting `role-permissions.spec.ts` fully and cleanly restores the pre-WP-3.0 state |
| Any other file depends on this change | **No** — confirmed by the same repository-wide `grep` in §5; zero controllers, guards, or decorators reference any of the 7 new constants |
| Rollback validation | Full regression suite would return to exactly 104/104 suites, 704/704 tests, identical to the pre-WP-3.0 baseline |
| Rollback required this session | **No** — no regression or scope violation was found; this section documents the verified procedure, not an action taken |

---

## 8. Repository Validation

| Check | Result |
|---|---|
| `git status --short` before implementation | Clean |
| `git diff --stat` after implementation | Exactly 2 files modified, 1 file added — matches §4 exactly |
| No controller/service/module/DTO/guard/decorator modified | **Confirmed** |
| No database schema or migration modified | **Confirmed** — `services/operational-core/prisma/schema.prisma` absent from diff |
| No API or endpoint modified | **Confirmed** |
| Full unit suite | 105/105 suites, 725/725 tests pass |
| Type check | 0 errors |
| Lint | 0 errors, 0 warnings |

---

## 9. GitHub Actions Status

This change touches only TypeScript source and test files under `services/operational-core/src/`, none of which fall under the Documentation Mermaid Validation, Documentation Lint, or Documentation Link Check workflows' path filters (`**/*.md`, `.github/workflows/docs-*.yml`, `scripts/ci/*`). No documentation-CI workflow is expected to run or be affected by this commit. No dedicated CI workflow exists in this repository for `services/operational-core`'s own unit test suite (confirmed: `.github/workflows/` contains only the three documentation-validation workflows established earlier in this program) — repository-wide validation for this change is therefore the local, fresh verification recorded in §6/§8 above, which is authoritative for this work package.

---

## 10. Ready for WP-3.1 Assessment

| Precondition for WP-3.1 (`integration.controller.ts` migration) | Status |
|---|---|
| `integration.sync`, `integration.deadLetters.read`, `integration.deadLetters.resolve` exist in `PERMISSIONS` | **Ready** |
| Each is granted to exactly the roles `integration.controller.ts`'s current `@Roles(...)` decorators name | **Ready** — verified by test |
| No premature controller change exists | **Confirmed** — `integration.controller.ts` remains on `RolesGuard`/`@Roles(...)`, unchanged |
| Full regression baseline is green | **Confirmed** — 105/105 suites pass |

**WP-3.0 is complete. WP-3.1 (integration.controller.ts migration) may begin as a separate, subsequent work package — not performed by this document or this commit.**

---

*End of WP-3.0 Permission Foundation Implementation Report.*
