# PEP-3A Readiness and Scope Lock

## Status: PROGRAM ARCHITECTURE REVIEW BOARD (PARB) — READINESS ASSESSMENT AND ENGINEERING CONTRACT

---

## Document Control

| Field | Value |
|---|---|
| Document | PEP-3A Readiness and Scope Lock |
| Issuing authority | AIOS Program Architecture Review Board (PARB) |
| Status | **READINESS ASSESSMENT — NOT AN IMPLEMENTATION AUTHORIZATION** |
| Effective date | 2026-07-31 |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md`; `docs/engineering/DGX3_PLATFORM_REMEDIATION_ENGINEERING_EXECUTION_PLAN_1.md`; `docs/engineering/verification/DGX3_PEP1_VERIFICATION_AND_PHASE_CLOSURE.md`; `docs/engineering/verification/DGX3_PEP2_VERIFICATION_AND_PHASE_CLOSURE.md`; direct, fresh inspection of `src/integration/integration.controller.ts`, `src/parts/parts.controller.ts`, `src/vehicles/vehicles.controller.ts`, `src/common/permissions/permission.ts`, `src/common/permissions/role-permissions.ts`, `src/common/permissions/permissions.guard.ts`, `src/common/permissions/request-actor.ts`, `src/common/rbac/roles.guard.ts`, `src/common/rbac/roles.decorator.ts`, `src/integration/integration.module.ts`, `src/parts/parts.module.ts`, `src/vehicles/vehicles.module.ts`, `src/integration/adapters/integration-adapters.controller.ts`; fresh `git log` history per file; fresh full unit-suite execution; fresh `tsc --noEmit` |
| No source code, tests, workflows, schemas, or migrations were modified to produce this document | **Confirmed** — see §15 |

---

## 1. Executive Summary

**Naming discrepancy — read this first.** A direct, repository-wide search (`grep -rn "PEP-3A\|PEP3A"`) found **zero occurrences** of the label "PEP-3A" anywhere in this repository — not in the approved Technical Specification, not in the Engineering Execution Plan, not in either prior phase's verification document. The approved documents name the phase that follows PEP-2 **"PEP-3" (Permission Migration)**, fully specified as **PRTS-003** in the Technical Specification and as **Phase 3** in the Engineering Execution Plan. Given that every other fact this task's background section asserts (PEP-1 completed and verified, PEP-2 completed/independently verified/closed, the documentation CI arc) is independently confirmed accurate against the real repository state (§2), the most defensible, evidence-grounded reading is that **"PEP-3A" refers to this same, real, already-approved PEP-3 (Permission Migration) phase** — not a distinct, undefined phase. This document proceeds on that reading, but treats the label mismatch itself as a binding condition (§14, Condition 1): the Program/Governance Board must confirm this mapping — or correct the label in future authorizations — before any implementation commit is attributed to "PEP-3A."

Substantively, PEP-3/PRTS-003 is exceptionally well-specified: an approved Technical Specification defines an exact, per-endpoint permission mapping table (7 new permission strings, precise role grants, verified against the existing `@Roles(...)` baseline for equivalence); an approved Execution Plan translates it into three independent, sequential, per-controller work packages with named files, named rollback triggers, and named acceptance criteria. Fresh, independent re-inspection in this session (not accepted from either prior verification document's claims) confirms: PEP-1 and PEP-2 are genuinely closed (their files carry exactly the expected commits and no more); every file PEP-3 is expected to touch is still at the repository's initial commit (zero premature work exists); the full unit suite passes fresh at 104/104 suites, 704/704 tests; `tsc --noEmit` reports zero errors; and a sibling controller in the same directory (`IntegrationAdaptersController`) already uses the exact target pattern (`PermissionsGuard`/`@RequirePermissions`) this phase would apply to the other three controllers, confirming the target pattern is not new or speculative — it is already proven, in production, in this same codebase.

**Overall readiness: substantively ready. Administratively, one label-confirmation condition outstanding.**

---

## 2. Current Repository Readiness

| Claim (from task background) | Verification method | Result |
|---|---|---|
| PEP-1 Completed and Verified | `git log --oneline -- src/identity/jwt-auth-context.guard.ts`; read `DGX3_PEP1_VERIFICATION_AND_PHASE_CLOSURE.md` | **Confirmed.** Exactly two commits: `84a7f2e` (initial), `6e0114c` (PEP-1). Closure document records "PEP-1 is verified complete... PEP-2 may begin." |
| PEP-2 Completed, Independently Verified, and Closed | `git log --oneline -- src/common/permissions/permissions.guard.ts`; read `DGX3_PEP2_VERIFICATION_AND_PHASE_CLOSURE.md`; fresh `grep -rln "RequireVerifiedActor" src/` | **Confirmed.** Exactly two commits: `84a7f2e`, `814a4d0` (PEP-2). Closure document records "PEP-2 is verified complete... PEP-3 (Permission Migration) may begin." Fresh search confirms `@RequireVerifiedActor()` is applied to zero handlers today — still provably inert. |
| Documentation Lint Remediated / CI Root Cause Investigated / CI Observability Remediated / CI Runtime Remediated / Mermaid Validation SUCCESS | `git log --oneline` (this session's own prior commits: `53b2054`, `782fe03`, `bf7d783`, `34b2f6e`, `be85eaa`, `0212418`, `6dc512e`) | **Confirmed** — all present in history; two consecutive live GitHub Actions runs (`30585379365`, `30585755145`) independently confirmed SUCCESS for `Documentation Mermaid Validation` earlier in this same session. |
| Repository is "engineering-clean" | Fresh full unit-suite run; fresh `tsc --noEmit`; `git status --short` | **Confirmed.** 104/104 suites, 704/704 tests pass. Zero type errors. Working tree clean before this task began. |
| PEP-3 has not prematurely started | `git log --oneline` for all seven PEP-3-affected files | **Confirmed.** `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`, `permission.ts`, `role-permissions.ts`, `roles.guard.ts` each show only `84a7f2e` (initial commit) — no PEP-3 work exists anywhere in this repository today. |

**Conclusion**: every readiness precondition the task's background section asserts is independently, freshly confirmed true. The repository is in the exact state the Engineering Execution Plan's dependency graph requires for PEP-3 (PEP-1 + PEP-2 both complete and verified) to begin.

---

## 3. PEP-3A Scope Definition

Per the approved Technical Specification (PRTS-003) and Engineering Execution Plan (Phase 3), and subject to the naming condition in §1/§14:

**Objective**: Migrate `integration.controller.ts`, `parts.controller.ts`, and `vehicles.controller.ts` from `RolesGuard`/`@Roles(...)` onto the unified `PermissionsGuard`/`@RequirePermissions(...)` path, closing the confirmed gap that `RolesGuard` reads `x-user-role` directly from headers and never consults `getRequestActor()` — meaning a real, verified JWT actor is never consulted at all on these three controllers today, even if the caller presents one.

**In scope, exactly**:

1. Add seven new permission constants to `src/common/permissions/permission.ts`: `integration.sync`, `integration.deadLetters.read`, `integration.deadLetters.resolve`, `parts.create`, `parts.matchCandidates.manage`, `vehicle.create`, `vehicle.correct`. Confirmed by fresh inspection: none of these seven strings exist in the current `PERMISSIONS` array (over 140 existing entries spanning nine prior phases).
2. Grant each new permission to the exact roles the Technical Specification's mapping table specifies, in `src/common/permissions/role-permissions.ts` — no role gains or loses access relative to each endpoint's current `@Roles(...)` list.
3. Migrate `integration.controller.ts` (4 decorated endpoints), `parts.controller.ts` (4 decorated endpoints; 2 `GET` endpoints remain undecorated), and `vehicles.controller.ts` (2 decorated endpoints; 3 `GET` endpoints remain undecorated) from `@UseGuards(RolesGuard)` + `@Roles(...)` to `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`, **one controller at a time**, each fully regression-verified before the next begins.
4. Add unit/authorization-path test coverage for each migrated controller's guard behavior (none exists today for these three controllers specifically — confirmed, §6).

---

## 4. Explicit Out-of-Scope Items

Restated directly from the approved Technical Specification §5/§9 and Execution Plan §9 — none of these was expanded or narrowed by this readiness assessment:

| Item | Why excluded |
|---|---|
| Any DGX 3.0 business entity/logic (`RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome`, evidence citation) | Not part of the Platform Remediation Authorization at all; DGX 3.0 remains **Specified** maturity, **Not Started** certification. |
| Vehicle Lifecycle, Digital Twin, Repeat Repair (`src/vehicle-lifecycle/`, `src/twin-intelligence/`) | Operational Core's existing, permanent-ownership business logic per `DGX3-ADR-0001`; untouched by any phase of this remediation. |
| Any Prisma schema modification or migration | Explicitly excluded by the Technical Specification §6 (Technical Constraints) and confirmed still true: `git log --oneline -- services/operational-core/prisma/schema.prisma` shows only the initial commit through PEP-2's own verification, re-confirmed structurally unchanged in this session. |
| Any new API endpoint or DTO | This phase changes *how* the three controllers authenticate/authorize, never *what* they do or *how many* endpoints exist. |
| Branch/warehouse scoping enforcement | A separately-scoped, already-documented future effort (`docs/architecture/rbac-permissions.md`'s own "Scope limitations"), explicitly deferred. |
| Tightening the currently-open `GET /parts`, `GET /parts/:id`, `GET /vehicles`, `GET /vehicles/vin/:vin`, `GET /vehicles/:id` endpoints | A deliberate, evidenced-and-documented future scope decision for the Business/Operational Owner, not this remediation (Condition Resolution CR-T-003). |
| Removal of `RolesGuard`/`roles.decorator.ts` | May become unused after PEP-3, but deletion is a separate, future, out-of-scope decision (both files are still needed structurally until all three controllers are migrated, and retained afterward pending a separate decision). |
| Full removal of the legacy `x-user-role` header-stand-in path | Only its silent-fallback-on-failure behavior (PEP-1) and its use for opted-in high-assurance permissions (PEP-2) were addressed; wholesale deprecation is a distinct, larger, future decision. |
| PEP-4 (Regression Testing consolidation), PEP-5 (Security Verification Preparation), PRTS-005 (the actual independent security review) | **Future phase** — depends on PEP-3's completion per the approved dependency graph; not authorized by this document. |
| Convening or predetermining Engineering Authorization Review #2's outcome | Explicitly listed as out of scope in the Execution Plan §9; this document does not do so. |

---

## 5. Dependency Analysis

```
PEP-1 (Identity Layer)                     — COMPLETE, VERIFIED, CLOSED
   │
   ▼
PEP-2 (Authorization Layer)                — COMPLETE, VERIFIED, CLOSED
   │  gate confirmed clear: PEP-3 may begin
   ▼
PEP-3 / "PEP-3A" (Permission Migration)     — READY (subject to §14 Condition 1)
   │  internally sequential: integration → parts → vehicles
   │  no parallel work permitted within this phase
   ▼
PEP-4 (Regression Testing)                 — FUTURE PHASE, blocked on PEP-3
   ▼
PEP-5 (Security Verification Preparation)  — FUTURE PHASE, blocked on PEP-4
   ▼
PRTS-005 (Independent Security Verification) — FUTURE, outside any of these plans' own execution
```

### Component-level dependency table

| Dependency | Current state | Classification |
|---|---|---|
| `PermissionsGuard` (`src/common/permissions/permissions.guard.ts`) | Implemented (PEP-2), tested (94-line spec, fresh pass confirmed), handles both `@RequirePermissions` and `@RequireVerifiedActor` | **Already implemented** — no change needed for PEP-3 to consume it |
| `getRequestActor()` (`src/common/permissions/request-actor.ts`) | Implemented (pre-PEP-1), verified-actor-first precedence confirmed by direct read | **Already implemented** |
| `ROLE_PERMISSIONS` map (`src/common/permissions/role-permissions.ts`) | Static, code-level, 354 lines, does not yet contain the 7 new PEP-3 permissions | **Needs extension** (additive only — new keys added to existing role arrays) |
| `PERMISSIONS` array (`src/common/permissions/permission.ts`) | Static, 140+ existing strings across 9 phases, does not yet contain the 7 new PEP-3 strings | **Needs extension** (additive only) |
| `@RequirePermissions` decorator (`permissions.decorator.ts`) | Already implemented, used by `IntegrationAdaptersController` today (confirmed by direct read) | **Already implemented** — proven pattern, zero new implementation needed |
| `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts` | Still on `@UseGuards(RolesGuard)` + `@Roles(...)`, confirmed by direct read; unchanged since initial commit | **Needs extension** (guard/decorator swap only — no business-logic method changes) |
| `RolesGuard` / `@Roles` (`src/common/rbac/`) | Implemented, still actively used by exactly these 3 controllers today | **Deferred** — retained, not removed, per explicit out-of-scope decision (§4) |
| `integration.module.ts`, `parts.module.ts`, `vehicles.module.ts` | Confirmed by direct read: declare controllers/providers only; no guard-specific module wiring | **No change expected** — `Reflector`/`PermissionsGuard` require no module-level registration beyond what already exists globally |
| Database / Prisma schema | Confirmed unchanged since initial commit (all prior phases) | **Deferred** — explicitly out of scope for this phase and all of PRTS-001–005 |
| External integrations (SAP B1, Odoo adapters) | Untouched — `IntegrationAdaptersController` (which calls these adapters) already uses `PermissionsGuard`, confirmed unaffected by this phase | **No change expected** |
| `require-verified-actor.decorator.ts` (PEP-2 output) | Implemented, zero current adopters (confirmed by fresh `grep`) | **Deferred** — PEP-3's mapping table does not require any of the 7 new permissions to opt into this; adoption remains a future decision |

---

## 6. Repository Impact Analysis

**Modules touched**: `src/integration/`, `src/parts/`, `src/vehicles/` (controllers only, not services/handlers/DTOs), `src/common/permissions/` (two data files only, not the guard itself).

**Modules explicitly not touched**: `src/identity/` (PEP-1, frozen), `src/common/permissions/permissions.guard.ts` / `permissions.decorator.ts` / `require-verified-actor.decorator.ts` (PEP-2, frozen — PEP-3 *consumes* these, it does not modify them), `src/common/rbac/` (retained as-is), any DGX-3.0-named path, any Prisma schema/migration file, any module outside the three named controllers' own files.

**Existing test coverage found** (fresh search):

| Area | Existing spec files | Coverage of the authorization path specifically |
|---|---|---|
| `integration.controller.ts` | `integration.service.spec.ts`, 3 adapter specs | **None** — all existing specs test service/adapter logic, not the controller's guard/decorator behavior |
| `parts.controller.ts` | `part-matcher.service.spec.ts`, `similarity-scorer.spec.ts` | **None** — same pattern |
| `vehicles.controller.ts` | `vehicles.service.spec.ts` | **None** — same pattern |
| `roles.guard.ts` | *(none)* | **None** — confirmed, matches the Technical Specification's own finding |
| `permissions.guard.ts` | `permissions.guard.spec.ts` (94 lines) | Full coverage of `PermissionsGuard`'s own logic (pre-existing + PEP-2 additions) — this is what the migrated controllers will rely on |

This confirms the Technical Specification's own anticipation exactly: no dedicated authorization-path test exists for any of the three controllers today, so PEP-3's work packages must include *new* test coverage, not merely re-run existing coverage (§10, §11).

---

## 7. File Impact Matrix

| File | Classification | Justification |
|---|---|---|
| `src/common/permissions/permission.ts` | Existing file, extended | Add exactly 7 new constants; append-only, no existing entry modified (confirmed: no naming collision with any of 140+ existing strings) |
| `src/common/permissions/role-permissions.ts` | Existing file, extended | Add grants for the 7 new permissions to exactly the roles the mapping table specifies; no existing role's existing grants change |
| `src/integration/integration.controller.ts` | Existing file, modified | Swap `@UseGuards(RolesGuard)` → `@UseGuards(PermissionsGuard)`; swap 4 `@Roles(...)` → `@RequirePermissions(...)`; zero business-logic lines change |
| `src/parts/parts.controller.ts` | Existing file, modified | Same swap for 4 decorated endpoints; the 2 undecorated `GET` endpoints (`list`, `findById`) remain untouched, per explicit out-of-scope decision |
| `src/vehicles/vehicles.controller.ts` | Existing file, modified | Same swap for 2 decorated endpoints; the 3 undecorated `GET` endpoints remain untouched |
| New authorization-path spec file(s) for the 3 controllers (exact filenames to be determined by the implementer, colocated per this repo's existing convention, e.g. `integration.controller.spec.ts` or an integration-style spec) | New file(s) | No existing spec covers this path (§6); the Technical Specification's own §4/§7 requires it |
| `src/common/rbac/roles.guard.ts`, `src/common/rbac/roles.decorator.ts` | No change expected | Retained; removal is an explicit, separate, future, out-of-scope decision |
| `src/identity/*`, `src/common/permissions/permissions.guard.ts`, `permissions.decorator.ts`, `require-verified-actor.decorator.ts` | No change expected | PEP-1/PEP-2 outputs; PEP-3 consumes, never modifies them |
| `src/integration/integration.module.ts`, `src/parts/parts.module.ts`, `src/vehicles/vehicles.module.ts` | No change expected | Confirmed by direct read: no guard-specific module wiring exists; `Reflector` and both guards are already available via NestJS's existing global DI |
| `services/operational-core/prisma/schema.prisma`, any migration file | No change expected | Explicitly, structurally excluded (§4, §6 of the Technical Specification) |
| Any DGX-3.0-named file, `src/vehicle-lifecycle/`, `src/twin-intelligence/` | No change expected | Explicitly out of scope (§4) |

---

## 8. Architectural Validation

| Check | Result | Evidence |
|---|---|---|
| Does not duplicate existing functionality | **Confirmed** | `PermissionsGuard`, `@RequirePermissions`, `getRequestActor()` already exist and are already used in production by `IntegrationAdaptersController` (direct read) — PEP-3 applies an existing, proven pattern, it does not build a new one. |
| Does not violate previous governance | **Confirmed** | No item in §4 (Out of Scope) is touched; every file this phase changes was already named, in advance, by the approved Technical Specification. |
| Does not overlap PEP-2 | **Confirmed** | PEP-2's own files (`permissions.guard.ts`, `permissions.decorator.ts`, `require-verified-actor.decorator.ts`) are consumed, not modified. Fresh `git log` confirms PEP-2's commit (`814a4d0`) touched none of PEP-3's target files, and vice versa this phase touches none of PEP-2's. |
| Maintains separation of concerns | **Confirmed** | Authentication (`src/identity/`) and authorization (`src/common/permissions/`, `src/common/rbac/`) remain distinct; PEP-3 only changes which authorization guard three controllers use, not the boundary between the two layers. |
| Maintains module boundaries | **Confirmed** | Each of the three modules (`IntegrationModule`, `PartsModule`, `VehiclesModule`) requires zero structural change — only the controller files inside them change. |
| Maintains authorization architecture | **Confirmed** | The target state is not a new architecture — it is the *same* `PermissionsGuard`/`getRequestActor()` architecture every other controller in the repository (including `IntegrationAdaptersController`, already) uses. This phase reduces architectural inconsistency, it does not introduce a new one. |
| Maintains dependency direction | **Confirmed** | `src/identity/` → `src/common/permissions/` (established in PEP-1/PEP-2, per the Technical Specification's corrected §3); PEP-3 introduces no new dependency edge — the three controllers already depend on `src/common/rbac/` today and will depend on `src/common/permissions/` instead, a lateral swap, not a new direction. |

---

## 9. Risk Assessment

| Risk | Category | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| A role gains or loses access on one of the three controllers | Security / Regression | Medium (the Technical Specification itself rates this phase "High" risk overall) | High — incorrect authorization on production-facing endpoints | Mapping table (§3) is an exact, pre-verified equivalence to each endpoint's current `@Roles(...)` list; per-controller, per-endpoint acceptance criterion requires confirming every previously-valid caller still succeeds and every previously-rejected caller is still rejected before the next controller begins |
| Combined, simultaneous multi-controller change obscures which controller caused a regression | Technical / Testing | Low, if sequencing is honored | Medium | Binding sequencing condition (integration → parts → vehicles, one at a time, full regression pass after each) already fixed by the Implementation Authorization — non-negotiable per §3/§10 |
| New permission constant reused or miscopied across controllers, coupling their access unintentionally | Security | Low | Medium | All 7 constants are single-purpose and controller-specific by name (`integration.*`, `parts.*`, `vehicle.*`); explicit rollback criterion already names this exact failure mode |
| Missing authorization-path test coverage lets a real regression slip through | Testing | Medium (confirmed: zero such tests exist today) | High | §10/§11 work packages mandate new test coverage per controller as part of, not after, the migration — not deferred to PEP-4 |
| `RolesGuard`/`roles.decorator.ts` becomes silently dead code with no test signal if forgotten | Operational | Low | Low | Explicit out-of-scope decision to retain, not remove; PEP-4 already anticipates adding `roles.guard.spec.ts` if the guard is retained, closing this file's own pre-existing test gap |
| Schema/migration creep (a future engineer "just adding one column" to support richer permission scoping) | Migration | Low | High (would break this phase's own scope contract) | Technical Constraints (§6 of PRTS-1) are explicit and non-negotiable: no schema modification, no new migration, under any of PRTS-001–005 |
| Performance regression from guard swap | Performance | Very low | Low | Both guards perform an equivalent, single-pass `Reflector` lookup plus (for `PermissionsGuard`) an array-membership check against a static in-memory map — no new I/O, no new async work introduced |
| Label ambiguity ("PEP-3A" vs. "PEP-3") causes evidence/audit-trail confusion later | Operational / Governance | Certain, absent correction | Low-Medium (traceability, not correctness) | §14 Condition 1 — resolve before implementation is attributed to either label |

---

## 10. Implementation Work Packages

Each package is independent, reviewable, rollback-safe, and testable, per the Execution Plan's own Phase 3 structure — this document does not create new packages, it restates and locks the already-approved ones:

| # | Work package | Scope | Independent? | Rollback-safe? | Testable? |
|---|---|---|---|---|---|
| WP-3.0 | Add 7 permission constants + role grants | `permission.ts`, `role-permissions.ts` (additive only, performed once ahead of the first controller) | Yes — no controller depends on this until WP-3.1 | Yes — unused constants have zero runtime effect if a later controller migration is rolled back | Yes — a static-map diff confirms exact grant equivalence |
| WP-3.1 | Migrate `integration.controller.ts` | Guard/decorator swap on 4 endpoints + new authorization-path tests | Yes | Yes — per-controller revert restores `RolesGuard`/`@Roles`, unaffected by WP-3.2/3.3 | Yes — per-endpoint mapping-equivalence + regression suite |
| WP-3.2 | Migrate `parts.controller.ts` | Guard/decorator swap on 4 endpoints (2 `GET` endpoints untouched) + new tests | Yes, begins only after WP-3.1's full regression pass | Yes | Yes |
| WP-3.3 | Migrate `vehicles.controller.ts` | Guard/decorator swap on 2 endpoints (3 `GET` endpoints untouched) + new tests | Yes, begins only after WP-3.2's full regression pass | Yes | Yes |

**Recommended execution order**: WP-3.0 → WP-3.1 (`integration`) → WP-3.2 (`parts`) → WP-3.3 (`vehicles`) — matches the Technical Specification's own "lowest-risk-first" recommendation and the Execution Plan's binding sequencing condition. No parallel work between packages.

---

## 11. Test Strategy

| Test type | Requirement |
|---|---|
| Unit tests | Per-controller: confirm each migrated endpoint's `@RequirePermissions(...)` matches the mapping table exactly; confirm `PermissionsGuard`'s existing logic (already tested) requires no change to satisfy this |
| Integration tests | New coverage for each of the 3 controllers' authorization path specifically (confirmed absent today, §6) — at minimum, one allowed and one rejected case per new permission |
| Authorization tests | Direct, per-permission confirmation that every role in each endpoint's original `@Roles(...)` list can still call it, and no role outside that list can (the mapping table itself is the acceptance artifact) |
| Regression tests | Full existing repository unit + integration suite (currently 104 suites / 704 tests) re-run after **each** controller's migration, not only at the end of all three |
| Failure-path tests | Confirm a role lacking the new permission receives `ForbiddenException` naming the missing permission (existing `PermissionsGuard` behavior, already tested — confirm it holds for the 3 new controllers too) |
| Security tests | Confirm no verified-JWT-bearing caller is now silently ignored (the exact gap this phase closes) — a direct before/after comparison per controller |
| Repository-wide validation | `tsc --noEmit` (currently 0 errors); diff review confirming only the files in §7 changed |
| GitHub Actions validation | Existing CI must pass on the real migration commits — no workflow change is anticipated or authorized by this phase |
| Acceptance criteria | Per controller: mapping-table equivalence confirmed; zero regression in the full suite; per-controller sign-off recorded before the next controller begins |

---

## 12. Rollback Strategy

| Aspect | Definition |
|---|---|
| Rollback boundary | Single-controller granularity — never an all-or-nothing rollback of all three controllers, per the approved Execution Plan's own explicit design |
| Files affected by a rollback | Exactly one controller file (`@UseGuards`/decorators reverted to `RolesGuard`/`@Roles`); the 7 permission constants and their grants may remain defined but unused with zero effect |
| Database impact | None — no schema or migration is touched by this phase in either direction |
| Configuration impact | None identified — no environment variable, feature flag, or module registration changes |
| Module impact | None — reverting a controller's guard/decorator lines requires no module file change |
| Verification after rollback | That controller's full test suite (existing + any new tests added during its migration attempt) passes identically to its pre-migration baseline; the other two controllers (if already migrated) remain unaffected and continue to pass |
| Rollback trigger | Any role gaining or losing access relative to that controller's pre-migration baseline; any regression in that controller's tests; any finding that a permission constant was reused across controllers in a coupling way |

---

## 13. Acceptance Criteria

PEP-3/"PEP-3A" is complete only when **all** of the following hold simultaneously (restated from the approved Technical Specification's Definition of Done, §9, narrowed to this phase's own scope):

- All three controllers use `PermissionsGuard`/`@RequirePermissions(...)` exclusively; `RolesGuard` has zero remaining real controller usages (the file itself may still exist).
- Every previously-valid caller (by role, via header or verified JWT) continues to succeed on all three controllers; every previously-rejected caller continues to be rejected.
- The mapping table's exact role-grant equivalence is confirmed per endpoint, not assumed.
- New authorization-path test coverage exists for all three controllers.
- The full regression suite passes with zero new failures beyond any already-intentional, already-documented exception from a prior phase (PEP-1's one named exception; none introduced by this phase itself).
- The repository diff remains entirely within §7's File Impact Matrix — no schema, migration, or file outside the named scope.
- `tsc --noEmit` reports zero errors.
- No DGX-3.0-named file, no `src/vehicle-lifecycle/`, no `src/twin-intelligence/` file was touched.

---

## 14. Go / No-Go Decision

### GO WITH CONDITIONS

**Condition 1 (blocking, administrative — must be resolved before any commit is attributed to "PEP-3A")**: No document in this repository defines a phase named "PEP-3A." The approved Technical Specification and Engineering Execution Plan both name the next phase **"PEP-3" (Permission Migration)**. This document treats "PEP-3A" as referring to that same, real, fully-specified phase — the single most defensible reading, since every other fact in the task's background is independently confirmed true and PEP-3 is exactly the next phase the approved dependency graph authorizes. The Program/Governance Board must either (a) confirm this mapping explicitly, or (b) issue a corrected label, before implementation work is reported as "PEP-3A" complete. This is a traceability condition, not a scope or safety concern — the underlying engineering contract (§3–§13) is unambiguous regardless of which label is ultimately used.

**Condition 2 (non-blocking, process)**: New authorization-path test coverage for all three controllers must be written as part of each work package (§10), not deferred to PEP-4 — no such coverage exists today (§6), and the approved Technical Specification already anticipates this ("new integration coverage added if none exists today").

**Condition 3 (non-blocking, forward-looking)**: Before PEP-5/PRTS-005 (outside this phase's own scope), the Program/Governance Board should confirm whether the named Security Reviewer (GATE-OWN-003) has been assigned, or whether an equally independent fallback reviewer must be identified — this does not block PEP-3 itself, since PRTS-005 depends on PEP-4, which depends on PEP-3's completion.

No other blocking issue was found. Every dependency PEP-3 requires is already implemented and tested; every file it will touch is confirmed unmodified and correctly scoped; the target authorization pattern is already proven elsewhere in this same codebase; the full regression baseline is green; rollback is cleanly executable at single-controller granularity.

---

## 15. Validation

| Check | Result |
|---|---|
| Exactly one new document created | **Confirmed** — `docs/engineering/PEP3A_READINESS_AND_SCOPE_LOCK.md` only |
| No source code changed | **Confirmed** — this task performed only `cat`/`git log`/`grep`/`npm test`/`tsc --noEmit` (all read-only); `git status --short` was empty before this document was written |
| No documentation modified except this readiness report | **Confirmed** |
| No workflows modified | **Confirmed** |
| No schemas modified | **Confirmed** |
| No migrations modified | **Confirmed** |
| Working tree otherwise clean | **Confirmed** |

---

*End of PEP-3A Readiness and Scope Lock.*
