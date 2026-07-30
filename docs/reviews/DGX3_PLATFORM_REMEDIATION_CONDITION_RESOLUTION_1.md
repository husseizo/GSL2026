# Platform Remediation Technical Review — Condition Resolution #1

## Status: TECHNICAL CONDITION RESOLUTION — NOT AN IMPLEMENTATION AUTHORIZATION

---

## Document Control

| Field | Value |
|---|---|
| Document | Platform Remediation Technical Review — Condition Resolution #1 |
| Resolves conditions from | `docs/reviews/DGX3_PLATFORM_REMEDIATION_TECHNICAL_REVIEW_1.md` (CR-T-001, CR-T-002, CR-T-003) |
| Reviewed against | `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md`; `docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_APPROVAL_1.md`; `docs/governance/DGX3_PLATFORM_REMEDIATION_AUTHORIZATION_1.md`; `docs/governance/DGX3_GOVERNANCE_CLOSURE_PROGRAM_1.md`; `docs/adr/DGX3-ADR-0001_EXISTING_OPERATIONAL_CORE_OWNERSHIP.md`; `docs/capabilities/DGX_3_PREDICTIVE_MAINTENANCE_SPECIFICATION_V1.md` |
| Review authority | AIOS Platform Technical Resolution Board (PTRB) |
| Resolution date | 2026-07-30 |

**This document resolves the technical substance of every condition raised by the Technical Review. It does not modify the Technical Specification, any ADR, any governance document, or any source file. Every recommendation below requires its own separate, future documentation action (amending PRTS-1's text) before it is formally incorporated — that action is not performed here.**

---

## 1. Executive Summary

Fresh, direct repository investigation — performed independently for this resolution, not assumed from the original Technical Review — resolved all three outstanding conditions with concrete evidence and specific recommended corrections. The investigation also **sharpened** two of the three findings considerably beyond their original scope:

- **CR-T-001** is broader than originally identified. A complete, repository-wide scan of all 75 controllers confirmed only 2 fully-open controller files (`health.controller.ts`, `observability.controller.ts`), but deeper inspection found that several otherwise-guarded controllers — including `identity.controller.ts` itself (`/auth/login`, `/auth/register`, `/auth/refresh`, etc.) and individual `GET` methods in `parts.controller.ts`/`vehicles.controller.ts` — have **no method-level `@Roles`/`@RequirePermissions` decorator at all**, and are therefore also open today. A manual, static file-by-file inventory cannot reliably catch this; the correct resolution is an automated, reflector-based check applied uniformly, not a hand-maintained list.
- **CR-T-002** is confirmed exactly as the original review found it — a documentation-accuracy correction with no further complexity.
- **CR-T-003** is resolved with a definitive, evidenced conclusion: **no existing permission string can be reused for an exact-equivalence mapping for any of the three controllers' role combinations** without either over-granting (to `GENERAL_MANAGER`, which already holds nearly every "admin-flavored" permission) or under-granting (missing a role like `STOREKEEPER`). Every endpoint group requires a newly introduced, precisely-scoped permission string — additive work, already within the Platform Remediation Authorization's "Permissions normalization" scope.

All three conditions are technically resolved. What remains is a bounded, administrative act — writing these resolved recommendations into PRTS-1's own text — which this task is explicitly not authorized to perform.

**Implementation readiness: `IMPLEMENTATION_READY_WITH_FINAL_CONDITIONS`.**

---

## 2. Conditions Reviewed

### CR-T-001

| Field | Value |
|---|---|
| Identifier | CR-T-001 |
| Original Review Finding | `JwtAuthContextGuard`'s proposed global rejection of invalid credentials could break real, currently-unguarded endpoints. |
| Risk Classification | High |
| Root Cause | `JwtAuthContextGuard` is registered as a global `APP_GUARD` and runs on every request; the original specification's PRTS-001 did not condition its proposed rejection behavior on whether the target route actually requires an authorized actor. |
| Architecture Impact | None to module boundaries — the fix is a conditional check inside the same guard, not a new module or dependency edge. |
| Security Impact | If unresolved, could either (a) silently under-protect (today's status quo) or (b) over-reject if fixed naively (rejecting requests to routes that intentionally require no actor, including the authentication endpoints themselves). |
| Repository Impact | Confined to `src/identity/jwt-auth-context.guard.ts`; the check it needs to perform (whether the resolved handler carries `@RequirePermissions`/`@Roles` metadata) already exists via each guard's own `Reflector` usage — no new dependency is introduced. |
| Recommended Resolution | `JwtAuthContextGuard` must reject an invalid/expired/revoked credential **only when the resolved handler carries a `PERMISSIONS_KEY` or `ROLES_KEY` metadata entry** (i.e., the route already requires *some* actor-based check today). When no such metadata is present — confirmed to include `health.controller.ts`, `observability.controller.ts`, all of `identity.controller.ts`'s unauthenticated endpoints (`/auth/register`, `/login`, `/refresh`, `/logout`, `/mfa/*`, `/password/*`, `/email/*`), and the undecorated `GET` methods in `parts.controller.ts`/`vehicles.controller.ts` — an invalid credential is tolerated exactly as today, preserving full backward compatibility for every legitimately open route, present and future. |
| Required Technical Specification Change | PRTS-1 §4 (PRTS-001) must be revised to state this conditional design explicitly, replacing the original "reject any invalid credential unconditionally" framing. PRTS-1 §2 ("Known security gaps") should note the additional open-route instances found here. |
| Evidence Required | (Produced by this resolution) — a repository-wide scan of all 75 controllers for the complete absence of any `@UseGuards`/`@RequirePermissions`/`@Roles` decorator (found: exactly 2 files); plus a demonstrated, method-level example of a third category — otherwise-guarded controllers with individually undecorated methods (`identity.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`) — showing why a file-level inventory alone is insufficient. |
| Verification Method | Unit tests on `JwtAuthContextGuard` proving: (a) a handler with no permission/role metadata + an invalid credential → allowed, no verified actor (unchanged behavior); (b) a handler with permission/role metadata + an invalid credential → rejected; (c) a handler with permission/role metadata + a valid credential → allowed, verified actor attached. |
| Acceptance Criteria | Full existing regression suite passes; the auth endpoints (`/auth/login`, `/auth/refresh`, etc.), `health.controller.ts`, `observability.controller.ts`, and the undecorated `parts`/`vehicles` `GET` methods all continue to function for a caller presenting a stale or invalid `Authorization` header, exactly as today. |
| Resolution Status | **Technically resolved** — root cause understood, concrete design corrected and evidenced. **Pending**: incorporation of this corrected design into PRTS-1's own text (a separate, future documentation action). |

### CR-T-002

| Field | Value |
|---|---|
| Identifier | CR-T-002 |
| Original Review Finding | PRTS-1 §3 states `common/permissions`/`common/rbac` depend on `src/identity/`; the actual direction is the reverse. |
| Risk Classification | Medium |
| Root Cause | Authorship error when PRTS-1 was drafted — the actual import (`jwt-auth-context.guard.ts` importing `RequestActor` from `common/permissions/request-actor.ts`) was described backward. |
| Architecture Impact | None — re-confirmed in this resolution: `request-actor.ts` imports only `Role` from `@prisma/client`; no file in `common/permissions` or `common/rbac` imports anything from `src/identity/`. No cycle exists in either direction. |
| Security Impact | None — a documentation-accuracy matter only. |
| Repository Impact | None — no code is affected; only PRTS-1's own descriptive text is wrong. |
| Recommended Resolution | Amend PRTS-1 §3's "Dependency direction (target)" to read: "`src/identity/` depends on `src/common/permissions/` (via the `RequestActor` type it imports); no file in `common/permissions` or `common/rbac` depends on `src/identity/`; no cycle exists in either direction." |
| Required Technical Specification Change | The single sentence in PRTS-1 §3 identified above. |
| Evidence Required | The two import statements re-confirmed in this resolution: `request-actor.ts`'s only import (`Role` from `@prisma/client`) and `jwt-auth-context.guard.ts`'s import of `RequestActor` from `../common/permissions/request-actor`. |
| Verification Method | Direct code read (already performed, twice, across the Technical Review and this resolution) — no further verification method is needed for a documentation correction. |
| Acceptance Criteria | PRTS-1's text matches the confirmed import graph exactly. |
| Resolution Status | **Fully resolved** — no technical ambiguity remains; only the mechanical text edit to PRTS-1 itself remains outstanding, and is explicitly out of this task's authority to perform. |

### CR-T-003

| Field | Value |
|---|---|
| Identifier | CR-T-003 |
| Original Review Finding | PRTS-003's role-to-permission mapping for `integration`, `parts`, and `vehicles` controllers needs an explicit equivalence proof to avoid inadvertent privilege escalation. |
| Risk Classification | Medium |
| Root Cause | `ROLE_PERMISSIONS` is a broad, cumulative map (e.g., `GENERAL_MANAGER` holds nearly every "admin-flavored" permission, including `system.admin`, `integration.manage`, and `parts.manage`), so any attempt to reuse an existing permission for these three controllers' narrower, specific role combinations would grant access to roles that do not have it today. |
| Architecture Impact | None to module structure — resolved by adding new permission strings to the existing `permission.ts`/`role-permissions.ts` files, not by any new module. |
| Security Impact | If unresolved (i.e., if an implementer reused an existing "close enough" permission), `GENERAL_MANAGER` would gain access to `POST /integration/sync/vehicles`, `POST /integration/sync/parts`, and the parts match-candidates endpoints, none of which it can call today — a genuine, confirmed privilege-escalation risk. |
| Repository Impact | `src/common/permissions/permission.ts` (new permission string constants) and `src/common/rbac/role-permissions.ts` (new, precise role grants) — both additive changes to existing files, no new file, no schema change. |
| Recommended Resolution | Introduce one new, precisely-scoped permission string per distinct role-combination found in the three controllers, and grant it only to the exact roles that hold access today. Concretely, based on direct inspection of all three controllers' current `@Roles(...)` decorators: |
| Required Technical Specification Change | PRTS-1 §4 (PRTS-003) must be revised to include the mapping table below as its required "role-to-permission mapping" verification artifact, rather than leaving the exact permissions undetermined. |
| Evidence Required | The mapping table below, and the underlying `ROLE_PERMISSIONS`/`PERMISSIONS` re-read performed for this resolution (confirming, for example, that `GENERAL_MANAGER` already holds `system.admin` and `integration.manage` explicitly, and that `parts.manage` is held by `GENERAL_MANAGER` and `PARTS_MANAGER` but not `STOREKEEPER`). |
| Verification Method | For each new permission, confirm via the mapping table that its exact role grant list matches today's `@Roles(...)` list — no role added, no role removed. |
| Acceptance Criteria | Every one of the three controllers' endpoints, post-migration, is callable by exactly the same set of roles as today — confirmed via the mapping table, not assumed. |
| Resolution Status | **Technically resolved** — every needed permission identified and precisely scoped. **Pending**: incorporation into PRTS-1's text and, at implementation time, the actual code addition (out of scope for both this resolution and the original remediation authorization's documentation-only phase). |

#### CR-T-003 mapping table (the required equivalence-proof artifact)

| Controller | Endpoint | Current `@Roles(...)` | Existing permission reused? | Why not (if applicable) | Recommended new permission | Exact role grant |
|---|---|---|---|---|---|---|
| `integration` | `POST /integration/sync/vehicles`, `POST /integration/sync/parts` | `SYSTEM_ADMINISTRATOR` | No — `system.admin`/`integration.manage` are also held by `GENERAL_MANAGER` | Would grant `GENERAL_MANAGER` a capability it does not have today | `integration.sync` | `SYSTEM_ADMINISTRATOR`, `OWNER` only |
| `integration` | `GET /integration/dead-letters`, `PATCH /integration/dead-letters/:id/resolve` | `SYSTEM_ADMINISTRATOR`, `DATA_QUALITY_REVIEWER` | No — every candidate (`logs.read`, `audit.read`, `dataQuality.resolve`) is also in `ALL_READ` or `GENERAL_MANAGER`'s grants, reaching `BRANCH_MANAGER`/`AUDITOR`/`READ_ONLY_VIEWER` too | Would grant several roles beyond today's two | `integration.deadLetters.read` (read endpoint), `integration.deadLetters.resolve` (resolve endpoint) | `SYSTEM_ADMINISTRATOR`, `OWNER`, `DATA_QUALITY_REVIEWER` only |
| `parts` | `POST /parts` (create) | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER`, `STOREKEEPER` | No — `parts.manage` is held by `GENERAL_MANAGER` too, and would need to also cover `STOREKEEPER`, which holds no parts-management permission today | Would over-grant to `GENERAL_MANAGER` | `parts.create` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER`, `STOREKEEPER` only |
| `parts` | `POST /parts/match-candidates/run`, `GET /parts/match-candidates`, `PATCH /parts/match-candidates/:id/review` | `SYSTEM_ADMINISTRATOR`, `PARTS_MANAGER` | No — `parts.manage` is also held by `GENERAL_MANAGER` | Would over-grant to `GENERAL_MANAGER` | `parts.matchCandidates.manage` | `SYSTEM_ADMINISTRATOR`, `OWNER`, `PARTS_MANAGER` only |
| `parts` | `GET /parts`, `GET /parts/:id` | *(none today — open)* | N/A | N/A | None required — confirm via CR-T-001's resolution that this remains intentionally open, or add a deliberately-named `parts.read`-optional check if the Board decides these should require at least `parts.read` going forward (a scope decision for the implementer, not decided by this resolution) | N/A |
| `vehicles` | `POST /vehicles` (create), `PATCH /vehicles/:id/attribute-correction` | `SYSTEM_ADMINISTRATOR`, `BRANCH_MANAGER`, `PARTS_MANAGER` | No — no single existing permission is held by exactly these three roles and no others | Would either over- or under-grant depending on which existing permission was chosen | `vehicle.create` (create endpoint), `vehicle.correct` (correction endpoint) | `SYSTEM_ADMINISTRATOR`, `OWNER`, `BRANCH_MANAGER`, `PARTS_MANAGER` only |
| `vehicles` | `GET /vehicles`, `GET /vehicles/vin/:vin`, `GET /vehicles/:id` | *(none today — open)* | N/A | N/A | Same open-endpoint scope decision as `parts`' `GET` endpoints above | N/A |

**Note on the two open `GET`-endpoint rows above**: these were not part of the original CR-T-003 finding — they surfaced as a byproduct of this resolution's CR-T-001 investigation. They are listed here for completeness since they belong to the same two controllers, but resolving them is properly a CR-T-001 scope decision (should an open read endpoint remain open, or gain a minimum `*.read` requirement), not a CR-T-003 mapping question. No inconsistency is introduced by leaving them open — `RolesGuard`/`PermissionsGuard` both already treat "no decorator" as "no restriction," identically, so migrating the controller's guard type does not change these two endpoints' behavior either way.

---

## 3. Resolution Analysis

Both CR-T-001 and CR-T-003 turned out to be **understatements** of the real technical picture once verified against live code rather than accepted as originally scoped — a pattern consistent with this entire governance program's own discipline of never trusting a prior document's claim without independent re-verification. CR-T-001's true scope (open endpoints scattered as individual undecorated methods across multiple controllers, not confined to two fully-open files) and CR-T-003's true scope (zero existing permissions are safely reusable, not merely "some may need a new permission") are both more precisely defined here than either the original Technical Specification or the Technical Review could state without this deeper investigation. CR-T-002 required no further analysis beyond re-confirming the original finding.

---

## 4. Dependency Analysis

- **CR-T-001 and CR-T-002 are fully independent** — different files, different root causes, no shared evidence. Either may be incorporated into PRTS-1 without waiting for the other.
- **CR-T-001 and CR-T-003 are fully independent** — CR-T-001 concerns `src/identity/jwt-auth-context.guard.ts` (Phase 1 of PRTS-1's implementation sequence); CR-T-003 concerns the three controllers (Phase 3). Resolving one does not require the other to be resolved first.
- **CR-T-002 and CR-T-003 are fully independent.**
- **No condition blocks another's resolution.** All three could be incorporated into PRTS-1 in a single documentation pass, or in any order, without conflict.
- The only real sequencing constraint remains the one already established in the Technical Approval: CR-T-001 must be closed before Phase 1 implementation begins; CR-T-003 must be closed before Phase 3 implementation begins. This resolution does not change that sequencing — it fulfills the evidentiary content those gates require.

---

## 5. Specification Consistency Review

| Document | Consistency check | Result |
|---|---|---|
| Platform Remediation Authorization | Do the recommended resolutions stay within "identity/authorization layer only," "no schema," "no API," "no DGX feature"? | **Consistent** — CR-T-001's fix is confined to `jwt-auth-context.guard.ts`; CR-T-003's new permission strings are additive entries in existing `permission.ts`/`role-permissions.ts` files, not a new capability, schema, or endpoint. |
| Technical Specification (PRTS-1) | Do the resolutions contradict PRTS-1's own design (PRTS-002's opt-in verified-actor mechanism)? | **Consistent, and complementary** — CR-T-001's conditional-rejection check (does the route require *any* actor-based check) and PRTS-002's opt-in mechanism (does this specific permission require a *cryptographically verified* actor) are two distinct, compatible reflector-based checks that can coexist without conflict. |
| Technical Approval | Do the resolutions satisfy the Approval's required evidence for CR-T-001 and CR-T-003? | **Consistent, and more rigorous** — the Approval asked for "a complete inventory" (CR-T-001) and "a per-controller mapping table" (CR-T-003); this resolution provides both, and additionally recommends a more robust *mechanism* (automated reflector check) than a static list, which is a strengthening, not a deviation. |
| Governance Closure Program | Does this resolution change GATE-SEC-001/GATE-SEC-002's status? | **Consistent — unchanged.** Both gates remain open; this resolution only prepares the evidentiary and design basis for their eventual closure, once the (separately authorized) implementation and independent verification actually occur. |
| `DGX3-ADR-0001` | Does any resolution touch `vehicle-lifecycle`/`twin-intelligence` or the ownership boundary it established? | **Consistent — no.** No file in either directory appears anywhere in this resolution. |
| DGX 3.0 Specification | Does any resolution weaken or alter §26/§29's requirements? | **Consistent — no.** The resolutions strengthen, not weaken, the eventual remediation's ability to satisfy those sections. |

**No contradiction was found between any recommended resolution and any authoritative input.**

---

## 6. Condition Closure Matrix

| Condition | Severity | Current Status | Evidence Required | Verification Method | Blocking Implementation? | Closure Decision |
|---|---|---|---|---|---|---|
| CR-T-001 | High | Technically resolved; specification text update pending | Repository-wide open-route scan (provided above) | Unit tests on `JwtAuthContextGuard`'s three scenarios (provided above) | **Yes — blocks Phase 1** until PRTS-1's text reflects this resolution and the implementer follows it | Not yet closed — awaiting PRTS-1 text update (administrative, not technical) |
| CR-T-002 | Medium | Fully resolved | Two import statements (provided) | Direct code read (already done) | No — does not block any implementation phase | Not yet closed — awaiting PRTS-1 text update (administrative only) |
| CR-T-003 | Medium | Technically resolved; specification text update pending | Full mapping table (provided above) | Per-permission role-grant equivalence check (provided above) | **Yes — blocks Phase 3** until PRTS-1's text reflects this resolution | Not yet closed — awaiting PRTS-1 text update (administrative, not technical) |

---

## 7. Remaining Risks

| Severity | Description | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Critical | None identified. | — | — | — |
| High | None identified — CR-T-001's technical resolution removes the previously-identified High risk; what remains is administrative (writing the resolution into PRTS-1), not a technical risk in itself. | — | — | — |
| Medium | An implementer could still misapply CR-T-001's conditional-rejection logic (e.g., checking the wrong reflector key, or checking it after rather than before attempting verification) if PRTS-1's text is not updated precisely enough before implementation begins. | Low-Medium | Medium | The PRTS-1 text update should reference the exact reflector keys (`PERMISSIONS_KEY`, `ROLES_KEY`) already used by the existing guards, not a new, parallel mechanism. |
| Medium | The two newly-surfaced open `GET` endpoints in `parts`/`vehicles` (and any equivalent elsewhere) represent a real, pre-existing design choice (read access requiring no permission) that this remediation does not itself decide whether to tighten. | Low | Low-Medium | Explicitly out of scope for this remediation; flag as a separate, future governance question if the Business/Operational Owner (once assigned, per the Governance Closure Program) wants read-endpoint access tightened. |
| Low | The recommended new permission strings (`integration.sync`, `parts.create`, etc.) must be added consistently to both `permission.ts`'s `PERMISSIONS` array and `role-permissions.ts`'s per-role grants — a simple but easy-to-get-partially-wrong mechanical step. | Low | Low | Covered by CR-T-003's own verification method (equivalence check per permission). |

---

## 8. Implementation Readiness Assessment

Every technical question raised by CR-T-001, CR-T-002, and CR-T-003 has been answered with concrete, evidenced recommendations:
- CR-T-001: exact conditional logic defined, exact affected routes enumerated, exact test scenarios defined.
- CR-T-002: exact corrected text provided.
- CR-T-003: exact new permissions and their exact role grants defined, for every endpoint in scope.

No open technical uncertainty remains for any of the three conditions. What remains before implementation may correctly be described as **bounded and administrative**: incorporating these already-resolved recommendations into `DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md`'s own text — a documentation update, not further technical investigation, and one this task is explicitly not authorized to perform itself.

**Is the Technical Specification now implementation-ready?** Substantively, yes — but not unconditionally, since PRTS-1's own text has not yet been amended to reflect these resolutions, and an implementer working from PRTS-1's current, unrevised text would still encounter the same three gaps this resolution just closed analytically. This supports **`IMPLEMENTATION_READY_WITH_FINAL_CONDITIONS`**, not unconditional `IMPLEMENTATION_READY`.

---

## 9. Final Implementation Readiness

**`IMPLEMENTATION_READY_WITH_FINAL_CONDITIONS`**

The only remaining condition is administrative: PRTS-1 must be updated (in a separate, future, properly-authorized documentation action) to incorporate §2's three recommended resolutions verbatim or in substance, before an implementer begins Phase 1 or Phase 3 of the remediation sequence. No further technical analysis, investigation, or repository inspection is required to close any of the three conditions themselves.

---

## 10. What This Resolution Does Not Authorize

This document does not modify `DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md`, does not modify any ADR or governance document, does not modify any source file, does not authorize implementation of any remediation activity, and does not authorize DGX 3.0 engineering. It is a technical resolution record, to be acted on by a separate, future, properly-authorized documentation update and, later, implementation action.

---

*End of Platform Remediation Technical Review — Condition Resolution #1. TECHNICAL CONDITION RESOLUTION, NOT AN IMPLEMENTATION AUTHORIZATION.*
