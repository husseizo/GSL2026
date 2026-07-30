# DGX 3.0 Platform Remediation Technical Specification #1 (PRTS-1)

### The Technical Definition of How the Approved Platform Remediation Authorization Will Be Executed

---

## Document Control

| Field | Value |
|---|---|
| Document | Platform Remediation Technical Specification #1 |
| Issuing authority | AIOS Platform Architecture Board (PAB) |
| Status | **TECHNICAL SPECIFICATION — NOT AN IMPLEMENTATION AUTHORIZATION** |
| Effective date | 2026-07-30 |
| Authoritative inputs | `docs/governance/DGX3_PLATFORM_REMEDIATION_AUTHORIZATION_1.md`; `docs/capabilities/DGX_3_PREDICTIVE_MAINTENANCE_SPECIFICATION_V1.md` §26, §29; direct code inspection of `src/identity/jwt-auth-context.guard.ts`, `src/identity/identity.module.ts`, `src/identity/auth-token.service.ts`, `src/identity/api-keys.service.ts`, `src/common/permissions/permissions.guard.ts`, `src/common/permissions/request-actor.ts`, `src/common/permissions/permissions.decorator.ts`, `src/common/rbac/roles.guard.ts`, `src/common/rbac/roles.decorator.ts`, `src/integration/integration.controller.ts`, `src/parts/parts.controller.ts`, `src/vehicles/vehicles.controller.ts`; `docs/architecture/identity-platform.md`; `docs/architecture/rbac-permissions.md` |

**This document specifies how the already-approved Platform Remediation will be executed. It does not perform any remediation itself — no source file, schema, migration, or API is created or changed by this document. It does not authorize DGX 3.0 engineering, does not change DGX 3.0's maturity (remains Specified) or certification status (remains Not Started), and every remediation activity defined below remains bound by the exact scope and exclusions already fixed in the Platform Remediation Authorization.**

**Revision note**: this document was updated on 2026-07-30 to incorporate the resolutions recorded in `docs/reviews/DGX3_PLATFORM_REMEDIATION_CONDITION_RESOLUTION_1.md`, closing conditions CR-T-001, CR-T-002, and CR-T-003 from `docs/reviews/DGX3_PLATFORM_REMEDIATION_TECHNICAL_REVIEW_1.md`. Every change is marked inline with a "per Condition Resolution CR-T-00X" note at its point of insertion. No remediation scope was expanded or narrowed by this update — only the design of PRTS-001, the mapping for PRTS-003, and one factual correction (dependency direction) were clarified.

---

## 1. Executive Summary

Direct inspection of the identity/authorization layer, cross-referenced against its own architecture documentation (`docs/architecture/identity-platform.md`, `docs/architecture/rbac-permissions.md`), establishes that the authorization gap DGX 3.0's specification names is not an undiscovered defect — it is a **known, deliberate, documented trade-off**. Phase 5's Identity Platform was explicitly built as a "zero-touch overlay": `JwtAuthContextGuard` was designed to enrich every request with a verified actor *when possible*, while guaranteeing that "every existing `@UseGuards(RolesGuard)` controller from Phases 1–4 is unmodified and works identically with either a real JWT or the legacy header." This design goal — never break an existing controller — is exactly why an invalid or absent credential is never rejected at the global guard level: rejecting there would have required touching every Phase 1–4 controller, which the migration was explicitly designed to avoid.

This specification defines the **narrow, additive, backward-compatible extension** of that same design needed to satisfy DGX 3.0 specification §26 and §29, without reopening the original migration's scope or regressing any Phase 1–4 caller. Three technical activities are defined: (1) stop silently downgrading a *presented-but-invalid* credential to "no verified actor" — currently the guard's own `try/catch` discards a real, already-correct `UnauthorizedException` from `AuthTokenService`/`ApiKeysService`; (2) introduce a new, opt-in mechanism by which a specific permission or endpoint can require a verified actor, so DGX 3.0's future Safety-Relevant permissions can use it without forcing every legacy endpoint to change; (3) migrate the three remaining `RolesGuard`-gated controllers (`integration`, `parts`, `vehicles`) onto the unified `PermissionsGuard` path, evaluated individually for regression risk. None of this touches any schema, any DGX-3.0-named file, or any file outside `src/identity/`, `src/common/permissions/`, or `src/common/rbac/`.

---

## 2. Current State Analysis

### Authentication flow (as implemented today)

1. `JwtAuthContextGuard` (`src/identity/jwt-auth-context.guard.ts`) is registered globally via `APP_GUARD` in `identity.module.ts` — it runs before every route handler, unconditionally.
2. If the request carries `Authorization: Bearer <jwt>`, the guard calls `AuthTokenService.verifyAccessToken(token)`. This method is already fully correct: it resolves the signing key by `kid`, and throws `UnauthorizedException('Token signed with an unknown or retired key')` or `UnauthorizedException('Invalid or expired access token')` on any failure.
3. If the request carries `x-api-key`, the guard calls `ApiKeysService.verify(key)`, which is likewise already correct: throws `UnauthorizedException('Invalid or revoked API key')` or `UnauthorizedException('API key has expired')` as appropriate.
4. **The guard wraps both calls in a `try { ... } catch { /* leave verifiedActor unset */ }` block.** Any `UnauthorizedException` these already-correct services throw is caught and discarded; `canActivate` then unconditionally `return true`s regardless of outcome.
5. If no `Authorization`/`x-api-key` header is present at all, the guard does nothing and returns `true` — this is the *intended*, documented behavior for endpoints that don't require authentication, and is not itself a defect.

**The defect is narrowly located**: step 4 treats "a credential was presented but failed verification" identically to "no credential was presented at all." The underlying verification logic is already sound; only the guard's handling of its result is wrong.

### Authorization flow (as implemented today)

1. `getRequestActor(request)` (`src/common/permissions/request-actor.ts`) is the single function every downstream guard calls to determine the acting identity. Its logic, exactly as implemented:
   ```ts
   if (request.verifiedActor) return request.verifiedActor;
   // else, fall back to parsing x-user-role / x-user-id / x-branch-id / x-warehouse-id headers
   // authMethod is set to 'header-stand-in' only if x-user-role was present
   ```
2. `PermissionsGuard` (`src/common/permissions/permissions.guard.ts`) calls `getRequestActor`, checks the resolved `role` against `ROLE_PERMISSIONS` (`src/common/permissions/role-permissions.ts`) for every permission listed on `@RequirePermissions(...)`, and throws `ForbiddenException` naming any missing permission. If no `@RequirePermissions` decorator is present, it returns `true` unconditionally (no restriction at this layer).
3. `RolesGuard` (`src/common/rbac/roles.guard.ts`) is a separate, older guard: it reads `request.headers['x-user-role']` **directly**, bypassing `getRequestActor()` entirely, and checks it against `@Roles(...)`. It throws `ForbiddenException` if the role is absent or not listed.
4. Both guards therefore accept a role sourced from an unverified header when no verified JWT/API-key actor exists — this is the second, distinct half of the documented gap.

### `JwtAuthContextGuard` — confirmed exact behavior

Registered as `{ provide: APP_GUARD, useClass: JwtAuthContextGuard }` in `identity.module.ts`. Its own code comment states its scope precisely: enrichment only, never rejection — "this guard never itself rejects a request." This is accurate to the code exactly as read.

### `PermissionsGuard` — confirmed exact behavior

Enforces permission checks correctly and does throw `ForbiddenException` for a role lacking a required permission — this half of the system works exactly as intended. Its only gap is the *source* of the role it trusts when no verified actor exists.

### `RolesGuard` — confirmed exact behavior

Still actively applied, at the controller-class level, in exactly three real controllers:

| Controller | Guard registration | Method-level decorators |
|---|---|---|
| `src/integration/integration.controller.ts` | `@UseGuards(RolesGuard)` | `@Roles(SYSTEM_ADMINISTRATOR)` ×2, `@Roles(SYSTEM_ADMINISTRATOR, DATA_QUALITY_REVIEWER)` ×2 |
| `src/parts/parts.controller.ts` | `@UseGuards(RolesGuard)` | `@Roles(SYSTEM_ADMINISTRATOR, PARTS_MANAGER, STOREKEEPER)` ×1, `@Roles(SYSTEM_ADMINISTRATOR, PARTS_MANAGER)` ×3 |
| `src/vehicles/vehicles.controller.ts` | `@UseGuards(RolesGuard)` | `@Roles(SYSTEM_ADMINISTRATOR, BRANCH_MANAGER, PARTS_MANAGER)` ×2 |

`RolesGuard` has **no dedicated unit test file** (`roles.guard.spec.ts` does not exist) — confirmed by direct search. `permissions.guard.spec.ts` exists and covers `PermissionsGuard`'s denial/allow paths. `jwt-auth-context.guard.ts` likewise has **no dedicated unit test file**.

### Identity propagation

`request.verifiedActor` is attached only by `JwtAuthContextGuard`, only on the success path. `RequestActor.authMethod` already has three real values today — `'jwt' | 'api-key' | 'header-stand-in'` — confirmed directly in `request-actor.ts`. This existing type is sufficient infrastructure for the remediation defined below; no new field is required.

### Permission resolution

`ROLE_PERMISSIONS` (`src/common/permissions/role-permissions.ts`) is a static, explicit, code-level map — not database-backed. This is itself a deliberate, documented decision (`decision-log.md`, per `rbac-permissions.md`), not part of the gap this remediation addresses.

### Known inconsistencies (confirmed by direct evidence, not inference)

1. `RolesGuard` reads `x-user-role` directly from headers, bypassing `getRequestActor()` — meaning a real, verified JWT actor is **never consulted at all** on any of the three controllers still using `RolesGuard`, even if the caller presents one. This is a materially different (and, for those three controllers, worse) gap than `PermissionsGuard`'s header-fallback, since `PermissionsGuard` at least *prefers* a verified actor when one exists.
2. `JwtAuthContextGuard`'s swallowed-exception behavior means a caller who sends an **expired or tampered JWT** is treated identically to a caller who sends **no credential at all** — silently downgraded to whatever the legacy header path resolves to, rather than rejected.
3. `docs/architecture/rbac-permissions.md` itself already documents, in its own words, that "branch/warehouse scoping is not enforced on every endpoint... a placeholder for a later phase once real authentication... exists" — meaning the current documentation already anticipated further tightening work of exactly this kind, which had not yet been scheduled or authorized until the Platform Remediation Authorization.
4. **Added per Condition Resolution CR-T-001**: a repository-wide scan of all 75 controllers in `services/operational-core` found only two files with zero guard-related decorators anywhere (`src/api-platform/health.controller.ts`, `src/observability/observability.controller.ts`) — but a file-level scan alone understates the real picture. Several otherwise-guarded controllers have individual methods with no `@RequirePermissions`/`@Roles` decorator at all, and are therefore equally open today: `src/identity/identity.controller.ts`'s own authentication endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/mfa/*`, `/auth/password/*`, `/auth/email/*` — necessarily open, since a caller cannot present a JWT before logging in), and the `GET` methods in `src/parts/parts.controller.ts` (`GET /parts`, `GET /parts/:id`) and `src/vehicles/vehicles.controller.ts` (`GET /vehicles`, `GET /vehicles/vin/:vin`, `GET /vehicles/:id`), none of which carry a `@Roles(...)` decorator. **A static, hand-maintained file list cannot reliably catch this** — the correct remediation design (see PRTS-001, §4) must check, at the handler level, whether any permission/role metadata is present, not rely on a fixed inventory of "known open files."

### Known security gaps (as previously confirmed across this governance program, re-verified fresh for this specification)

- Non-rejecting global JWT guard (item 2 above).
- Unverified `x-user-role` header trust in both `PermissionsGuard`'s fallback and `RolesGuard`'s direct read (items 1–2 above).
- No unit test coverage for `JwtAuthContextGuard` or `RolesGuard` — a testing gap that compounds the risk of the above, since neither guard's actual behavior is regression-protected today.
- The full extent of genuinely open endpoints is broader than any two-file inventory suggests (item 4 above) — this must be treated as a design constraint (handler-level metadata check) for PRTS-001, not resolved via a maintained list of exceptions.

### Repository structure

All relevant files are colocated under three directories: `src/identity/` (JWT/API-key verification and the global guard), `src/common/permissions/` (`PermissionsGuard`, `RequirePermissions`, `getRequestActor`, `ROLE_PERMISSIONS`), and `src/common/rbac/` (`RolesGuard`, `@Roles`) — plus the three consumer controllers named above. No other module needs to change for this remediation to be technically complete.

---

## 3. Target State

### Target authentication flow

1. `JwtAuthContextGuard` continues to run globally and continues to be non-blocking when **no credential is presented at all** — this preserves every endpoint that intentionally allows anonymous or header-stand-in access today (unchanged, backward compatible).
2. **Corrected per Condition Resolution CR-T-001**: when a credential **is presented** (`Authorization: Bearer` or `x-api-key`) and verification fails, the guard rejects the request **only if the resolved route handler already carries a `PERMISSIONS_KEY` or `ROLES_KEY` reflector metadata entry** (i.e., the route already requires some actor-based check today, via `@RequirePermissions(...)` or `@Roles(...)`). When the resolved handler carries no such metadata — confirmed to include `health.controller.ts`, `observability.controller.ts`, every unauthenticated endpoint in `identity.controller.ts`, and the undecorated `GET` methods in `parts.controller.ts`/`vehicles.controller.ts` — an invalid credential is tolerated exactly as today, and the request proceeds with no verified actor attached. The verification services already throw the correct, specific `UnauthorizedException`; the target behavior is for that exception to propagate only in the conditional case above, never unconditionally.
3. On successful verification, behavior is unchanged: `request.verifiedActor` is attached exactly as today, regardless of whether the target handler requires it.

### Target authorization flow

1. `getRequestActor()`'s existing precedence (`verifiedActor` first, legacy headers as fallback) and its existing `authMethod` field are **retained exactly as-is** — no interface change, no new field. They already carry enough information for the enforcement described below.
2. A new, additive, opt-in enforcement mechanism becomes available: a specific permission or handler may declare that it **requires** a verified actor (`authMethod` of `'jwt'` or `'api-key'`, never `'header-stand-in'` or absent). Any handler not using this mechanism behaves exactly as it does today — this is the backward-compatibility guarantee.
3. `RolesGuard`'s three current real controllers are migrated onto `PermissionsGuard`/`@RequirePermissions`, so that every controller in the repository consults `getRequestActor()` (and therefore a verified actor, when one exists) uniformly — closing the "verified JWT is never consulted" gap specific to `RolesGuard` today.

### JWT validation (target)

For any route that already requires a permission or role (`PERMISSIONS_KEY`/`ROLES_KEY` metadata present), a presented JWT is either successfully verified (attaches `verifiedActor`) or causes a rejected request (`401`) — there is no longer a silent outcome where an invalid JWT is treated as if it were absent, for these routes specifically. For a route that requires no permission or role today (confirmed examples: `/health*`, `/metrics`, `identity.controller.ts`'s unauthenticated endpoints, the undecorated `parts`/`vehicles` `GET` methods), an invalid or expired JWT continues to be tolerated exactly as today — this is a deliberate, evidenced scope boundary (CR-T-001), not an oversight.

### Role resolution / Permission evaluation (target)

Unchanged in mechanism (`ROLE_PERMISSIONS` static map, `ForbiddenException` on a missing permission) — the target state changes *only* which actor identity feeds into this evaluation, not the evaluation logic itself.

### Identity propagation (target)

Fully consistent across every controller: whether gated by `PermissionsGuard` or (post-migration) the former `RolesGuard` controllers, every handler consults the same `getRequestActor()` result, sourced from the same verified-actor-first resolution.

### Audit attribution (target)

Unchanged at the schema level (no migration, per this specification's own constraints) — the target state ensures that wherever a real, verified actor exists, it is what gets propagated to any `AuditLog` write downstream, rather than a header value that was never cryptographically checked. This is a propagation-consistency improvement, not a new capability.

### Controller interaction (target)

Every controller (including the three migrated ones) calls `getRequestActor()` through `PermissionsGuard`'s already-existing pattern — no controller retains a bespoke, guard-bypassing header read.

### Security boundaries (target)

The boundary between "authentication" (`src/identity/`) and "authorization" (`src/common/permissions/`, `src/common/rbac/`) is preserved exactly as today — this remediation does not merge or blur that boundary, it only makes the authorization layer's already-intended reliance on authentication actually hold in every case it should.

### Dependency direction (target)

**Corrected per Condition Resolution CR-T-002** (`docs/reviews/DGX3_PLATFORM_REMEDIATION_CONDITION_RESOLUTION_1.md`): the actual, confirmed direction is the reverse of an earlier draft of this section. `src/identity/jwt-auth-context.guard.ts` imports the `RequestActor` type from `src/common/permissions/request-actor.ts`; `request-actor.ts` itself imports only `Role` from `@prisma/client` and nothing from `src/identity/`. The correct statement is: **`src/identity/` depends on `src/common/permissions/`** (via the `RequestActor` type it imports); no file in `common/permissions` or `common/rbac` depends on `src/identity/`; no cycle exists in either direction. This remediation introduces no new dependency edge and does not change this direction.

---

## 4. Remediation Scope

### PRTS-001 — Stop Discarding Verification Failures in `JwtAuthContextGuard`, Conditionally on Handler Requirements
- **Purpose**: Close the "invalid/expired credential is silently treated as anonymous" gap, without breaking any route that intentionally requires no actor.
- **Current behavior**: `canActivate` wraps `verifyAccessToken`/`ApiKeysService.verify` in `try { ... } catch { /* leave verifiedActor unset */ }`, then unconditionally `return true`.
- **Target behavior (corrected per Condition Resolution CR-T-001)**: `canActivate` uses the same `Reflector`-based pattern already used by `PermissionsGuard`/`RolesGuard` to check whether the resolved handler carries `PERMISSIONS_KEY` or `ROLES_KEY` metadata (i.e., whether the route already requires some actor-based check via `@RequirePermissions(...)` or `@Roles(...)`). When a credential is presented, verification throws, **and** the handler carries such metadata, the guard allows the exception to propagate (or re-throws an equivalent `UnauthorizedException`) instead of catching and continuing. When the handler carries no such metadata — confirmed to include `health.controller.ts`, `observability.controller.ts`, every unauthenticated endpoint in `identity.controller.ts`, and the undecorated `GET` methods in `parts.controller.ts`/`vehicles.controller.ts` (§2, "Known inconsistencies," item 4) — an invalid credential is tolerated exactly as today. When no credential is presented at all, behavior is unchanged regardless of the handler (`return true`, no verified actor).
- **Files expected to change**: `src/identity/jwt-auth-context.guard.ts`. A new `src/identity/jwt-auth-context.guard.spec.ts` (does not exist today) should be added.
- **Dependencies**: None — this is the foundational, lowest-risk activity and should land first.
- **Expected verification**: Unit tests proving (a) no credential, any handler → allowed, no verified actor; (b) valid credential, any handler → allowed, verified actor attached; (c) invalid/expired/revoked credential, handler with `PERMISSIONS_KEY`/`ROLES_KEY` metadata → rejected with `UnauthorizedException`; (d) invalid/expired/revoked credential, handler with no such metadata → allowed, no verified actor (unchanged from today). Full existing suite re-run to confirm the auth endpoints, `health`/`metrics`/undecorated `GET` routes named above are unaffected.
- **Risk**: **Medium, narrowed by this correction** — the original design's blast radius (rejecting on every route, including genuinely open ones) has been eliminated by conditioning rejection on existing handler metadata. Residual risk is limited to any real caller currently sending an invalid/expired token to a route that *already* requires a permission or role — which is the intended, correct behavior change, not a regression.
- **Rollback strategy**: Revert `jwt-auth-context.guard.ts` to the prior catch-and-continue behavior; no other file depends on this change in a way that would prevent a clean, single-file revert.

### PRTS-002 — Introduce an Opt-In "Require Verified Actor" Enforcement Mechanism
- **Purpose**: Give DGX 3.0 (and any future capability) a way to mandate a verified actor for specific permissions/endpoints, without changing behavior for any endpoint that doesn't opt in.
- **Current behavior**: No such mechanism exists — `PermissionsGuard` treats a header-stand-in actor identically to a verified one for permission-matching purposes.
- **Target behavior**: A new, additive decorator (e.g., a `requireVerifiedActor` flag alongside `@RequirePermissions`, or a distinct new decorator) that `PermissionsGuard` checks: if set, and `getRequestActor(request).authMethod` is not `'jwt'` or `'api-key'`, the guard rejects (`ForbiddenException` or `UnauthorizedException`, consistent with `PermissionsGuard`'s existing exception style) rather than evaluating role/permission at all.
- **Files expected to change**: `src/common/permissions/permissions.guard.ts`, `src/common/permissions/permissions.decorator.ts` (or a new, adjacent decorator file). Corresponding additions to `src/common/permissions/permissions.guard.spec.ts`.
- **Dependencies**: Benefits from PRTS-001 landing first (so that a verified actor is actually reliable by the time this mechanism checks for one), but is not strictly blocked by it.
- **Expected verification**: Unit tests proving a handler marked with the new requirement rejects a header-stand-in actor and accepts a verified one; confirmation that handlers *not* marked are entirely unaffected.
- **Risk**: **Low** — purely additive; no existing handler's behavior changes unless it explicitly opts in.
- **Rollback strategy**: Remove the new decorator/check; since no existing handler uses it yet (it would only be adopted by future DGX 3.0 work, which is out of scope for this remediation itself), rollback has zero effect on any current caller.

### PRTS-003 — Migrate `RolesGuard`'s Three Real Controllers onto `PermissionsGuard`
- **Purpose**: Close the "verified JWT is never consulted" gap specific to `RolesGuard`, and unify every controller onto a single authorization path.
- **Current behavior**: `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts` use `@UseGuards(RolesGuard)` + `@Roles(...)`, reading `x-user-role` directly and never consulting `getRequestActor()` or any verified actor.
- **Target behavior (mapping finalized per Condition Resolution CR-T-003)**: Each controller uses `@UseGuards(PermissionsGuard)` + `@RequirePermissions(...)`. Direct inspection of `ROLE_PERMISSIONS` confirmed that **no existing permission string can be reused for any of these three controllers' role combinations without either over-granting** (e.g., `system.admin`/`integration.manage`/`parts.manage` are all already held by `GENERAL_MANAGER`, which is not in any of these controllers' current `@Roles(...)` lists) **or under-granting** (e.g., no existing permission covers `STOREKEEPER`'s current access to `POST /parts`). The following new, precisely-scoped permission strings must be added to `PERMISSIONS` (`permission.ts`) and granted to exactly the roles listed, in `ROLE_PERMISSIONS` (`role-permissions.ts`):

  | Controller | Endpoint(s) | Current `@Roles(...)` | New permission | Exact role grant |
  |---|---|---|---|---|
  | `integration` | `POST /integration/sync/vehicles`, `POST /integration/sync/parts` | `SYSTEM_ADMINISTRATOR` | `integration.sync` | `SYSTEM_ADMINISTRATOR`, `OWNER` only |
  | `integration` | `GET /integration/dead-letters` | `SYSTEM_ADMINISTRATOR`, `DATA_QUALITY_REVIEWER` | `integration.deadLetters.read` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `DATA_QUALITY_REVIEWER` only |
  | `integration` | `PATCH /integration/dead-letters/:id/resolve` | `SYSTEM_ADMINISTRATOR`, `DATA_QUALITY_REVIEWER` | `integration.deadLetters.resolve` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `DATA_QUALITY_REVIEWER` only |
  | `parts` | `POST /parts` | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER`, `STOREKEEPER` | `parts.create` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER`, `STOREKEEPER` only |
  | `parts` | `POST /parts/match-candidates/run`, `GET /parts/match-candidates`, `PATCH /parts/match-candidates/:id/review` | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER` | `parts.matchCandidates.manage` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER` only |
  | `parts` | `GET /parts`, `GET /parts/:id` | *(none — open today)* | None required | Remains open; a deliberate future scope decision, not part of this remediation (see §5, Out of Scope) |
  | `vehicles` | `POST /vehicles`, `PATCH /vehicles/:id/attribute-correction` | `SYSTEM_ADMINISTRATOR`, `BRANCH_MANAGER`, `PARTS_MANAGER` | `vehicle.create` (create), `vehicle.correct` (correction) | `SYSTEM_ADMINISTRATOR`, `OWNER`, `BRANCH_MANAGER`, `PARTS_MANAGER` only |
  | `vehicles` | `GET /vehicles`, `GET /vehicles/vin/:vin`, `GET /vehicles/:id` | *(none — open today)* | None required | Remains open; same future scope decision as `parts`' open `GET` endpoints |

  Every new permission's role grant is an exact match to that endpoint's current `@Roles(...)` list — no role gains or loses access as a result of this migration.
- **Files expected to change**: `src/integration/integration.controller.ts`, `src/parts/parts.controller.ts`, `src/vehicles/vehicles.controller.ts`; `src/common/permissions/permission.ts` (seven new permission constants: `integration.sync`, `integration.deadLetters.read`, `integration.deadLetters.resolve`, `parts.create`, `parts.matchCandidates.manage`, `vehicle.create`, `vehicle.correct`); `src/common/permissions/role-permissions.ts` (the corresponding grants above) — additive changes to existing files, not a new business capability, remaining within the Platform Remediation Authorization's "Permissions normalization" scope.
- **Dependencies**: PRTS-001, PRTS-002 (the unified path should exist and behave correctly before real controllers move onto it).
- **Expected verification**: Full regression pass of each controller's existing integration tests (if any); a direct, per-permission confirmation (using the mapping table above as the acceptance artifact) that every currently-valid caller (real role via header or real role via JWT claim) continues to succeed, and every currently-rejected caller continues to be rejected — behavior-preserving migration, not a permission-model change.
- **Risk**: **High** — this is the remediation activity with the greatest regression surface, since it changes the actual guard evaluated on three real, currently-functioning controllers, and adds new permission strings that must be granted with exact precision. Each controller should be migrated and verified individually, not as a single combined change.
- **Rollback strategy**: Per-controller revert (`@UseGuards(RolesGuard)` + `@Roles(...)` restored) is possible independently for any one of the three controllers without affecting the other two, since they share no code beyond the common guard/decorator infrastructure. The seven new permission constants may remain defined but unused without any effect if a controller's migration is rolled back.

### PRTS-004 — Test Suite Additions
- **Purpose**: Close the confirmed testing gap (`jwt-auth-context.guard.ts` and `roles.guard.ts` currently have no dedicated unit tests) so this remediation — and any future change to these files — is regression-protected.
- **Current behavior**: No dedicated unit test file for either guard.
- **Target behavior**: `jwt-auth-context.guard.spec.ts` and (if `RolesGuard` is retained rather than removed after PRTS-003) `roles.guard.spec.ts` exist, covering the exact scenarios named in PRTS-001/003's verification requirements.
- **Files expected to change**: New spec files only, colocated with the guards they test.
- **Dependencies**: PRTS-001, PRTS-003.
- **Expected verification**: Test files themselves are the deliverable; CI must show them passing.
- **Risk**: **Low** — additive test-only change.
- **Rollback strategy**: Delete the new spec files; no production behavior depends on them.

### PRTS-005 — Independent Security Verification
- **Purpose**: Satisfy the Platform Remediation Authorization's own Success Criteria §7, item 1 and item 4.
- **Current behavior**: N/A — this is a review activity, not a code change.
- **Target behavior**: A reviewer distinct from whoever implements PRTS-001–004 confirms, via direct code re-inspection (not inference), that no Safety-Relevant DGX 3.0 permission (once DGX 3.0 engineering eventually defines one) could be satisfied via the header-stand-in path, and that all three migrated controllers behave identically to their pre-migration selves for every legitimate caller.
- **Files expected to change**: None — this activity produces a review record, not a code change.
- **Dependencies**: PRTS-001 through PRTS-004 all complete.
- **Expected verification**: A dated, recorded, independent sign-off — the final gate before Governance Gate Revalidation (per the Platform Remediation Authorization's own Governance Sequence).
- **Risk**: **Low** — a review activity; its only risk is being skipped or self-certified, which the Platform Remediation Authorization's own §7 already guards against.
- **Rollback strategy**: N/A — a review finding "not yet satisfied" simply keeps the authorization open rather than requiring any reversal.

---

## 5. Out of Scope

Explicitly excluded from this technical specification and from any remediation performed under it:

- Risk Assessment, Recommendation Engine, Maintenance Recommendation, Outcome, Override, Evidence Citation — all DGX 3.0 business entities/logic, none of which exist today and none of which this remediation creates.
- Vehicle Lifecycle, Digital Twin, Repeat Repair — Operational Core's existing, real business logic; untouched, per both `DGX3-ADR-0001` and the Platform Remediation Authorization.
- Prediction, ML, Certification — no model, no calibration, no certification standard work of any kind.
- Any DGX 3.0 feature of any kind.
- Any Prisma schema modification or new migration — the `AuditLog.actorId` nullability question (specification §29) is explicitly **not** resolved by this remediation; DGX 3.0 must still enforce attribution at its own future application layer, exactly as already recorded.
- Any new API endpoint or expansion of the existing endpoint surface — this remediation changes *how* existing endpoints authenticate/authorize callers, never *what* they do or *how many* there are.
- Branch/warehouse scoping enforcement (`rbac-permissions.md`'s own documented "Scope limitations") — a real, larger, separately-scoped effort explicitly deferred by that document's own text; not part of this remediation.
- Full removal of the legacy `x-user-role` header-stand-in path for endpoints that intentionally still support it — only its *silent-fallback-on-failure* behavior (PRTS-001) and its *use in place of a verified actor for opted-in, high-assurance permissions* (PRTS-002) are addressed; a wholesale deprecation of header-based auth is a distinct, larger, future decision, not part of this remediation.
- Adding a permission requirement to the currently-open `GET /parts`, `GET /parts/:id`, `GET /vehicles`, `GET /vehicles/vin/:vin`, and `GET /vehicles/:id` endpoints (identified during Condition Resolution CR-T-003/CR-T-001) — these remain open exactly as today; whether to tighten them is a future, separate scope decision for the Business/Operational Owner (once assigned), not this remediation.

---

## 6. Technical Constraints

Mandatory, non-negotiable for every remediation activity above:

- No Prisma schema modification, no new migration.
- No new API endpoint or DTO.
- No new business logic outside the identity/permissions/rbac layer.
- No DGX 3.0 implementation of any kind.
- Every changed file must fall within `src/identity/`, `src/common/permissions/`, or `src/common/rbac/`, plus the three named consumer controllers for PRTS-003 specifically.
- Every change must be regression-safe: an existing, legitimate caller that succeeds today must continue to succeed after remediation, unless that caller was relying specifically on the defect being closed (an invalid/expired credential being silently tolerated) — that one specific behavior change is intentional and is the entire purpose of PRTS-001.
- Every change must be backward-compatible with callers that present no credential at all, or a valid legacy header, for any endpoint not migrated under PRTS-003 or opted into PRTS-002's stricter mode.

---

## 7. Verification Plan

- **Unit verification**: new/updated specs for `jwt-auth-context.guard.ts`, `permissions.guard.ts`, and (if retained) `roles.guard.ts`, covering every scenario named in §4's per-activity "Expected verification" — including PRTS-001's four corrected scenarios (no credential; valid credential; invalid credential on a handler requiring a permission/role; invalid credential on a handler requiring none).
- **Integration verification**: existing integration-spec suites for `integration`, `parts`, and `vehicles` controllers (if present) re-run against the migrated guards; new integration coverage added if none exists today for these three controllers' authorization paths specifically; explicit confirmation that `health.controller.ts`, `observability.controller.ts`, `identity.controller.ts`'s unauthenticated endpoints, and the undecorated `parts`/`vehicles` `GET` methods all continue to tolerate an invalid `Authorization` header exactly as today.
- **Regression verification**: full existing repository unit + integration test suite run to completion with zero new failures, beyond the intentional PRTS-001 behavior change (invalid/expired credentials now rejected, but only on routes that already require a permission or role — never on the confirmed-open routes named above).
- **Security verification**: direct, reproducible code re-inspection (not inference) confirming no remaining path allows an unverified header to satisfy a verified-actor requirement, for any endpoint opted into PRTS-002.
- **Repository verification**: a diff review confirming every changed file falls within the three named directories (plus the three named controllers), with no schema, migration, or new top-level module present.
- **Architecture verification**: confirmation that the dependency direction (`identity` → `common/permissions`, per the correction in §3 above; no file in `common/permissions`/`common/rbac` depends on `identity`) is unchanged, and that no DGX-3.0-named file was touched.
- **Independent verification**: PRTS-005, performed by a reviewer distinct from the implementer.

---

## 8. Rollback Plan

- **Rollback trigger**: any regression discovered in the full test suite; any real caller (confirmed via logs/monitoring, not assumption) newly failing for a reason other than PRTS-001's intended behavior change; any finding during PRTS-005's independent verification that scope was exceeded.
- **Rollback procedure**: each of PRTS-001 through PRTS-004 is designed to be independently, cleanly revertible (see each activity's own "Rollback strategy" in §4) — a single-file or single-controller revert, never a combined, all-or-nothing rollback. PRTS-003's per-controller structure specifically exists so that one controller's migration can be rolled back without affecting the other two or PRTS-001/002.
- **Rollback validation**: after any rollback, the full regression suite must pass identically to its pre-remediation baseline before the rolled-back state is considered stable.
- **Recovery criteria**: remediation may be re-attempted only after the specific cause of the rollback is understood and either fixed in the remediation's implementation or reflected as a revision to this technical specification (subject to its own review, not a unilateral implementation-time change).

---

## 9. Definition of Done

Platform Remediation under this technical specification is complete only when **all** of the following hold simultaneously:

- JWT validation behaves exactly as specified in §3: no credential → allowed without a verified actor; valid credential → verified actor attached; invalid/expired/revoked credential → rejected.
- Permissions resolve consistently: every controller, including the three migrated ones, evaluates permissions via the same `PermissionsGuard`/`getRequestActor()` path.
- Roles resolve consistently: no controller reads `x-user-role` directly, bypassing `getRequestActor()`.
- Identity propagation is verified: a verified actor, when present, is what every downstream authorization/audit consumer actually sees.
- The full regression suite passes, with the one intentional, documented exception named in PRTS-001.
- Independent security verification (PRTS-005) passes and is recorded.
- The repository diff remains entirely within the scope defined in §4 and §6 — confirmed via the repository verification step in §7.

---

## 10. Implementation Sequence (Definition Only — Not Executed by This Document)

**Phase 1 — Foundational fix**: PRTS-001 (stop discarding verification failures), with its own unit tests. Verification and review before proceeding.

**Phase 2 — Enforcement mechanism**: PRTS-002 (opt-in require-verified-actor mechanism), with its own unit tests. Verification and review before proceeding — this phase does not yet touch any of the three legacy controllers.

**Phase 3 — Controller migration**: PRTS-003, performed and verified **one controller at a time** (`integration` → `parts` → `vehicles`, or any order the implementing engineer judges lowest-risk-first), each with its own regression pass before the next begins.

**Verification**: PRTS-004 (test suite additions, integrated throughout Phases 1–3 rather than deferred to the end) and the full Verification Plan (§7) run to completion after Phase 3.

**Review**: PRTS-005 — independent security verification, performed by a reviewer distinct from whoever executed Phases 1–3.

**Closure**: upon PRTS-005's recorded pass, this remediation is reported complete to the Platform Governance Board, which then triggers Governance Gate Revalidation per the Platform Remediation Authorization's own Governance Sequence — a separate, future action, not performed by this document.

---

## 11. Success Metrics

- **Zero anonymous authorization**: no endpoint that requires an actor (per its existing `@RequirePermissions`/`@Roles` decoration) can be satisfied with no actor at all — unchanged from today, confirmed rather than assumed.
- **Zero fallback authorization for opted-in permissions**: any permission marked via PRTS-002's mechanism can be satisfied only by a verified (`jwt`/`api-key`) actor — zero instances of a `header-stand-in` actor satisfying such a permission.
- **Consistent permission evaluation**: 100% of controllers route through `PermissionsGuard`/`getRequestActor()` — zero controllers left reading `x-user-role` directly.
- **Consistent identity propagation**: a verified actor, once attached by `JwtAuthContextGuard`, is the actor every downstream guard and audit consumer observes — zero divergence.
- **Regression success**: 100% of the pre-remediation passing test suite still passes, with the one named, intentional exception.
- **No DGX feature introduced**: zero files touched outside `src/identity/`, `src/common/permissions/`, `src/common/rbac/`, and the three named controllers — confirmed by diff, not by intent.

---

## 12. What This Specification Does Not Authorize

This document does not authorize implementation of any activity it defines — each remains gated by the Platform Remediation Authorization's own terms and by whatever separate engineering-execution approval is required to actually begin Phase 1 above. It does not authorize DGX 3.0 engineering, does not change DGX 3.0's maturity or certification status, and does not modify any specification, ADR, or source file.

---

*End of DGX 3.0 Platform Remediation Technical Specification #1.*
