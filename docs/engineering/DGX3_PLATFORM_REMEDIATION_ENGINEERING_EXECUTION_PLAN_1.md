# DGX 3.0 Platform Remediation — Engineering Execution Plan #1

### Translating the Approved Technical Specification into Executable Engineering Work Packages

---

## Document Control

| Field | Value |
|---|---|
| Document | Platform Remediation Engineering Execution Plan #1 |
| Issuing authority | AIOS Platform Engineering Office (PEO) |
| Status | **ENGINEERING PLAN — DOES NOT ITSELF IMPLEMENT ANYTHING** |
| Effective date | 2026-07-30 |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_AUTHORIZATION_1.md`; `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md` (as revised); `docs/reviews/DGX3_PLATFORM_REMEDIATION_TECHNICAL_REVIEW_1.md`; `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_APPROVAL_1.md`; `docs/reviews/DGX3_PLATFORM_REMEDIATION_CONDITION_RESOLUTION_1.md`; `docs/reviews/DGX3_PLATFORM_REMEDIATION_CONDITION_CLOSURE_VERIFICATION_1.md`; `docs/governance/DGX3_PLATFORM_REMEDIATION_IMPLEMENTATION_AUTHORIZATION_1.md` |

**This plan translates the already-approved, self-contained Technical Specification into executable work packages. It creates no source code, schema, migration, or API. Every phase, task, and file reference below restates what the Technical Specification already defines — this plan adds sequencing, checkpoints, and evidence structure; it does not add scope, and it does not authorize itself to begin — that authorization was already granted (`IMPLEMENTATION_AUTHORIZED_WITH_CONDITIONS`) and this plan operates strictly within it.**

---

## 1. Executive Summary

Five implementation phases translate PRTS-001 through PRTS-005 into sequenced, independently verifiable work packages, honoring the two binding conditions the Implementation Authorization attached: strict phase-by-phase (and, within Phase 3, controller-by-controller) sequencing, and a non-waivable independent security verification regardless of whether a named Security Reviewer exists yet. Every file this plan touches was already named in the Technical Specification; no new file, module, schema, or API is introduced by this plan or authorized by it. The critical path runs through Phase 3 (the highest-risk phase, per the Technical Specification's own risk rating) and terminates at Phase 5's evidence handoff to an independent reviewer — this plan does not perform that review itself.

---

## 2. Engineering Strategy

The strategy mirrors the Technical Specification's own design discipline exactly: land the lowest-risk, foundational fix first (Phase 1), add the purely additive opt-in mechanism second (Phase 2) with zero effect on any existing caller, then migrate the three highest-regression-risk controllers one at a time (Phase 3), consolidate regression evidence (Phase 4), and finally assemble — but not perform — the independent security verification package (Phase 5). No phase begins until the prior phase's own acceptance criteria are met and recorded; no phase may be collapsed or reordered, per the Implementation Authorization's binding condition on sequencing.

---

## 3. Phase Breakdown

### Phase 1 — Identity Layer

- **Phase Identifier**: PEP-1
- **Objective**: Close the "invalid/expired credential silently treated as anonymous" gap in `JwtAuthContextGuard`, conditioned on whether the resolved handler already requires a permission or role (per Condition Resolution CR-T-001).
- **Components affected**: `src/identity/` only.
- **Files expected to change**: `src/identity/jwt-auth-context.guard.ts`; new `src/identity/jwt-auth-context.guard.spec.ts`.
- **Files explicitly prohibited**: any file under `src/common/permissions/`, `src/common/rbac/`, `src/vehicle-lifecycle/`, `src/twin-intelligence/`, any Prisma schema/migration file, any controller other than `jwt-auth-context.guard.ts`'s own module wiring (`identity.module.ts` is not expected to change and must not be touched unless a genuine defect is found, in which case it is out of this phase's scope and must be escalated, not silently fixed).
- **Implementation tasks**:
  1. Add a `Reflector`-based check inside `canActivate` for `PERMISSIONS_KEY` (from `common/permissions/permissions.decorator.ts`) and `ROLES_KEY` (from `common/rbac/roles.decorator.ts`) on the resolved handler/class.
  2. When a credential is presented, verification throws, and either metadata key is present on the resolved handler: allow the thrown `UnauthorizedException` to propagate (or re-throw an equivalent one) instead of catching and continuing.
  3. When a credential is presented, verification throws, and neither metadata key is present: preserve today's behavior exactly (catch, leave `verifiedActor` unset, return `true`).
  4. When no credential is presented at all: preserve today's behavior exactly, regardless of handler metadata.
  5. Write `jwt-auth-context.guard.spec.ts` covering all four scenarios named in the Technical Specification's PRTS-001 "Expected verification."
- **Acceptance criteria**: All four unit-test scenarios pass; the full existing suite passes with zero new failures.
- **Regression tests**: Full existing repository unit + integration suite. Explicit, named confirmation that `GET /health`, `/health/db`, `/health/redis`, `/health/dgx`, `GET /metrics`, every unauthenticated `identity.controller.ts` endpoint (`/auth/register`, `/login`, `/refresh`, `/logout`, `/mfa/*`, `/password/*`, `/email/*`), and the undecorated `GET /parts`, `GET /parts/:id`, `GET /vehicles`, `GET /vehicles/vin/:vin`, `GET /vehicles/:id` all continue to tolerate an invalid/expired `Authorization` header exactly as today.
- **Rollback criteria**: Any of the named open routes above newly rejecting a request; any unexpected failure in the full regression suite not attributable to the one intentional behavior change (invalid credential rejected on a route that already requires a permission/role).
- **Evidence required**: Test output for all four scenarios; regression suite pass record; explicit pass confirmation for each of the five named open-route groups.
- **Completion definition**: `jwt-auth-context.guard.ts` behaves exactly as the Technical Specification's corrected §3/§4 define; `jwt-auth-context.guard.spec.ts` exists and passes; full regression suite passes.

### Phase 2 — Authorization Layer

- **Phase Identifier**: PEP-2
- **Objective**: Introduce the opt-in "require verified actor" enforcement mechanism (PRTS-002) — purely additive, zero effect on any handler that does not use it.
- **Components affected**: `src/common/permissions/` only.
- **Files expected to change**: `src/common/permissions/permissions.guard.ts`; `src/common/permissions/permissions.decorator.ts` (or a new, adjacent decorator file within the same directory); `src/common/permissions/permissions.guard.spec.ts`.
- **Files explicitly prohibited**: `src/identity/` (Phase 1 is closed by this point — no further change to it in this phase), `src/common/rbac/`, any of the three controllers (Phase 3's exclusive scope), any DGX-3.0-named path, any schema/migration file.
- **Implementation tasks**:
  1. Add a new, additive reflector metadata key (e.g., alongside `PERMISSIONS_KEY`) marking a handler as requiring a verified actor.
  2. In `PermissionsGuard.canActivate`, check this new metadata; if set and `getRequestActor(request).authMethod` is not `'jwt'`/`'api-key'`, reject (consistent with `PermissionsGuard`'s existing `ForbiddenException` style) before evaluating role/permission at all.
  3. Confirm no existing handler is annotated with the new metadata (it is intentionally unused until a future capability, e.g. DGX 3.0, adopts it — adoption itself is explicitly out of scope for this plan).
  4. Extend `permissions.guard.spec.ts` with tests proving a marked handler rejects a header-stand-in actor and accepts a verified one, and that unmarked handlers are entirely unaffected.
- **Acceptance criteria**: New tests pass; every existing `permissions.guard.spec.ts` test continues to pass unmodified in its assertions.
- **Regression tests**: Full existing repository unit + integration suite — zero new failures expected, since this phase is purely additive and unused by any current handler.
- **Rollback criteria**: Any existing `PermissionsGuard`-gated endpoint's behavior changes in any way; any test failure in the pre-existing `permissions.guard.spec.ts` suite.
- **Evidence required**: New test output; confirmation (via diff) that no existing handler was annotated with the new metadata.
- **Completion definition**: The new opt-in mechanism exists, is tested, and is provably inert for every current caller.

### Phase 3 — Permission Migration

- **Phase Identifier**: PEP-3
- **Objective**: Migrate `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts` from `RolesGuard`/`@Roles(...)` to `PermissionsGuard`/`@RequirePermissions(...)`, using the seven precisely-scoped permissions the Technical Specification's mapping table defines (Condition Resolution CR-T-003) — **one controller at a time**, per the Implementation Authorization's binding sequencing condition.
- **Components affected**: `src/integration/`, `src/parts/`, `src/vehicles/`, `src/common/permissions/permission.ts`, `src/common/permissions/role-permissions.ts`.
- **Files expected to change**:
  - `src/common/permissions/permission.ts` — add exactly seven new constants: `integration.sync`, `integration.deadLetters.read`, `integration.deadLetters.resolve`, `parts.create`, `parts.matchCandidates.manage`, `vehicle.create`, `vehicle.correct`.
  - `src/common/permissions/role-permissions.ts` — grant each new permission to exactly the roles the mapping table specifies (no more, no fewer): `integration.sync` → `SYSTEM_ADMINISTRATOR`, `OWNER`; `integration.deadLetters.read`/`integration.deadLetters.resolve` → `SYSTEM_ADMINISTRATOR`, `OWNER`, `DATA_QUALITY_REVIEWER`; `parts.create` → `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER`, `STOREKEEPER`; `parts.matchCandidates.manage` → `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER`; `vehicle.create`/`vehicle.correct` → `SYSTEM_ADMINISTRATOR`, `OWNER`, `BRANCH_MANAGER`, `PARTS_MANAGER`.
  - `src/integration/integration.controller.ts` — replace `@UseGuards(RolesGuard)` + `@Roles(...)` with `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`, per endpoint, per the mapping table.
  - `src/parts/parts.controller.ts` — same, for its four decorated endpoints; the two undecorated `GET` endpoints remain undecorated (explicitly out of scope, per the Technical Specification's §5).
  - `src/vehicles/vehicles.controller.ts` — same, for its two decorated endpoints; the three undecorated `GET` endpoints remain undecorated.
- **Files explicitly prohibited**: any Prisma schema/migration file; `RolesGuard`/`roles.decorator.ts` themselves (retained, not deleted, until all three controllers no longer reference them — deletion, if ever pursued, is a separate, future, out-of-scope decision); any DGX-3.0-named path; any business-logic method inside the three controllers (only the guard/decorator lines change).
- **Implementation tasks** (repeated three times, once per controller, never combined):
  1. Add the controller's required new permission constant(s) to `permission.ts` and their exact role grants to `role-permissions.ts` (shared step, performed once, ahead of the first controller's migration — not repeated per controller).
  2. For the target controller: replace `@UseGuards(RolesGuard)` with `@UseGuards(PermissionsGuard)`; replace each method's `@Roles(...)` with the corresponding `@RequirePermissions(...)` per the mapping table.
  3. Run that controller's existing integration tests (if any) and add new integration coverage if none exists for its authorization path specifically.
  4. Confirm every role in that controller's original `@Roles(...)` list can still call the endpoint, and no role outside that list can.
  5. Recommended order (lowest-risk-first, per the Technical Specification's own suggestion): `integration` → `parts` → `vehicles` — each fully verified before the next begins.
- **Acceptance criteria**: For each controller, independently: every previously-valid caller still succeeds; every previously-rejected caller is still rejected; the mapping table's exact role-grant equivalence is confirmed, not assumed.
- **Regression tests**: Full existing repository unit + integration suite after each controller's migration (not only at the end of all three); explicit per-controller sign-off before the next controller begins.
- **Rollback criteria**: Any role gaining or losing access relative to the pre-migration `@Roles(...)` baseline for that controller; any regression in that controller's existing tests; any finding that a shared permission constant was reused across controllers in a way that couples their access unintentionally.
- **Evidence required**: The completed mapping table (already provided in the Technical Specification) annotated per controller as migrated and verified; regression suite output per controller.
- **Completion definition**: All three controllers use `PermissionsGuard`/`@RequirePermissions(...)` exclusively; `RolesGuard` has zero remaining real controller usages (though the file itself may still exist, per the "files explicitly prohibited" note above); full regression suite passes.

### Phase 4 — Regression Testing

- **Phase Identifier**: PEP-4
- **Objective**: Consolidate and formally record regression evidence across all of Phases 1–3, and close the testing-gap items PRTS-004 identifies (no dedicated unit test previously existed for `jwt-auth-context.guard.ts` or `roles.guard.ts`).
- **Components affected**: `src/identity/`, `src/common/permissions/`, `src/common/rbac/` (test files only).
- **Files expected to change**: `src/identity/jwt-auth-context.guard.spec.ts` (created in Phase 1 — reviewed for completeness here); `src/common/rbac/roles.guard.spec.ts` (new, if `RolesGuard` is retained rather than removed after Phase 3); any additional integration-spec files for `integration`/`parts`/`vehicles` added during Phase 3.
- **Files explicitly prohibited**: any non-test file; any file outside the three directories named above.
- **Implementation tasks**:
  1. Confirm `jwt-auth-context.guard.spec.ts` (Phase 1) covers all four scenarios from the Technical Specification.
  2. If `RolesGuard` remains referenced anywhere (e.g., retained as dead code pending a future removal decision), add `roles.guard.spec.ts` covering its existing, unchanged denial/allow behavior — this is a coverage addition, not a behavior change.
  3. Run the full repository unit + integration test suite to completion.
  4. Record the full suite's pass/fail state as the formal regression-evidence artifact for this remediation.
- **Acceptance criteria**: 100% of the pre-remediation passing test suite still passes, with the one named, intentional PRTS-001 exception; the two previously-missing spec files now exist and pass.
- **Regression tests**: The full suite itself is the regression test at this phase — no further scope.
- **Rollback criteria**: Any suite failure not attributable to the one intentional, already-documented exception.
- **Evidence required**: Full suite output, recorded and attached as this remediation's regression-evidence artifact (feeds directly into the Implementation Authorization's Post-Implementation Requirement #4, "Regression Evidence").
- **Completion definition**: Full suite passes; both previously-missing guard spec files exist and pass; regression evidence recorded.

### Phase 5 — Security Verification Preparation

- **Phase Identifier**: PEP-5
- **Objective**: Assemble the complete evidence package an independent reviewer needs to perform PRTS-005 (Independent Security Verification) — this phase prepares for that review; it does not perform it, since the Implementation Authorization requires the reviewer be distinct from whoever implemented Phases 1–4.
- **Components affected**: None — this phase produces a review package, not code.
- **Files expected to change**: None.
- **Files explicitly prohibited**: Any source file — this phase is documentation/evidence-assembly only.
- **Implementation tasks**:
  1. Compile a diff summary of every file changed across Phases 1–4, confirmed against the scope in §3–§4 below.
  2. Compile the full regression-evidence artifact from Phase 4.
  3. Compile a direct-code-reinspection checklist mirroring the Technical Specification's own "Security verification" item in its Verification Plan: confirm no Safety-Relevant permission (should one exist by the time of review) can be satisfied via the header-stand-in path; confirm all three migrated controllers behave identically to their pre-migration selves for every legitimate caller.
  4. Identify the reviewer: the named Security Reviewer (Governance Closure Program GATE-OWN-003), if assigned by this point; otherwise, an equally independent reviewer with no authorship stake in Phases 1–4, per the Platform Remediation Authorization's own fallback provision.
  5. Hand off the assembled package to that reviewer — the review itself, and its recorded result, is PRTS-005, performed outside this plan's own scope.
- **Acceptance criteria**: The evidence package is complete (diff summary, regression evidence, reinspection checklist, named reviewer) and handed off.
- **Regression tests**: None additional — this phase reuses Phase 4's evidence, it does not generate new test runs.
- **Rollback criteria**: Not applicable — this phase does not change any code; an incomplete package simply means handoff is not yet ready, not a rollback trigger.
- **Evidence required**: The assembled package itself.
- **Completion definition**: The package is handed to an independent reviewer distinct from the Phases 1–4 implementer; PRTS-005's actual review and recorded result follow as a separate, subsequent action, not part of this plan's own completion.

---

## 4. Dependency Graph

```
PEP-1 (Identity Layer)
   │  foundational; no dependency
   ▼
PEP-2 (Authorization Layer)
   │  additive; benefits from PEP-1 but not strictly blocked by it
   │  (may start once PEP-1's regression pass is recorded, per the
   │   Implementation Authorization's mandatory sequencing condition)
   ▼
PEP-3 (Permission Migration)
   │  requires PEP-1 + PEP-2 complete and verified
   │  internally sequential: integration → parts → vehicles
   │  (each controller fully verified before the next begins —
   │   no parallel work permitted within this phase)
   ▼
PEP-4 (Regression Testing)
   │  requires PEP-1, PEP-2, PEP-3 all complete
   │  consolidates evidence; may begin incrementally after each
   │  individual controller in PEP-3, but is not "complete" until
   │  all of PEP-1–3 are done
   ▼
PEP-5 (Security Verification Preparation)
      requires PEP-4's regression evidence finalized
      terminal phase of this plan — hands off to an independent
      reviewer for PRTS-005, outside this plan's scope
```

**Parallel work**: None is authorized between phases. Within Phase 3, the three controllers are migrated strictly sequentially, never in parallel, per the Implementation Authorization's binding condition (mitigating the "High" risk the Technical Specification assigns to combined controller changes).

**Blocking work**: Each phase blocks the next; no phase may begin before its predecessor's Completion Definition is met and recorded.

**Critical path**: PEP-1 → PEP-2 → PEP-3 (integration → parts → vehicles, sequentially) → PEP-4 → PEP-5. The critical path's longest single segment is PEP-3, both because it is internally sequential across three controllers and because it carries the Technical Specification's own "High" risk rating.

---

## 5. Deliverable Matrix

| Phase | Deliverables | Evidence | Reviewer | Approval required |
|---|---|---|---|---|
| PEP-1 | Corrected `jwt-auth-context.guard.ts`; new `jwt-auth-context.guard.spec.ts` | 4-scenario unit test output; full regression pass; 5 named open-route confirmations | Implementer self-verifies against acceptance criteria; no external approval gate within this phase | No (internal phase gate only) |
| PEP-2 | New opt-in decorator/metadata check in `permissions.guard.ts`; extended `permissions.guard.spec.ts` | New test output; confirmation no existing handler uses the new metadata | Implementer self-verifies | No (internal phase gate only) |
| PEP-3 | Migrated `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`; 7 new permission constants + grants | Per-controller mapping-table equivalence confirmation; per-controller regression pass | Implementer self-verifies each controller before the next begins | No (internal phase gate only, but strict sequencing is itself a binding Implementation Authorization condition) |
| PEP-4 | `roles.guard.spec.ts` (if applicable); consolidated full-suite regression evidence | Full suite pass record | Implementer compiles; evidence feeds Phase 5 | No (internal phase gate only) |
| PEP-5 | Assembled security-verification evidence package (diff summary, regression evidence, reinspection checklist, named reviewer) | The package itself | **The named Security Reviewer (GATE-OWN-003) or an equally independent reviewer** — distinct from the Phases 1–4 implementer | **Yes** — PRTS-005's actual sign-off is required before this remediation may be reported complete to the Platform Governance Board, per the Platform Remediation Authorization's own §7 |

---

## 6. Rollback Strategy

A rollback checkpoint exists after every phase:

| Checkpoint | Rollback trigger | Rollback scope | Validation after rollback |
|---|---|---|---|
| After PEP-1 | Any of the 5 named open-route groups newly rejects a request; any unattributable regression-suite failure | Revert `jwt-auth-context.guard.ts` to its pre-Phase-1 catch-and-continue behavior; delete or retain `jwt-auth-context.guard.spec.ts` as appropriate to the reverted behavior | Full regression suite passes identically to the pre-Phase-1 baseline |
| After PEP-2 | Any existing `PermissionsGuard`-gated endpoint's behavior changes; any pre-existing `permissions.guard.spec.ts` test fails | Remove the new opt-in metadata check and decorator; no other file is affected, since no existing handler adopted it | Full regression suite passes identically to the pre-Phase-2 baseline |
| After PEP-3 (per controller) | A role gains or loses access relative to that controller's pre-migration `@Roles(...)` baseline; a regression is found in that controller's tests | Revert that one controller's `@UseGuards`/decorators to `RolesGuard`/`@Roles(...)`; the other two controllers and the shared permission constants are unaffected, since each controller is migrated and committed independently | That controller's full test suite passes identically to its pre-migration baseline; the other two controllers remain unaffected and continue to pass |
| After PEP-4 | Any regression-evidence gap discovered (e.g., a scenario the consolidated evidence does not actually cover) | Return to the phase (PEP-1, PEP-2, or the specific PEP-3 controller) whose evidence is incomplete; re-verify; re-consolidate | Full suite re-run; evidence re-recorded |
| After PEP-5 | The independent reviewer finds the evidence package incomplete, or finds a scope violation during PRTS-005 itself | Return to whichever phase the finding traces to; remediate; re-assemble the evidence package; re-submit for review | PRTS-005 re-performed against the corrected package |

**General rollback principle** (restated from the Technical Specification): every rollback in this plan is designed to be independently, cleanly executed at the granularity of a single phase or, within Phase 3, a single controller — never an all-or-nothing rollback of the entire remediation.

---

## 7. Verification Strategy

| Phase | Unit tests | Integration tests | Security verification | Regression verification | Architecture verification |
|---|---|---|---|---|---|
| PEP-1 | 4 scenarios on `jwt-auth-context.guard.ts` | N/A (guard-level, not endpoint-specific) | Confirms rejection is conditional on handler metadata, not unconditional | Full suite + 5 named open-route confirmations | Confirms no file outside `src/identity/` changed |
| PEP-2 | New opt-in-mechanism scenarios on `permissions.guard.ts` | N/A | Confirms the new mechanism correctly distinguishes verified vs. header-stand-in actors | Full suite; confirms zero existing handler affected | Confirms no file outside `src/common/permissions/` changed |
| PEP-3 | Per-controller mapping-equivalence checks | Per-controller integration suites (new or existing) | Confirms no role gained or lost access; confirms `RolesGuard`'s "verified JWT never consulted" gap is closed for all three controllers | Full suite after each controller | Confirms only the three named controllers plus `permission.ts`/`role-permissions.ts` changed |
| PEP-4 | New `roles.guard.spec.ts` (if applicable) | Consolidated from PEP-1–3 | N/A (consolidation phase) | Full suite, formally recorded as the remediation's regression-evidence artifact | Confirms only test files changed in this phase |
| PEP-5 | N/A | N/A | **PRTS-005 itself** — performed by the independent reviewer, outside this plan's own execution | Reuses PEP-4's evidence | Confirms the dependency direction (`identity` → `common/permissions`, per the Technical Specification's corrected §3) is unchanged and no DGX-3.0-named file was touched across the entire remediation |

---

## 8. Implementation Constraints

Restated, mandatory, non-negotiable across every phase of this plan:

- No schema changes, no new migrations.
- No new API endpoints or DTOs.
- No DGX 3.0 feature of any kind (`RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome`, evidence citation, or any DGX-3.0-named entity/module).
- No Digital Twin modification (`digital-twin.service.ts`, `twin-intelligence-math.ts`).
- No Vehicle Lifecycle changes (`src/vehicle-lifecycle/` generally, including `repeat-repair-math.ts`/`repeat-repair.service.ts`).
- No Recommendation Engine, no Risk Engine, no prediction/ML/calibration work.
- No Certification implementation — a DGX 3.0 Certification Standard remains separately gated and unauthorized.
- Every changed file must fall within `src/identity/`, `src/common/permissions/`, `src/common/rbac/`, or the three named controllers (`integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`) — confirmed per phase via the Architecture verification row in §7.

---

## 9. Out of Scope

Explicitly, no phase of this plan may perform:

- Any work on `src/vehicle-lifecycle/`, `src/twin-intelligence/`, or any file `DGX3-ADR-0001` assigns to Operational Core's permanent ownership.
- Any DGX 3.0 business capability of any kind.
- Removal of `RolesGuard`/`roles.decorator.ts` themselves (they may become unused after Phase 3, but deleting them is a separate, future, out-of-scope decision).
- Tightening the currently-open `GET /parts`, `GET /parts/:id`, `GET /vehicles`, `GET /vehicles/vin/:vin`, `GET /vehicles/:id` endpoints — remains a deferred, future scope decision per the Technical Specification's own §5.
- Full removal of the legacy `x-user-role` header-stand-in path for any endpoint that intentionally still supports it.
- Branch/warehouse scoping enforcement (`docs/architecture/rbac-permissions.md`'s own documented, separately-scoped future effort).
- Convening or predetermining the outcome of Engineering Authorization Review #2.
- Any change to DGX 3.0's capability maturity (remains **Specified**) or certification status (remains **Not Started**).
- Modifying any ADR, the DGX 3.0 specification, the Technical Specification, or any prior governance decision.

---

## 10. What This Plan Does Not Authorize

This plan does not itself authorize implementation to begin — that authorization was already granted (`IMPLEMENTATION_AUTHORIZED_WITH_CONDITIONS`) and this plan operates strictly within its terms. This plan does not modify source code, schemas, migrations, or APIs; does not expand the approved scope; does not change any governance decision; and does not perform PRTS-005 — that remains a separate action by an independent reviewer, outside this plan's own completion.

---

*End of DGX 3.0 Platform Remediation Engineering Execution Plan #1.*
