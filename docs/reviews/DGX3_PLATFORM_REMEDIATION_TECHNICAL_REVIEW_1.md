# Platform Remediation Technical Specification — Technical Review #1

## Status: INDEPENDENT TECHNICAL REVIEW — NOT AN IMPLEMENTATION APPROVAL

---

## Document Control

| Field | Value |
|---|---|
| Review | Platform Remediation Technical Specification — Technical Review #1 |
| Document reviewed | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md` |
| Review authority | AIOS Platform Technical Review Board (PTRB) |
| Review date | 2026-07-30 |
| Review type | Independent technical review — re-verified against live repository evidence, not accepted from the specification's own text |
| Primary verdict | **`TECHNICAL_SPECIFICATION_APPROVED_WITH_CONDITIONS`** (see §8) |

---

## 1. Executive Summary

The Platform Remediation Technical Specification (PRTS-1) is technically sound in its overall approach: it correctly identifies that the authorization gap is a deliberate, documented "zero-touch overlay" trade-off rather than an undiscovered defect, correctly locates the precise code responsible (`JwtAuthContextGuard`'s exception-swallowing behavior), and proposes a narrow, additive, individually-revertible remediation. Independent re-verification of every load-bearing code claim in PRTS-1 confirmed all of them accurate.

However, this review independently discovered one previously-unweighted, real regression risk and one factual inaccuracy that PRTS-1 did not itself surface: (1) PRTS-001's proposed change — rejecting any request bearing an invalid credential — would apply to *every* request in the application, since `JwtAuthContextGuard` is a global guard, and this review confirmed real, currently-unguarded endpoints exist (`GET /health`, `/health/db`, `/health/redis`, `/health/dgx`, `GET /metrics`) that would newly reject a caller presenting a stale or malformed `Authorization` header, even though these endpoints require no permission today; (2) PRTS-1's own "Dependency direction" section states the reverse of the actual, confirmed import direction between `src/identity/` and `src/common/permissions/`. Neither finding invalidates the remediation's overall design. Three conditions are attached; none requires a fundamental redesign.

**Verdict: `TECHNICAL_SPECIFICATION_APPROVED_WITH_CONDITIONS`.**

---

## 2. Technical Assessment

### Current-state accuracy
Independently re-verified, fresh, against live code (not accepted from PRTS-1's own text):
- `JwtAuthContextGuard.canActivate` confirmed to wrap `AuthTokenService.verifyAccessToken`/`ApiKeysService.verify` in a `try/catch` that discards any thrown exception and unconditionally returns `true`. **Accurate.**
- `AuthTokenService.verifyAccessToken` and `ApiKeysService.verify` confirmed to already throw the correct, specific `UnauthorizedException` on every failure path. **Accurate.**
- `RolesGuard` confirmed to read `request.headers['x-user-role']` directly, bypassing `getRequestActor()` entirely. **Accurate.**
- `RolesGuard`'s three real, current usages confirmed exactly as listed: `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`, with matching `@Roles(...)` decorators re-confirmed line-for-line. **Accurate.**
- Absence of `jwt-auth-context.guard.spec.ts` and `roles.guard.spec.ts`, and presence of `permissions.guard.spec.ts`, all re-confirmed by direct file search. **Accurate.**

### Target architecture consistency
The target state (reject-on-invalid-credential; opt-in verified-actor enforcement; controller consolidation onto `PermissionsGuard`) is internally consistent with the current-state findings and does not contradict itself across sections — **with one exception** (see Dependency Direction, below).

### Implementation feasibility
PRTS-002's proposed mechanism (a new reflector-based metadata key, checked inside `PermissionsGuard`, mirroring the existing `PERMISSIONS_KEY`/`ROLES_KEY` pattern) is a standard, already-proven NestJS pattern in this exact codebase — feasible without architectural novelty. PRTS-003's controller migration is mechanically straightforward but carries real mapping risk (see Condition CR-T-003).

### Scope control / Out-of-scope enforcement
Re-verified: every file named across PRTS-1's Remediation Scope (§4) falls within `src/identity/`, `src/common/permissions/`, `src/common/rbac/`, or the three named controllers. No file under `src/vehicle-lifecycle/`, `src/twin-intelligence/`, or any DGX-3.0-named path is named anywhere in the remediation scope. **Confirmed clean.**

### Security correctness
See §4 (Security Review) below.

### Dependency direction
**Inaccurate as written.** PRTS-1 §3 states: *"`src/common/permissions/` and `src/common/rbac/` depend on types from `src/identity/` (via `RequestActor`, already the case today); `src/identity/` does not depend on either."* Direct re-inspection found the reverse: `RequestActor` is **defined in** `src/common/permissions/request-actor.ts` (which imports only `Role` from `@prisma/client` — no import from `src/identity/`), and it is `src/identity/jwt-auth-context.guard.ts` that **imports** `RequestActor` from `../common/permissions/request-actor`. The real dependency edge is `src/identity/` → `src/common/permissions/`, not the reverse. This does not introduce a cycle (no file in `common/permissions`/`common/rbac` was found to import from `src/identity/`), so the remediation's architecture is still sound — but the specification's own stated direction is factually backward. See Condition CR-T-002.

### Backward compatibility
PRTS-001, PRTS-002, and PRTS-004 are correctly designed to be non-breaking for any caller not specifically presenting an invalid credential or opting into the new enforcement mechanism. PRTS-003 is correctly flagged as the highest-regression-risk item and is appropriately scoped to per-controller, individually-verified migration.

### Verification plan / Rollback plan / Definition of Done / Implementation sequencing
All four are clearly defined, internally consistent with the remediation scope, and each remediation activity's rollback strategy was independently checked for soundness (§10 of this review's underlying analysis) — no inconsistency found between any activity's claimed rollback strategy and its actual file-level scope.

---

## 3. Architecture Review

| Check | Result | Evidence |
|---|---|---|
| No DGX feature enters remediation scope | **Pass** | Full re-read of PRTS-1 §4/§5; no `RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome`, or any DGX-3.0-named entity/file appears anywhere in scope |
| No domain logic changes | **Pass** | No file under any business domain (vehicles, garage-jobs, diagnostics, etc.) appears in scope |
| No vehicle-lifecycle ownership changes | **Pass** | `src/vehicle-lifecycle/` does not appear anywhere in PRTS-1's Remediation Scope; consistent with `DGX3-ADR-0001`'s boundary |
| No Digital Twin modification | **Pass** | `src/twin-intelligence/`, `digital-twin.service.ts` do not appear anywhere in scope |
| No schema dependency | **Pass** | PRTS-1 explicitly excludes any Prisma/migration change (§5, §6); independently confirmed no `.prisma` file is named anywhere in the remediation scope |

---

## 4. Security Review

| Check | Result | Evidence |
|---|---|---|
| Removes silent authorization downgrade | **Pass, with a scoping condition** | PRTS-001 correctly identifies and closes the exact mechanism (swallowed `UnauthorizedException`) — see Condition CR-T-001 for a real, confirmed blast-radius consideration this specification did not fully weigh |
| Maintains explicit authentication boundaries | **Pass** | The identity/authorization module boundary is unchanged; only the *direction* stated in PRTS-1's own text was found inaccurate (Condition CR-T-002), not the boundary's existence or integrity |
| Does not introduce privilege escalation | **Pass, with a verification condition** | PRTS-002 is strictly additive/opt-in and cannot broaden any existing caller's access. PRTS-003's role-to-permission mapping carries a real, if narrow, risk of inadvertently granting broader access than today's `@Roles(...)` list via an over-broad existing permission — see Condition CR-T-003 |
| Maintains least privilege | **Pass** | No remediation activity grants new default access to any actor; PRTS-002 is opt-in only |
| Preserves audit attribution | **Pass** | No `AuditLog` schema or write-path change is proposed; the remediation only makes the actor identity available to audit-writing code more trustworthy, never less |

---

## 5. Scope Review

Independently re-confirmed: every file named in PRTS-1's Remediation Scope (§4) and every file named in its Out-of-Scope list (§5) is mutually consistent — no file appears in both. No schema, migration, or API-surface file is named anywhere in scope. The three named consumer controllers (`integration`, `parts`, `vehicles`) are the only business-domain files touched, and only for their existing authorization decorator, never their business logic.

---

## 6. Risk Assessment

| Severity | Description | Likelihood | Impact | Recommended mitigation |
|---|---|---|---|---|
| **Critical** | None identified. | — | — | — |
| **High** | PRTS-001's rejection behavior applies globally (the guard runs on every request); this review confirmed real, currently-unguarded endpoints exist (`GET /health`, `/health/db`, `/health/redis`, `/health/dgx`, `GET /metrics`) that would newly reject a caller presenting a stale or malformed `Authorization` header, even though these endpoints require no permission today. A monitoring tool or load balancer sending a stray/expired token to a health-check endpoint would newly receive a `401` where it succeeds today — a real risk of false-positive downtime signals. | Medium-High — health-check/monitoring callers commonly carry default or stale headers | High — could trigger false outage alerts on infrastructure-critical endpoints | See Condition CR-T-001: scope PRTS-001's rejection to fire only where the resolved handler already requires an actor/permission, or explicitly inventory and clear every currently-unguarded route before implementation |
| **Medium** | PRTS-1's stated "Dependency direction" is factually backward (see §2) — a documentation-accuracy defect, not an operational one. | N/A (already true, not probabilistic) | Low-Medium — could mislead a future engineer's mental model of the module graph | See Condition CR-T-002: correct the stated direction |
| **Medium** | PRTS-003's role-to-permission mapping could inadvertently grant broader access than today's `@Roles(...)` list if an existing, over-broad permission is reused without an exact-equivalence check. | Medium — plausible if convenience is prioritized over precision during migration | Medium-High if it occurs — a role would gain unintended access | See Condition CR-T-003: require a per-controller access-matrix equivalence proof before migration |
| **Low** | During the phased, one-controller-at-a-time migration window (PRTS-1 §10, Phase 3), any controller not yet migrated remains on the weaker `RolesGuard` path for the duration. | Low — already time-boxed by design | Low — no worse than today's current state | Complete all three controller migrations within a single remediation cycle rather than leaving any indefinitely on the legacy guard |
| **Low** | New test files (PRTS-004) could themselves contain defects that mask a real regression. | Low | Low | Independent review (PRTS-005) already covers this; no additional mitigation needed |

---

## 7. Conditions

### CR-T-001 — Global rejection blast radius not fully scoped against real unguarded endpoints
- **Severity**: High
- **Description**: PRTS-001 proposes making the global `JwtAuthContextGuard` reject any request presenting an invalid, expired, or malformed credential. Because this guard runs on every request in the application (not only DGX-3.0-relevant or `RolesGuard`-gated ones), this review independently confirmed real, currently-unguarded endpoints exist — `GET /health`, `/health/db`, `/health/redis`, `/health/dgx` (`src/api-platform/health.controller.ts`) and `GET /metrics` (`src/observability/observability.controller.ts`) — that require no permission today and would newly reject a caller presenting a stray or stale `Authorization` header.
- **Required correction**: Before implementation, either (a) scope PRTS-001's rejection so it fires only when the resolved route handler already carries a permission/role requirement (i.e., an invalid credential on a genuinely open route is still tolerated, matching today's behavior for open routes specifically), or (b) perform and document a complete inventory of every currently-unguarded controller/route in the repository, with an explicit, reviewed decision for each on whether rejecting invalid credentials there is acceptable.
- **Evidence required**: A recorded route inventory (this review found two controllers with zero guards via a repository-wide search; a complete inventory covering the entire `services/operational-core` controller set is required) and, whichever correction path is chosen, updated language in PRTS-1 §4 (PRTS-001) reflecting the actual scoped behavior.

### CR-T-002 — Dependency direction stated backward
- **Severity**: Medium
- **Description**: PRTS-1 §3 states `common/permissions`/`common/rbac` depend on `src/identity/` and that `src/identity/` depends on neither. Direct re-inspection found the opposite: `src/identity/jwt-auth-context.guard.ts` imports `RequestActor` from `src/common/permissions/request-actor.ts`; `request-actor.ts` itself imports nothing from `src/identity/`.
- **Required correction**: Amend PRTS-1 §3's "Dependency direction (target)" text to state the correct direction: `src/identity/` depends on `src/common/permissions/` (via the `RequestActor` type), and no cycle exists since no file in `common/permissions`/`common/rbac` imports from `src/identity/`.
- **Evidence required**: The two import statements already confirmed in this review (§2 above) are sufficient evidence; no further investigation is needed.

### CR-T-003 — Role-to-permission mapping needs an explicit equivalence proof
- **Severity**: Medium
- **Description**: PRTS-003 migrates three real controllers from `@Roles(...)` to `@RequirePermissions(...)`. PRTS-1 already discloses that a matching permission may not exist for every role combination, deferring the exact mapping to implementation time. Without an explicit equivalence check, an implementer could reuse an existing, broader permission for convenience, inadvertently granting a role access it does not have today.
- **Required correction**: Add, as a mandatory verification artifact for PRTS-003 (not merely a disclosed uncertainty), a per-controller table mapping each endpoint's current `@Roles(...)` set to its proposed `@RequirePermissions(...)` set, with an explicit statement that no role gains or loses access as a result, reviewed before that controller's migration is considered complete.
- **Evidence required**: The three mapping tables themselves (one per controller: `integration`, `parts`, `vehicles`), each reviewed and signed off independently of whoever performs the migration.

---

## 8. Final Verdict

**`TECHNICAL_SPECIFICATION_APPROVED_WITH_CONDITIONS`**

None of the three conditions above requires a fundamental redesign of the remediation's three-phase approach; all are narrow, addressable via scoping clarification, a documentation correction, and an added verification artifact, respectively. The specification's core technical judgment — that the gap is a known, deliberate trade-off closeable via a narrow, additive, individually-revertible change confined to the identity/authorization layer — is independently confirmed sound.

---

## 9. What This Review Does Not Authorize

This review does not authorize implementation of any remediation activity, does not modify the Platform Remediation Technical Specification itself, does not change DGX 3.0's maturity or certification status, and does not constitute Technical Approval — that remains a separate, subsequent action.

---

*End of Platform Remediation Technical Specification — Technical Review #1. INDEPENDENT TECHNICAL REVIEW, NOT AN IMPLEMENTATION APPROVAL.*
