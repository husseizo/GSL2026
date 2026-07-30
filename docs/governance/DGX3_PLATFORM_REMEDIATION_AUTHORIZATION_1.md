# DGX 3.0 Platform Remediation Authorization #1

### Resolving the Governance Deadlock Between "Security Must Be Fixed Before DGX Engineering" and "Fixing Security Is Itself Engineering"

---

## Document Control

| Field | Value |
|---|---|
| Document | DGX 3.0 Platform Remediation Authorization #1 (PRA-1) |
| Issuing authority | AIOS Platform Governance Board (PGB) |
| Status | **PLATFORM REMEDIATION AUTHORIZED — DGX ENGINEERING REMAINS NOT AUTHORIZED** |
| Effective date | 2026-07-30 |
| Authoritative inputs | `docs/capabilities/DGX_3_PREDICTIVE_MAINTENANCE_SPECIFICATION_V1.md` §26, §29, §50; `docs/reviews/DGX3_SPECIFICATION_FORMAL_REVIEW_1.md`; `docs/adr/DGX3-ADR-0001_EXISTING_OPERATIONAL_CORE_OWNERSHIP.md`; `docs/governance/DGX3_GOVERNANCE_CLOSURE_PROGRAM_1.md` (GATE-SEC-001, GATE-SEC-002); direct re-inspection of `jwt-auth-context.guard.ts`, `permissions.guard.ts`, `roles.guard.ts` |

**This document authorizes narrowly scoped platform prerequisite remediation only. It does not authorize DGX 3.0 feature engineering, does not authorize Phase A, does not change DGX 3.0's capability maturity (remains Specified), and does not change its certification status (remains Not Started). No source code, schema, migration, or API is created or changed by this document itself — it is an authorization for a future, separate, narrowly bounded engineering action to occur, to be independently verified before it counts toward closing any governance gate.**

---

## 1. Executive Summary

The DGX 3.0 Governance Closure Program identified a genuine circular dependency: specification §26 requires the mixed, real authorization model (a non-rejecting global JWT guard; `PermissionsGuard`'s unverified `x-user-role` header fallback; `RolesGuard`'s continued active use in three real controllers) to be normalized *before* any DGX 3.0 engineering begins — yet performing that normalization is itself a form of engineering. Left unresolved, this deadlocks Engineering Authorization Review #2 indefinitely, since no governance-only action can close GATE-SEC-002 by itself.

This authorization breaks that deadlock by defining a distinct, narrower category of work — **Platform Remediation** — that is authorized to proceed now, strictly bounded to the identity/authorization layer, with every DGX 3.0 business feature explicitly and separately prohibited. Platform Remediation is not DGX 3.0 engineering: it touches no vehicle, maintenance, or risk-scoring logic, creates no DGX-3.0-named module, and does not advance DGX 3.0 toward Phase A in any way. It exists solely to make the platform's own authorization layer match what specification §26 already requires of it — a requirement that exists independently of DGX 3.0 and would be equally true for any other capability relying on the same guards.

**Decision: Platform Remediation Authorization is APPROVED**, subject to the scope, exclusions, and success/exit criteria defined below.

---

## 2. Circular Dependency Analysis

| Element | Finding |
|---|---|
| Requirement creating the deadlock | Specification §26: "before any DGX 3.0 engineering work begins (§50), the mixed authorization model described above must be reviewed and, for any endpoint DGX 3.0 would rely on, normalized to a single, verified-actor path." |
| Governance gate this requirement produces | `docs/governance/DGX3_GOVERNANCE_CLOSURE_PROGRAM_1.md`, GATE-SEC-001 (remediation design & authorization) and GATE-SEC-002 (remediation completion evidence) — both marked mandatory for Engineering Authorization Review #2. |
| Why it is circular | GATE-SEC-002 cannot close without the underlying guard code changing. Changing guard code is engineering. This program's own prior finding (Governance Closure Program §11, Critical Path) named this exact tension: "the true critical-path bottleneck is GATE-SEC-002, since it depends on a separately authorized engineering action... sitting outside this governance program's own authority to perform or schedule." |
| Why it is not a reason to lower the security bar | The requirement itself is sound and should not be waived — an unverified `x-user-role` header fallback is a real, confirmed gap (re-verified fresh against live code in this review: `JwtAuthContextGuard.canActivate` still unconditionally `return true`; `RolesGuard` still actively imported in `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`). The correct resolution is not to relax the gate, but to recognize that the work needed to satisfy it is not itself DGX 3.0 feature engineering, and can therefore be authorized through a distinct, narrower channel without touching the DGX-engineering prohibition at all. |
| Resolution mechanism | A **Platform Remediation Authorization** — a category of work distinct from, and prohibited from expanding into, DGX 3.0 feature engineering — authorized directly by the Platform Governance Board, independent of Engineering Authorization Review #2 (which remains reserved for DGX 3.0 feature work specifically). |

---

## 3. Platform vs. DGX Engineering Boundary

**Platform Remediation** is work that:
- Operates exclusively inside the identity/authorization layer (`src/identity/`, `src/common/permissions/`, `src/common/rbac/`, and their existing unit/integration tests).
- Fixes a gap that exists independently of DGX 3.0 — the non-rejecting JWT guard and the header-trust fallback would be exactly as real and exactly as wrong even if DGX 3.0 did not exist.
- Creates no new business entity, no new business logic, and no new capability-facing API.
- Does not advance DGX 3.0 toward Phase A, does not touch any file under `src/vehicle-lifecycle/`, `src/twin-intelligence/`, or any future DGX-3.0-named module, and does not change what any existing endpoint *does* — only how its caller's identity is verified.

**DGX Feature Engineering** is work that:
- Creates or modifies any DGX-3.0-specific business capability: risk scoring, recommendation generation, evidence citation, digital-twin computation, repeat-repair detection, or any new persisted entity named in the specification (`RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome`).
- Modifies `src/vehicle-lifecycle/` or `src/twin-intelligence/` in any way — forbidden regardless of PRA, since `DGX3-ADR-0001` established these remain Operational Core's permanent, unmodified-by-DGX-3.0 domain.
- Requires Engineering Authorization Review #2 to have already returned `ENGINEERING_AUTHORIZED` or `ENGINEERING_AUTHORIZED_WITH_CONDITIONS`.

The distinguishing test this authorization applies to any candidate activity: **"Would this work be exactly as necessary and exactly the same in scope if DGX 3.0 Predictive Maintenance were cancelled tomorrow?"** If yes, it is Platform Remediation. If the work only makes sense because DGX 3.0 exists, it is DGX Feature Engineering and remains prohibited under this authorization.

---

## 4. Scope Analysis — Candidate Activities

| Activity | Classification | Justification |
|---|---|---|
| JWT normalization (making the global JWT guard reject invalid/missing credentials on any endpoint requiring one, rather than silently proceeding) | **Platform Remediation** | Fixes a real, pre-existing, DGX-independent gap; passes the cancellation test — needed regardless of DGX 3.0. |
| Permissions normalization (removing/replacing `PermissionsGuard`'s unverified `x-user-role` header fallback) | **Platform Remediation** | Same reasoning — the fallback is a platform-wide authorization weakness, not a DGX-specific concern. |
| Identity propagation (ensuring a verified actor is consistently resolved and available wherever a guard needs one) | **Platform Remediation** | Supporting infrastructure for the two items above; no business logic involved. |
| Audit attribution (ensuring the identity/authorization layer correctly propagates a real, verified actor id to whatever downstream code writes an `AuditLog` entry) | **Platform Remediation, narrowly** | Bounded to propagation only. Does **not** include any change to the `AuditLog` Prisma model itself (a schema change, explicitly prohibited under this authorization) and does **not** include building DGX 3.0's own new evidence-citation or audit-linkage entities (specification §29's corrected text already assigns that as DGX 3.0's own future, separate engineering responsibility). |
| Security verification (independent confirmation the remediation closes the gap) | **Platform Remediation** | A verification activity, not a feature — required by this authorization's own Success Criteria (§7). |
| Repository hardening, bounded to the identity/authorization layer (e.g., removing now-dead fallback paths, consolidating duplicate role-checking logic) | **Platform Remediation, narrowly** | Only within `src/identity/`, `src/common/permissions/`, `src/common/rbac/`. Hardening anywhere else in the repository is out of this authorization's scope. |
| Module restructuring | **Conditional — split** | Restructuring *within* the identity/authorization modules named above (e.g., consolidating `RolesGuard`'s remaining real usages onto the normalized `PermissionsGuard` path) is Platform Remediation. Creating or restructuring any DGX-3.0-specific module (e.g., a future `predictive-maintenance/` module) is DGX Feature Engineering and remains prohibited. |
| Risk engine | **DGX Feature Engineering — prohibited** | Exists only because DGX 3.0 exists; fails the cancellation test. |
| Recommendation engine | **DGX Feature Engineering — prohibited** | Same reasoning. |
| Evidence engine | **DGX Feature Engineering — prohibited** | Same reasoning. |
| Maintenance recommendation | **DGX Feature Engineering — prohibited** | Same reasoning. |
| Digital Twin enhancements | **Out of scope entirely — prohibited under both PRA and `DGX3-ADR-0001`** | `digital-twin.service.ts` is Operational Core's permanent, existing property; `DGX3-ADR-0001`'s Forbidden Coupling already bars DGX 3.0 from modifying it, and this authorization does not touch it either, since it is not part of the identity/authorization layer. |
| Risk scoring (`twin-intelligence-math.ts`) | **Out of scope entirely — prohibited under both PRA and `DGX3-ADR-0001`** | Same reasoning — existing Operational Core logic, untouched by this or any DGX-3.0-labeled authorization. |
| Repeat repair logic (`repeat-repair-math.ts`, `repeat-repair.service.ts`) | **Out of scope entirely — prohibited under both PRA and `DGX3-ADR-0001`** | Same reasoning. |
| Vehicle lifecycle (`src/vehicle-lifecycle/` generally) | **Out of scope entirely — prohibited under both PRA and `DGX3-ADR-0001`** | Same reasoning — this is precisely the boundary `DGX3-ADR-0001` already drew; this authorization does not reopen it. |

---

## 5. Authorized Platform Remediation Scope

The following, and only the following, is authorized under PRA-1:

1. **Guard-level JWT enforcement correction**: modify the identity-verification layer so that any endpoint requiring a verified actor genuinely rejects a request lacking one, rather than silently proceeding with no verified actor attached.
2. **Removal or replacement of the unauthenticated `x-user-role` header-trust fallback** in `PermissionsGuard`'s actor resolution, and in `RolesGuard`, such that a bare header can no longer substitute for a cryptographically verified actor on any endpoint that requires one.
3. **Consolidation of `RolesGuard`'s three remaining real usages** (`integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`) onto the single, normalized authorization path — exact technical mechanism (migrate each controller to `PermissionsGuard`, or an equivalent unification) is left to the remediation's own technical design, not decided by this authorization.
4. **Existing test-suite updates** strictly necessary to reflect the corrected guard behavior (unit and integration tests for the files named in item 1–3 only).
5. **Independent security verification** of items 1–4, per §7 below.

**Explicitly excluded even within this scope**: any Prisma schema change, any new migration, any new API endpoint, and any new permission string beyond what is strictly necessary to preserve existing endpoint behavior during the `RolesGuard`-to-`PermissionsGuard` consolidation.

---

## 6. Forbidden Activities

The following remain prohibited under this authorization, with no exception:

- Risk Assessment (entity, service, or logic)
- Maintenance Recommendation (entity, service, or logic)
- Outcome / Feedback / Override (entities, services, or logic)
- Evidence Citation records or mechanisms
- Any DGX 3.0-facing Recommendation API or new `maintenance-risk.*` permission
- Override or acknowledgment workflow implementation
- Any future ML / model-registry extension work
- Any prediction model, calibration work, or scoring formula change
- Certification implementation of any kind (a DGX 3.0 Certification Standard remains separately gated and unauthorized)
- Any change to `src/vehicle-lifecycle/`, `src/twin-intelligence/`, or any of their Prisma models
- Any new DGX-3.0-named module or directory
- Any change to DGX 3.0's capability maturity (**Specified**), certification status (**Not Started**), or any specification/ADR text
- Any work that would not equally be necessary if DGX 3.0 did not exist (the cancellation test, §3)

Any Platform Remediation work found to have touched any item on this list must be treated as a violation of this authorization, halted, and reported to the Platform Governance Board before proceeding.

---

## 7. Success Criteria

Platform Remediation is successful only when **all** of the following are objectively evidenced:

1. **Security verification**: direct, reproducible confirmation — matching the method already used throughout this governance program (direct code read, not inference) — that no endpoint any DGX 3.0 future permission would rely on can be satisfied via an unverified header-fallback path in either `PermissionsGuard` or `RolesGuard`, and that the global JWT guard now genuinely rejects requests lacking a verified actor where one is required.
2. **Architecture verification**: a diff review confirming every changed file falls within `src/identity/`, `src/common/permissions/`, `src/common/rbac/`, or their direct tests — no file under `src/vehicle-lifecycle/`, `src/twin-intelligence/`, or any DGX-3.0-named path was touched.
3. **Repository verification**: confirmation that no new Prisma model, no migration, no new top-level module, and no DGX-3.0-named directory was created during remediation.
4. **Independent review**: sign-off from a reviewer who did not author the remediation code — the named Security Reviewer (Governance Closure Program GATE-OWN-003) once assigned, or, if not yet assigned at the time remediation completes, an equally independent reviewer with no authorship stake in the change, explicitly recorded as a temporary substitute pending GATE-OWN-003's closure.
5. **Regression validation**: the full existing unit and integration test suite passes with zero regressions, with specific, named confirmation that `integration.controller.ts`, `parts.controller.ts`, and `vehicles.controller.ts` — the three real controllers currently depending on `RolesGuard` — continue to function correctly for every real caller after consolidation.

Platform Remediation is not "done" merely because code was written — it is done only when all five criteria above are independently confirmed and recorded.

---

## 8. Exit Criteria — When This Authorization Expires

This Platform Remediation Authorization automatically expires, and must be re-issued or re-confirmed by the Platform Governance Board before any further platform-layer work proceeds under its name, upon the **first** of the following:

1. **Completion**: all five Success Criteria in §7 are met and recorded — at that point this authorization has served its purpose and Governance Gate Revalidation (§9) begins.
2. **Scope violation**: any work is found to have crossed into a Forbidden Activity (§6) — the authorization is void from that point until the Platform Governance Board re-reviews.
3. **Convening of Engineering Authorization Review #2**: once EAR#2 is convened, this authorization's narrow purpose (unblocking the circular dependency that prevented EAR#2 from being convened at all) is fulfilled, regardless of EAR#2's outcome.
4. **Staleness**: if remediation work has not commenced by the next Quarterly Roadmap Review (the Enterprise Roadmap's own, already-established review cadence — no new cadence is invented here), the Architecture Board must reconfirm this authorization is still current before work begins, rather than treating it as a standing, open-ended grant.

---

## 9. Governance Sequence (Post-Remediation Flow)

```
Platform Remediation Authorization (this document)
        ↓
Platform Security Remediation
   (separate, narrowly scoped engineering ticket — items 1–4 of §5 only;
    not performed by, and not part of, this authorization)
        ↓
Independent Security Verification
   (§7, item 4 — a reviewer distinct from the remediation's author)
        ↓
Governance Gate Revalidation
   (re-run Governance Closure Program's GATE-SEC-001/GATE-SEC-002 checklist
    against the actual, completed remediation — not assumed from this document)
        ↓
Engineering Authorization Review #2
   (evaluates the full Governance Closure Program's remaining gates —
    ownership, ADRs, data readiness, certification-prep authorization,
    execution plan — not only security)
        ↓
   [If ENGINEERING_AUTHORIZED or ENGINEERING_AUTHORIZED_WITH_CONDITIONS]
        ↓
Phase A Technical Design
   (its own, separate, future authorization — not implied or pre-approved here)
        ↓
Implementation Readiness Review
        ↓
Phase A Engineering
```

This authorization's scope ends at "Independent Security Verification" and "Governance Gate Revalidation." It does not reach, imply, or shortcut any step from Engineering Authorization Review #2 onward — each remains a distinct, separately gated action.

---

## 10. What This Authorization Does Not Authorize

This authorization does not authorize DGX 3.0 feature engineering, does not authorize Phase A, does not convene or predetermine the outcome of Engineering Authorization Review #2, does not change DGX 3.0's capability maturity (remains **Specified**) or certification status (remains **Not Started**), does not modify any specification or ADR, and does not itself perform any remediation — it authorizes a future, separate, narrowly bounded engineering action, to be independently verified per §7 before it counts toward closing GATE-SEC-001/GATE-SEC-002.

---

*End of DGX 3.0 Platform Remediation Authorization #1.*
