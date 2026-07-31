# PEP-4 Readiness and Scope Lock

## Status: PLANNING DOCUMENT — AUTHORIZES NO IMPLEMENTATION

---

## Document Control

| Field | Value |
|---|---|
| Document | PEP-4 Readiness and Scope Lock |
| Issuing authority | AIOS Program Architecture Review Board (PARB) / AIOS Release Governance Office |
| Status | **PLANNING ONLY — NO ENGINEERING WORK IS AUTHORIZED BY THIS DOCUMENT** |
| Effective date | 2026-07-31 |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md` (PRTS-004); `docs/engineering/DGX3_PLATFORM_REMEDIATION_ENGINEERING_EXECUTION_PLAN_1.md` (Phase 4 definition, §3); `docs/engineering/verification/PEP3_INDEPENDENT_VERIFICATION.md`; direct, fresh inspection of current repository state |

**This document plans PEP-4 readiness only. It implements nothing, modifies no production code, and authorizes no engineering action. PEP-4 implementation requires a separate, future authorization after this document has been independently reviewed.**

---

## 1. Current Repository Baseline

| Metric | Value (fresh, as of PEP-3 closure) |
|---|---|
| Test suites | 108/108 passing |
| Tests | 820/820 passing |
| TypeScript compilation (`tsc --noEmit`) | 0 errors |
| ESLint (`{src,test}/**/*.ts`) | 0 errors, 0 warnings |
| Working tree | Clean |
| GitHub Actions | 3 documentation workflows only (`docs-mermaid-check.yml`, `docs-lint.yml`, `docs-link-check.yml`); no dedicated backend CI workflow exists in this repository |
| Latest milestone tag | `pep3-complete` |

---

## 2. Completed PEPs

| Phase | Status | Scope |
|---|---|---|
| PEP-1 (Identity Layer) | **COMPLETE, VERIFIED, CLOSED** | `jwt-auth-context.guard.ts` — stop discarding verification failures on handlers that already require a permission/role |
| PEP-2 (Authorization Layer) | **COMPLETE, VERIFIED, CLOSED** | `permissions.guard.ts` — additive, opt-in `@RequireVerifiedActor()` mechanism |
| PEP-3 (Permission Migration) | **COMPLETE, VERIFIED, CLOSED, SUCCESSFUL** | `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts` migrated from `RolesGuard`/`@Roles` to `PermissionsGuard`/`@RequirePermissions`; 7 new permission constants added |

---

## 3. Lessons Learned from PEP-3

- **Strict per-controller sequencing worked as designed.** Each of the three controllers was migrated, tested, and regression-verified independently before the next began, exactly as the Technical Specification's risk analysis (rating PRTS-003 "High") anticipated. No combined-change regression occurred.
- **The approved mapping table's `OWNER` broadening was a real, intentional, non-obvious exception.** `OWNER` gained access on 8 endpoints across the three controllers because it already held every permission platform-wide via the pre-existing `ROLE_PERMISSIONS[Role.OWNER] = [...PERMISSIONS]` spread, but `RolesGuard` never consulted that map. This was correctly identified, documented, and tested in all three migrations — a reminder that "no role gains access" claims must be checked against the *actual* pre-existing permission map, not just the literal `@Roles(...)` list, since the two can diverge for superuser-equivalent roles.
- **Testing the real decorator metadata (not a mocked guard) caught what a purely logic-level test would miss.** Every migration's authorization spec used a real, unmocked `Reflector` and `PermissionsGuard` reading the actual controller class's metadata — this is what made it possible to prove, not merely assert, that `RolesGuard`/`@Roles` left zero residue in production code.
- **A new, real fact for PEP-4 to plan around**: `RolesGuard` and `@Roles(...)` now have **zero real callers anywhere in the codebase** (confirmed fresh via repository-wide `grep` immediately before writing this document) — a change from PEP-3's own start-of-phase state, where `RolesGuard` was still actively used by the three controllers. `RolesGuard`'s own file and `roles.decorator.ts` remain, per the explicit, repeated, deliberate out-of-scope decision in every PEP-3 work package ("removal is a separate, future, out-of-scope decision") — but the class is now orphaned, not merely legacy-but-used.
- **`RolesGuard` still has no dedicated unit test file** (`roles.guard.spec.ts` does not exist — confirmed fresh, matching the Technical Specification's original finding, unchanged across PEP-1 through PEP-3). This is the one concrete, named testing-gap item PRTS-004/Phase 4 already identifies.

---

## 4. Repository Health

| Check | Result |
|---|---|
| Full regression suite | 108/108 suites, 820/820 tests pass |
| Type safety | 0 `tsc` errors |
| Lint | 0 `eslint` errors/warnings |
| Schema/migration drift | None — `prisma/schema.prisma` untouched since the initial commit across this entire program |
| Documentation CI | All three workflows (Mermaid validation, lint, link check) last confirmed passing live on GitHub Actions |
| Orphaned code | `RolesGuard`, `roles.decorator.ts` — retained by explicit decision, zero real callers, zero dedicated tests |

---

## 5. Risks

| Risk | Likelihood | Impact | Mitigation this document recommends |
|---|---|---|---|
| `RolesGuard`'s orphaned, untested state persists indefinitely if PEP-4 is delayed | Low-Medium | Low (no runtime exposure — it is not called) | PEP-4 should add `roles.guard.spec.ts` per its own already-approved scope (§6), closing the gap regardless of whether/when removal is later decided |
| A future engineer misreads "retained, not removed" as license to re-introduce `RolesGuard` on a new controller | Low | Medium | PEP-4's regression evidence, once recorded, should explicitly note the zero-callers finding so it is visible to future readers, not just this planning document |
| Regression evidence across PEP-1–3 has never been formally consolidated into one artifact | Medium | Low (each phase's own verification already exists individually) | This is PEP-4's stated purpose (§6) — consolidate, don't re-verify from scratch |
| No dedicated CI workflow exists for backend tests, only local verification | Medium | Medium (a future contributor could break the suite without a CI signal) | Out of PEP-4's own scope per the Technical Specification (PRTS-004 is test-file-only); noted here as a standing, separate risk for the Program/Governance Board to consider independently, not something PEP-4 should absorb |

---

## 6. Preconditions for PEP-4

Per the Engineering Execution Plan's own dependency graph (§4) and Technical Specification (§10):

| Precondition | Status |
|---|---|
| PEP-1 complete and verified | **Satisfied** |
| PEP-2 complete and verified | **Satisfied** |
| PEP-3 complete and verified (all three controllers migrated, per-controller regression passed) | **Satisfied** |
| Full regression baseline recorded and green | **Satisfied** — 108/108 suites, 820/820 tests |

All preconditions the approved plan sets for PEP-4 to begin are met.

---

## 7. Scope Boundaries

Per the already-approved Technical Specification (PRTS-004) and Engineering Execution Plan (Phase 4) — restated here, not redefined:

- **Objective**: consolidate and formally record regression evidence across PEP-1–3, and close the one remaining named testing-gap item: `RolesGuard` has no dedicated unit test.
- **Components affected**: `src/identity/`, `src/common/permissions/`, `src/common/rbac/` — **test files only**.
- **Concretely, PEP-4's expected deliverable is**:
  1. Confirm `jwt-auth-context.guard.spec.ts` (already exists, from PEP-1) still covers all four required scenarios — already independently re-confirmed passing in this session's PEP-3 verification; PEP-4 would formally re-state this as consolidated evidence, not re-implement it.
  2. Add `roles.guard.spec.ts` — the one genuinely new test file PEP-4 would create — covering `RolesGuard`'s existing, unchanged denial/allow behavior. This is a coverage addition to an already-orphaned class, not a behavior change.
  3. Run the full repository suite to completion and record the pass/fail state as PEP-4's formal regression-evidence artifact.
- **No non-test file may change.**

---

## 8. Explicit Out-of-Scope Items

Restated, unchanged from the Technical Specification and Execution Plan — PEP-4 does not revisit or expand any of these:

- Any DGX 3.0 business entity, business logic, or feature of any kind.
- Any Prisma schema modification or new migration.
- Any new API endpoint or DTO.
- Removal of `RolesGuard` or `roles.decorator.ts` — remains a separate, future, out-of-scope decision, restated again here since it is the single most likely scope-creep temptation given the zero-callers finding in §3.
- Any change to `integration.controller.ts`, `parts.controller.ts`, or `vehicles.controller.ts` — their PEP-3 migrations are closed and frozen.
- Branch/warehouse scoping enforcement.
- Tightening the currently-open `GET` endpoints on `parts`/`vehicles`.
- PEP-5 (Security Verification Preparation) and PRTS-005 (the actual independent security review) — both remain future, separately-gated phases, not part of PEP-4.
- Setting up a dedicated backend CI workflow — a real, separate, standing gap (§5) but not named in PEP-4's own approved scope; raising it as a candidate for a future, separately-authorized task is appropriate, silently expanding PEP-4 to include it is not.

---

## 9. Success Criteria

PEP-4 would be complete only when **all** of the following hold (restated from the Execution Plan's own Phase 4 acceptance criteria):

- 100% of the pre-PEP-4 passing test suite still passes, with the one PRTS-001 exception already accounted for since PEP-1.
- `roles.guard.spec.ts` exists and passes, covering `RolesGuard`'s existing, unchanged behavior.
- `jwt-auth-context.guard.spec.ts` is confirmed (not re-implemented) to already cover all four required scenarios.
- Full suite output is recorded as a single, consolidated regression-evidence artifact spanning PEP-1 through PEP-4.
- Repository diff is confined entirely to new/modified test files under `src/identity/`, `src/common/permissions/`, `src/common/rbac/`.

---

## 10. Go / No-Go Recommendation

**GO.**

All preconditions are satisfied, the scope is already fully defined by the approved Technical Specification and Execution Plan (no new scope decision is required), the one concrete deliverable (`roles.guard.spec.ts`) is narrowly bounded and low-risk (test-only, targeting an already-orphaned class), and the repository baseline is clean. No blocking issue was found.

**This recommendation authorizes nothing by itself.** PEP-4 implementation requires a separate, explicit authorization, to be issued only after this readiness document has been independently reviewed — consistent with the same governance discipline PEP-3's own readiness/scope-lock document established.

---

*End of PEP-4 Readiness and Scope Lock. Planning document only — no implementation performed.*
