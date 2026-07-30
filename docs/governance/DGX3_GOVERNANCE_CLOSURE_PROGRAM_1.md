# DGX 3.0 Governance Closure Program #1

### The Official Plan for Closing Every Remaining Pre-Engineering Governance Gate Before Engineering Authorization Review #2

---

## Document Control

| Field | Value |
|---|---|
| Document | DGX 3.0 Governance Closure Program #1 |
| Capability | DGX 3.0 — Predictive Maintenance |
| Produced by | DGX 3.0 Governance Program Management Office (GPMO) |
| Status | **PLANNING DOCUMENT — AUTHORIZES NOTHING** |
| Effective date | 2026-07-30 |
| Authoritative inputs | `docs/capabilities/DGX_3_PREDICTIVE_MAINTENANCE_SPECIFICATION_V1.md`; `docs/reviews/DGX3_SPECIFICATION_FORMAL_REVIEW_1.md`; `docs/adr/DGX3-ADR-0001_EXISTING_OPERATIONAL_CORE_OWNERSHIP.md`; `docs/governance/AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md`; `docs/architecture/AIOS_REFERENCE_ARCHITECTURE_V1.md`; `docs/strategy/AIOS_ENTERPRISE_ROADMAP_V1.md`; Engineering Authorization Review #1 (`ENGINEERING_NOT_AUTHORIZED`) |

**This document is a plan, not a decision.** It does not authorize engineering, change DGX 3.0's maturity (**Specified**), change its certification status (**Not Started**), approve any ADR, or modify any specification. It identifies the governance work that must exist before Engineering Authorization Review #2 can be meaningfully convened, in what order, and why. Every completion criterion below is a target for a future, separately-authorized governance action — none is satisfied by this document's own existence.

---

## 1. Executive Summary

Engineering Authorization Review #1 found `ENGINEERING_NOT_AUTHORIZED`: of the specification's own §50 Pre-Engineering Entry Gates, only two were closed (specification approval; `DGX3-ADR-0001` acceptance). This program inventories every remaining gate — 21 in total across ownership, architecture, security, data, certification, execution, and repository-governance domains — determines their dependencies, and produces a recommended execution order and critical path. The single largest driver of sequencing is that **five gates require a role to be named before any further work in that domain can proceed** (Business Owner, Operational Owner, Security Reviewer, Legal Reviewer, and — later, non-blocking for Phase A — Model Owner). Naming these roles is therefore the first recommended action of this program. The remaining nine required ADRs, the security remediation, the data-readiness report, certification-preparation authorization, and the engineering execution plan can then proceed largely in parallel, converging on a final execution-plan synthesis immediately before Engineering Authorization Review #2.

---

## 2. Governance Assessment

| Milestone | Status | Source |
|---|---|---|
| AI Foundation | Certified | `AI_FOUNDATION_CERTIFIED` |
| DGX 2.0 | Specified (Phase A implemented, closed, not yet Certified) | Roadmap, Governance Standard §24 |
| DGX 3.0 Specification | **Specified** | `APPROVED_AS_SPECIFIED`, Formal Review #1 Condition Closure Addendum |
| DGX3-ADR-0001 | **Accepted** | Resolves capability-boundary ownership only |
| DGX3-ADR-0002 through 0010 | **Not created** | Confirmed absent — `docs/adr/` contains only `DGX3-ADR-0001` |
| Business Owner | **Not assigned** | Specification §47, Risk Register (§46) |
| Operational Owner | **Not assigned** | Specification §47, Risk Register (§46) |
| Security Reviewer | **Not assigned** | Specification §47 |
| Legal Reviewer | **Not assigned** | Specification §47 |
| Model Owner | **Not assigned** | Specification §47 (not urgent — no model in Phase A) |
| Security remediation (§26) | **Not performed** | Re-confirmed against live code: `JwtAuthContextGuard.canActivate` still unconditionally `return true`; `RolesGuard` still actively used in `integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts` |
| DGX 3.0 data-readiness report | **Does not exist** | `docs/data-readiness/` contains only AI Foundation/DGX 2.0-scoped reports |
| DGX 3.0 certification-standard authorization | **Not granted** | No such authorization recorded anywhere |
| Engineering execution plan | **Does not exist** | No file found |
| Engineering Authorization Review #1 | **`ENGINEERING_NOT_AUTHORIZED`** | Prior task in this program |

This assessment confirms Engineering Authorization Review #1's finding remains accurate as of this document's effective date, and quantifies the remaining work precisely rather than leaving it as a general statement.

---

## 3. Remaining Governance Gates

Each gate below is independently defined per this program's required format: Identifier, Title, Purpose, Inputs, Deliverables, Dependencies, Estimated complexity, Recommended owner, Completion criteria.

### Ownership & Accountability

**GATE-OWN-001 — Business Owner Assignment**
- Purpose: Name the single accountable business role for DGX 3.0's scope, KPI targets, and acceptance of engineering output, per Governance Standard §12.
- Inputs: Specification §3 (Business Objectives), §46 (Risk Register), §47 (Governance).
- Deliverables: A named individual/role recorded in the specification's Document Control and §47 table, with documented acceptance.
- Dependencies: None — can begin immediately.
- Estimated complexity: Low (an organizational decision, not an analytical one) — but it is a hard blocking dependency for several other gates.
- Recommended owner: Architecture Authority / Approval Committee (per Governance Standard §12).
- Completion criteria: A named Business Owner appears in the specification's Document Control with recorded, dated acceptance of the role.

**GATE-OWN-002 — Operational Owner Assignment**
- Purpose: Name the accountable operational role for day-to-day adoption, workshop-side rollout, and feedback-loop ownership (§30).
- Inputs: Specification §5 (Users and Accountability), §47.
- Deliverables: Same as GATE-OWN-001, for the Operational Owner role.
- Dependencies: None — can run in parallel with GATE-OWN-001.
- Estimated complexity: Low.
- Recommended owner: Architecture Authority / Approval Committee.
- Completion criteria: A named Operational Owner recorded with dated acceptance.

**GATE-OWN-003 — Security Reviewer Assignment**
- Purpose: Name the accountable reviewer for the §26 security remediation and its pre-pilot/pre-production validation.
- Inputs: Specification §26, §47.
- Deliverables: Named Security Reviewer.
- Dependencies: None.
- Estimated complexity: Low.
- Recommended owner: Architecture Authority.
- Completion criteria: A named Security Reviewer recorded with dated acceptance; directly unblocks GATE-SEC-001/GATE-SEC-002.

**GATE-OWN-004 — Legal Reviewer Assignment**
- Purpose: Name the accountable reviewer for §40 (Legal and Regulatory Position) and `DGX3-ADR-0010`'s required sign-off (Safety-Relevant Recommendation Policy, per §48's Change Control table).
- Inputs: Specification §40, §48.
- Deliverables: Named Legal Reviewer.
- Dependencies: None.
- Estimated complexity: Low.
- Recommended owner: Architecture Authority / Business Owner (once named).
- Completion criteria: A named Legal Reviewer recorded with dated acceptance; directly unblocks `DGX3-ADR-0010`.

**GATE-OWN-005 — Model Owner Assignment**
- Purpose: Name the future accountable role for model/policy version activation (§31, §47), relevant to `DGX3-ADR-0008`.
- Inputs: Specification §31, §47.
- Deliverables: Named Model Owner.
- Dependencies: None.
- Estimated complexity: Low.
- Recommended owner: Architecture Authority.
- Completion criteria: A named Model Owner recorded. **Non-blocking for Phase A engineering** — Phase A uses no model (§18) — but required before `DGX3-ADR-0008` can be meaningfully accepted, and §50 reads all ten ADRs as mandatory regardless of phase (see ADR Roadmap, §5, for the resulting scheduling note).

### Architecture

**GATE-ARCH-001 — Full Architecture Review Sign-off**
- Purpose: `DGX3-ADR-0001` resolved only the capability-boundary ownership question. The specification's §50 gate "Architecture Review is approved" is broader — it covers the specification's architecture as a whole (§21–§25), not only the ownership question. This gate closes that broader review as its own, distinct, recorded action.
- Inputs: Specification §21 (Operational Core Integration), §22 (DGX AI Platform Integration), §23 (Capability Isolation), §24 (API Contract Requirements), §25 (Event Model); `DGX3-ADR-0001`.
- Deliverables: A recorded Architecture Board sign-off confirming the specification's architecture is sound and consistent with `AIOS_REFERENCE_ARCHITECTURE_V1.md` and the Capability Governance Standard.
- Dependencies: Benefits from, but does not strictly require, GATE-ARCH-002 (`DGX3-ADR-0006`, Vehicle History System of Record) being resolved first, since that ADR is a direct extension of the same architectural question `DGX3-ADR-0001` already answered.
- Estimated complexity: Low — the Formal Review already assessed this territory in detail (Domain 3, Domain 10) and found it clean; this gate is a ratification of already-reviewed material, not new analysis.
- Recommended owner: Architecture Board.
- Completion criteria: A dated, recorded Architecture Board approval distinct from `DGX3-ADR-0001`.

**GATE-ARCH-002 through GATE-ARCH-010** — the nine remaining required ADRs (`DGX3-ADR-0002` through `DGX3-ADR-0010`). Defined in full in the **ADR Roadmap** (§5 below) rather than repeated here, to avoid duplication.

### Security

**GATE-SEC-001 — Security Remediation Design & Authorization**
- Purpose: Scope and approve *what* remediation is required to normalize the mixed authorization model (`PermissionsGuard`'s `x-user-role` fallback; `RolesGuard`'s continued active use in three real controllers; the non-rejecting global JWT guard) before any DGX 3.0-relied-upon endpoint is engineered, per specification §26's "Pre-engineering remediation requirement." **This gate is governance work only** — it defines and approves the remediation's scope and acceptance criteria; it does not perform the remediation itself, which is real engineering work requiring its own, separate authorization (a small, bounded engineering ticket, not part of DGX 3.0 Phase A engineering itself).
- Inputs: Specification §26; direct code evidence (`jwt-auth-context.guard.ts`, `permissions.guard.ts`, `roles.guard.ts`).
- Deliverables: A short remediation-scope document, reviewed and approved by the Security Reviewer (GATE-OWN-003) and Architecture Board, defining exactly what "normalized to a single, verified-actor path" (§26) means in concrete, testable terms.
- Dependencies: GATE-OWN-003 (Security Reviewer named).
- Estimated complexity: Medium — requires precise scoping to avoid either under-specifying (leaving the ambiguity intact) or over-specifying (implicitly authorizing a broader security rewrite than DGX 3.0 needs).
- Recommended owner: Security Reviewer.
- Completion criteria: An approved remediation-scope document exists, with explicit, testable acceptance criteria.

**GATE-SEC-002 — Security Remediation Completion Evidence**
- Purpose: Independently verify, after the remediation scoped in GATE-SEC-001 has been implemented (via its own, separately authorized engineering action — out of this program's and this task's scope), that it satisfies §26's requirement.
- Inputs: GATE-SEC-001's approved scope; the completed remediation's code evidence.
- Deliverables: A completion-evidence record confirming the mixed-model gaps no longer apply to any DGX-3.0-relied-upon endpoint.
- Dependencies: GATE-SEC-001; the (separately authorized) remediation engineering work itself.
- Estimated complexity: Low (verification only) once the underlying remediation exists.
- Recommended owner: Security Reviewer.
- Completion criteria: A dated, evidence-backed confirmation that DGX 3.0's Safety-Relevant permissions no longer depend on the unverified header-fallback path.

### Data Readiness

**GATE-DATA-001 — DGX 3.0 Data Readiness Report**
- Purpose: Produce the formal data-readiness report specification §50 explicitly requires, "mirroring DGX 2.0's own precedent" (`docs/data-readiness/final-readiness-report.md` and its supporting reports).
- Inputs: Specification §9 (Data Domain Model), §10 (Data Source Register), §11 (Data Quality and Readiness); direct schema/code re-verification (already performed once, during the Formal Review and ADR-0001 tasks, and re-confirmed as unchanged in Engineering Authorization Review #1).
- Deliverables: A dedicated `docs/data-readiness/dgx3-*.md` report (or set of reports) confirming, with fresh evidence, exactly which real data sources are ready for Phase A, which are absent, and which are "real but unconfirmed as populated" (e.g., manufacturer service-interval content in the Knowledge Platform).
- Dependencies: None strictly — can proceed in parallel with ownership assignment and the ADR sequence. Benefits from Business Owner input on acceptance thresholds.
- Estimated complexity: Medium — most of the underlying evidence-gathering has already been performed across three prior tasks in this program; the work here is formalizing it into the dedicated report format DGX 2.0's precedent established, not new discovery.
- Recommended owner: Data Steward.
- Completion criteria: A dedicated, approved DGX 3.0 data-readiness report exists and is accepted by the Business Owner and Architecture Authority.

### Certification Preparation

**GATE-CERT-001 — Certification-Preparation Authorization**
- Purpose: Separately authorize the *preparatory governance work* for a future DGX 3.0 Certification Standard — not the standard itself (specification §33 explicitly reserves that as future, separate work).
- Inputs: Specification §32 (Evaluation Framework), §33 (Certification Design), §34 (Certification Dataset Requirements).
- Deliverables: A recorded authorization permitting certification-standard *drafting* to begin once relevant ADRs (`DGX3-ADR-0003` Risk Score Semantics, `DGX3-ADR-0005` Failure Taxonomy Ownership) are accepted; explicitly does not authorize the standard's approval or use.
- Dependencies: `DGX3-ADR-0003`, `DGX3-ADR-0005` (certification planning needs stable risk-semantics and taxonomy definitions to reference); GATE-OWN-001 (Business Owner authorization).
- Estimated complexity: Low — an authorization decision, not an analytical one, once its ADR dependencies are satisfied.
- Recommended owner: Certification Authority (per Governance Standard §15's Engineering/Certification independence).
- Completion criteria: A recorded, dated authorization to begin certification-standard drafting, explicitly scoped as preparation, not approval.

### Execution Planning

**GATE-EXEC-001 — DGX 3.0 Engineering Execution Plan**
- Purpose: Produce the engineering execution plan specification §50 requires, "mirroring DGX 2.0's own `AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md` precedent" — scope, milestones, ownership, review gates, acceptance criteria for the actual Phase A build.
- Inputs: All prior gates' outputs (finalized ADRs, security remediation evidence, data-readiness report, certification-preparation authorization).
- Deliverables: A dedicated execution-plan document, following DGX 2.0's precedent structure.
- Dependencies: Effectively all other gates — this is deliberately the last synthesis step, since an execution plan written before the ADRs/security/data work is finalized would itself need revision.
- Estimated complexity: Medium-High — the most integrative deliverable in this program, since it must reconcile every other gate's output into one coherent plan.
- Recommended owner: Engineering Authority (once assigned) + Business Owner + Operational Owner jointly.
- Completion criteria: A recorded, dated approval of the execution plan by Architecture Board + Business Owner.

### Repository Governance

**GATE-REPO-001 — ADR Index Synchronization**
- Purpose: `docs/adr/README.md`'s index table was not updated when `DGX3-ADR-0001` was created (flagged explicitly in the prior ADR task, since that task's scope was restricted to a single file). The repository's own ADR process (`docs/adr/README.md` §"Future ADR process", item 5) expects the index to be updated in the same change that adds or changes an ADR's status.
- Inputs: `docs/adr/README.md`, `docs/adr/DGX3-ADR-0001_EXISTING_OPERATIONAL_CORE_OWNERSHIP.md`.
- Deliverables: An updated index row for `DGX3-ADR-0001` (and, as each subsequent ADR is accepted, a corresponding new row).
- Dependencies: None.
- Estimated complexity: Low.
- Recommended owner: Architecture Authority.
- Completion criteria: The index accurately lists every accepted DGX3 ADR.
- **Priority: Optional / non-blocking** — this gate is not named anywhere in specification §50 and does not block Engineering Authorization Review #2. It is included here for completeness and repository hygiene, and may be actioned at any convenient time, including after EAR#2.

---

## 4. Dependency Analysis

| Gate | Depends on | Can run in parallel with | Mandatory for EAR#2? |
|---|---|---|---|
| GATE-OWN-001 (Business Owner) | None | GATE-OWN-002, -003, -004, -005 | **Yes** |
| GATE-OWN-002 (Operational Owner) | None | GATE-OWN-001, -003, -004, -005 | **Yes** |
| GATE-OWN-003 (Security Reviewer) | None | All GATE-OWN-* | **Yes** |
| GATE-OWN-004 (Legal Reviewer) | None | All GATE-OWN-* | **Yes** |
| GATE-OWN-005 (Model Owner) | None | All GATE-OWN-* | **Yes** (per literal §50 reading — see ADR Roadmap note) |
| GATE-ARCH-001 (Full Architecture Review) | Benefits from ADR-0006 | ADR sequence, GATE-DATA-001 | **Yes** |
| `DGX3-ADR-0006` (Vehicle History SOR) | `DGX3-ADR-0001` (done) | Everything except GATE-ARCH-001 | **Yes** |
| `DGX3-ADR-0002` (Use-Case Scope) | GATE-OWN-001, -002 | `DGX3-ADR-0006`, -0009 | **Yes** |
| `DGX3-ADR-0009` (Event-Driven vs. On-Demand) | `DGX3-ADR-0002` (loosely) | `DGX3-ADR-0006` | **Yes** |
| `DGX3-ADR-0005` (Failure Taxonomy Ownership) | None strictly | `DGX3-ADR-0002` | **Yes** |
| `DGX3-ADR-0003` (Risk Score Semantics) | `DGX3-ADR-0002` | `DGX3-ADR-0005` | **Yes** |
| `DGX3-ADR-0004` (Rule vs. Model Engine) | `DGX3-ADR-0003` | — | **Yes** |
| `DGX3-ADR-0007` (Outcome Feedback Governance) | `DGX3-ADR-0002`, `DGX3-ADR-0003` | `DGX3-ADR-0008` | **Yes** |
| `DGX3-ADR-0008` (Model Registry and Activation) | GATE-OWN-005 | `DGX3-ADR-0007` | **Yes** (per literal §50 reading) |
| `DGX3-ADR-0010` (Safety-Relevant Recommendation Policy) | GATE-OWN-001, GATE-OWN-004, `DGX3-ADR-0002`, `DGX3-ADR-0003` | — (recommended last) | **Yes** |
| GATE-SEC-001 (Remediation Design) | GATE-OWN-003 | ADR sequence, GATE-DATA-001 | **Yes** |
| GATE-SEC-002 (Remediation Evidence) | GATE-SEC-001 + the (separate) remediation engineering work | — | **Yes** |
| GATE-DATA-001 (Data Readiness Report) | None strictly; benefits from GATE-OWN-001 | ADR sequence, GATE-SEC-001 | **Yes** |
| GATE-CERT-001 (Certification-Prep Authorization) | `DGX3-ADR-0003`, `DGX3-ADR-0005`, GATE-OWN-001 | GATE-EXEC-001 planning start | **Yes** |
| GATE-EXEC-001 (Execution Plan) | All of the above | — (deliberately last) | **Yes** |
| GATE-REPO-001 (ADR Index Sync) | None | Everything | **No — optional** |

**Parallelization opportunity**: all five GATE-OWN-* role assignments can and should start on day one, in parallel, since nothing else in this program can proceed efficiently without them. Once Business and Operational Owners are named, the ADR sequence, GATE-DATA-001, and GATE-SEC-001 can all run concurrently.

---

## 5. ADR Roadmap

| ADR | Title | Purpose | Priority | Dependency | Expected deliverable | Engineering impact |
|---|---|---|---|---|---|---|
| `DGX3-ADR-0001` | Existing Operational Core Ownership Decision | Resolve capability-boundary ownership | — | — | **Accepted (done)** | Establishes consume-not-duplicate pattern |
| `DGX3-ADR-0006` | Vehicle History System of Record | Confirm `vehicle-lifecycle`'s existing timeline/digital-twin services remain the system of record DGX 3.0 reads from | High | `DGX3-ADR-0001` | A short, direct extension of ADR-0001's reasoning | Low — mostly ratifies what ADR-0001 already established |
| `DGX3-ADR-0002` | Initial Use-Case Scope | Lock the exact Phase A use-case set (specification §6, §7) as binding, not merely descriptive | High | GATE-OWN-001, -002 | A locked, binding Phase A use-case list | Defines exactly what Phase A engineering must build — no more, no less |
| `DGX3-ADR-0009` | Event-Driven vs. On-Demand Assessment | Confirm Phase A is on-demand-triggered only (per specification §41's workflow), deferring event-driven assessment to a later phase | Medium | `DGX3-ADR-0002` | A short ADR ratifying on-demand-only for Phase A | Low — Phase A's own workflow diagram already assumes this |
| `DGX3-ADR-0005` | Failure Taxonomy Ownership | Decide who owns and governs the failure taxonomy (specification §12) as it expands beyond today's real `SystemCategory` classification | Medium | None strictly | A taxonomy-governance ownership decision | Scopes how DGX 3.0 may extend `twin-intelligence-math.ts`'s `SystemCategory` without an ungoverned taxonomy sprawl |
| `DGX3-ADR-0003` | Risk Score Semantics | Formally define what the risk score means (specification §14: not a calibrated probability) as binding semantics, not just a specification recommendation | High | `DGX3-ADR-0002` | Binding risk-score semantics | Directly gates GATE-CERT-001 and influences `DGX3-ADR-0004`/-0007 |
| `DGX3-ADR-0004` | Rule Engine vs. Model Engine (and the precedence order proposed in specification §19) | Formally adopt (or revise) the proposed precedence order as binding governance, not merely proposed | High | `DGX3-ADR-0003` | Binding precedence order | Directly shapes how Phase A's deterministic rules and any future model would ever interact |
| `DGX3-ADR-0007` | Outcome Feedback Governance | Define how real outcomes (confirmed failures, false positives/negatives) feed back into the capability without automatic retraining (specification §30) | Medium | `DGX3-ADR-0002`, `DGX3-ADR-0003` | Binding feedback-governance rules | Scopes the `Outcome`/`Feedback` entities' governance before they are engineered |
| `DGX3-ADR-0008` | Model Registry and Activation (and its relationship to the existing, LLM-specific `model-registry/` module) | Decide whether DGX 3.0's future model registry needs are met by extending `model-registry/` or require a new mechanism | Lower for Phase A (no model exists yet); still formally required by §50's literal wording | GATE-OWN-005 | A model-registry relationship decision | None for Phase A itself; required only because §50 lists all ten ADRs as mandatory regardless of phase |
| `DGX3-ADR-0010` | Safety-Relevant Recommendation Policy | Formally ratify the Safety Decision Matrix (specification §27) as binding policy, with Legal Reviewer and Business Owner sign-off per specification §48's Change Control table | High | GATE-OWN-001, GATE-OWN-004, `DGX3-ADR-0002`, `DGX3-ADR-0003` | Binding safety policy | The highest-consequence ADR in this set — gates any Safety-Relevant permission from being engineered |

**Recommended writing sequence**: `DGX3-ADR-0006` → `DGX3-ADR-0002` → `DGX3-ADR-0009` → `DGX3-ADR-0005` → `DGX3-ADR-0003` → `DGX3-ADR-0004` → `DGX3-ADR-0007` → `DGX3-ADR-0008` → `DGX3-ADR-0010` (last, since it depends on the most other decisions and carries the highest consequence).

**Board discretion item (not decided by this program)**: specification §50 reads literally as requiring *all ten* ADRs accepted before *any* Phase A engineering begins, even though `DGX3-ADR-0008` (Model Registry) and part of `DGX3-ADR-0004` concern later-phase, model-based work Phase A does not need. This program treats the literal reading as binding by default, since amending that reading would require a specification change this task is not authorized to make. If the Architecture Board wishes to shorten the critical path by permitting Phase-A-relevant ADRs alone to gate Phase A engineering (deferring `DGX3-ADR-0008` and the model-based portion of `DGX3-ADR-0004` until closer to Phase B), that would itself require a separate, explicit governance decision — this program flags the option but does not adopt it.

---

## 6. Security Governance Program

This program defines the governance work required before engineering — it does not perform, design in detail, or authorize the underlying code remediation itself.

**Required reviews**:
- A review of every real endpoint DGX 3.0 would rely on (per specification §21, §24) to confirm which currently route through `PermissionsGuard`, which through `RolesGuard`, and which have no verified-actor requirement at all.
- A review of `RolesGuard`'s three current real usages (`integration.controller.ts`, `parts.controller.ts`, `vehicles.controller.ts`) to confirm whether any DGX-3.0-relied-upon path shares a base route or a shared underlying service with them.

**Required approvals**:
- Security Reviewer approval of the remediation scope (GATE-SEC-001).
- Architecture Board approval that the scoped remediation is proportionate (neither under- nor over-scoped).

**Required evidence**:
- Direct code confirmation (matching this program's own re-verification method) that, post-remediation, no Safety-Relevant DGX 3.0 permission can be satisfied via the unverified `x-user-role` header-fallback path in either `PermissionsGuard` or `RolesGuard`.

**Completion criteria**: GATE-SEC-001 and GATE-SEC-002 both closed, per their definitions in §3 above.

---

## 7. Data Readiness Program

**Required reports**: one dedicated DGX 3.0 data-readiness report (or a small set, mirroring DGX 2.0's `docs/data-readiness/` pattern), covering:
- Every entity specification §9 marks "Real, existing," re-confirmed against current schema.
- Every entity marked "Not real" or "Partially real," with an explicit statement of what would need to change for it to become real (out of scope for this program to specify further, since that would be engineering/data-source design).
- The Knowledge Platform's `SERVICE_INTERVAL` structured-fact mechanism (§10, §20): confirmation of whether real, populated manufacturer schedule content exists today, since the specification explicitly could not confirm this.

**Evidence required**: direct schema queries and code reads (as already performed three times across this program's prior tasks), re-run fresh at the time this report is actually produced, since data can change between now and then.

**Data sources**: `Vehicle`, `GarageJob`, `DiagnosticCode`, `CustomerComplaint`, `InspectionResult`, `RepeatRepairFlag`, `RoadTest`, and the Knowledge Platform's `StructuredFact` model.

**Scope**: Phase A only — the specification's own §7 scope, not later phases' component-level or telematics-dependent use cases.

**Acceptance criteria**: the report must be accepted by the Business Owner (once named) and the Architecture Authority, and must not assert readiness for any data source it cannot directly verify.

---

## 8. Certification Preparation Program

**Certification planning work** (governance only, per this program's explicit scope): identify which of specification §33's proposed certification gates (dataset integrity, failure-label integrity, leakage prevention, calibration, false-negative/positive ceilings, minimum useful lead time, explanation correctness, source traceability, authorization correctness, branch isolation, audit completeness, rollback, human override, operational adoption, business KPI movement) are even measurable under Phase A's deterministic-only design, versus which require a later-phase model to exist first.

**Evidence collection**: none is created by this program; GATE-DATA-001's report is the evidence base a future certification-standard drafting effort would start from.

**Governance artifacts**: GATE-CERT-001's authorization record is the only artifact this program produces in this domain — explicitly an authorization to *begin drafting*, not a certification standard itself.

**Future engineering obligations**: a dedicated DGX 3.0 Certification Standard (mirroring `DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md`) remains entirely future work, outside this program's and this task's scope to create.

---

## 9. Execution Planning Program

**Scope**: Phase A only, exactly as bounded by specification §7 and locked by `DGX3-ADR-0002`.

**Milestones** (illustrative structure only — the actual plan is GATE-EXEC-001's own deliverable, not this program's): specification-derived module scaffolding → deterministic-rule composition against `vehicle-lifecycle`/`twin-intelligence` (per `DGX3-ADR-0001`) → new governance entities (`RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome`) → human acknowledgment/override workflow → audit/evidence-citation wiring → internal validation → (separately gated) certification readiness.

**Ownership**: Business Owner and Operational Owner jointly accountable for scope and adoption; an Engineering Authority (not yet named — itself worth flagging as a possible additional GATE-OWN item at execution-planning time) accountable for delivery.

**Review gates**: Architecture Board review of the plan before approval; re-confirmation that every one of this program's other gates closed before the plan is executed against.

**Acceptance criteria**: the plan must not authorize itself — it becomes actionable only once Engineering Authorization Review #2 independently authorizes engineering.

---

## 10. Governance Readiness Matrix

| ID | Gate | Status | Priority | Owner | Dependency | Evidence Required | Completion Criteria | Engineering Blocker |
|---|---|---|---|---|---|---|---|---|
| GATE-OWN-001 | Business Owner Assignment | Not Started | Mandatory | Architecture Authority | None | Recorded, dated acceptance | Named in spec Document Control | Yes |
| GATE-OWN-002 | Operational Owner Assignment | Not Started | Mandatory | Architecture Authority | None | Recorded, dated acceptance | Named in spec Document Control | Yes |
| GATE-OWN-003 | Security Reviewer Assignment | Not Started | Mandatory | Architecture Authority | None | Recorded, dated acceptance | Named in spec §47 | Yes |
| GATE-OWN-004 | Legal Reviewer Assignment | Not Started | Mandatory | Architecture Authority | None | Recorded, dated acceptance | Named in spec §47 | Yes |
| GATE-OWN-005 | Model Owner Assignment | Not Started | Mandatory (literal §50) | Architecture Authority | None | Recorded, dated acceptance | Named in spec §47 | Yes (literal reading) |
| GATE-ARCH-001 | Full Architecture Review Sign-off | Not Started | Mandatory | Architecture Board | Benefits from ADR-0006 | Recorded Board approval | Dated sign-off distinct from ADR-0001 | Yes |
| GATE-ARCH-002 | `DGX3-ADR-0006` Vehicle History SOR | Not Started | Mandatory | Architecture Board | ADR-0001 (done) | Accepted ADR text | Status: Accepted | Yes |
| GATE-ARCH-003 | `DGX3-ADR-0002` Initial Use-Case Scope | Not Started | Mandatory | Architecture Board | GATE-OWN-001/002 | Accepted ADR text | Status: Accepted | Yes |
| GATE-ARCH-004 | `DGX3-ADR-0009` Event-Driven vs. On-Demand | Not Started | Mandatory | Architecture Board | ADR-0002 | Accepted ADR text | Status: Accepted | Yes |
| GATE-ARCH-005 | `DGX3-ADR-0005` Failure Taxonomy Ownership | Not Started | Mandatory | Architecture Board | None strictly | Accepted ADR text | Status: Accepted | Yes |
| GATE-ARCH-006 | `DGX3-ADR-0003` Risk Score Semantics | Not Started | Mandatory | Architecture Board | ADR-0002 | Accepted ADR text | Status: Accepted | Yes |
| GATE-ARCH-007 | `DGX3-ADR-0004` Rule vs. Model Engine | Not Started | Mandatory | Architecture Board | ADR-0003 | Accepted ADR text | Status: Accepted | Yes |
| GATE-ARCH-008 | `DGX3-ADR-0007` Outcome Feedback Governance | Not Started | Mandatory | Architecture Board | ADR-0002, ADR-0003 | Accepted ADR text | Status: Accepted | Yes |
| GATE-ARCH-009 | `DGX3-ADR-0008` Model Registry and Activation | Not Started | Mandatory (literal §50) | Architecture Board | GATE-OWN-005 | Accepted ADR text | Status: Accepted | Yes (literal reading) |
| GATE-ARCH-010 | `DGX3-ADR-0010` Safety-Relevant Recommendation Policy | Not Started | Mandatory | Architecture Board + Legal Reviewer + Business Owner | GATE-OWN-001/004, ADR-0002/0003 | Accepted ADR text | Status: Accepted | Yes |
| GATE-SEC-001 | Security Remediation Design & Authorization | Not Started | Mandatory | Security Reviewer | GATE-OWN-003 | Approved scope document | Scope approved with testable criteria | Yes |
| GATE-SEC-002 | Security Remediation Completion Evidence | Blocked | Mandatory | Security Reviewer | GATE-SEC-001 + separate remediation engineering | Evidence record | Verified no header-fallback path for Safety-Relevant permissions | Yes |
| GATE-DATA-001 | DGX 3.0 Data Readiness Report | Not Started | Mandatory | Data Steward | None strictly | Published report | Accepted by Business Owner + Architecture Authority | Yes |
| GATE-CERT-001 | Certification-Preparation Authorization | Not Started | Mandatory | Certification Authority | ADR-0003, ADR-0005, GATE-OWN-001 | Recorded authorization | Dated authorization to begin drafting | Yes |
| GATE-EXEC-001 | Engineering Execution Plan | Not Started | Mandatory | Business Owner + Operational Owner | All above | Approved plan document | Board + Business Owner approval | Yes |
| GATE-REPO-001 | ADR Index Synchronization | Not Started | Optional | Architecture Authority | None | Updated index | Index matches accepted ADRs | No |

---

## 11. Critical Path

The minimum path to Engineering Authorization Review #2, respecting dependencies:

```
GATE-OWN-001 (Business Owner)  ─┐
GATE-OWN-002 (Operational Owner)─┼─► DGX3-ADR-0002 ─► DGX3-ADR-0003 ─► DGX3-ADR-0004 ─┐
GATE-OWN-003 (Security Reviewer)│                  └─► DGX3-ADR-0009            │
GATE-OWN-004 (Legal Reviewer)   │                                                │
GATE-OWN-005 (Model Owner)      ┘                                                │
                                                                                   │
DGX3-ADR-0001 (done) ─► DGX3-ADR-0006 ─────────────────────────────────────────┤
                                                                                   │
GATE-OWN-003 ─► GATE-SEC-001 ─► [separate remediation engineering] ─► GATE-SEC-002─┤
                                                                                   │
DGX3-ADR-0005 (parallel, independent) ─────────────────────────────────────────────┤
                                                                                   │
DGX3-ADR-0002 + DGX3-ADR-0003 ─► DGX3-ADR-0007 ────────────────────────────────────┤
GATE-OWN-005 ─► DGX3-ADR-0008 ──────────────────────────────────────────────────────┤
GATE-OWN-001 + GATE-OWN-004 + DGX3-ADR-0002/0003 ─► DGX3-ADR-0010 (last ADR) ──────┤
                                                                                   │
DGX3-ADR-0003 + DGX3-ADR-0005 + GATE-OWN-001 ─► GATE-CERT-001 ─────────────────────┤
                                                                                   │
GATE-DATA-001 (parallel throughout) ───────────────────────────────────────────────┤
                                                                                   ▼
                                                              GATE-ARCH-001 (Full Architecture Review)
                                                                                   ▼
                                                                        GATE-EXEC-001 (Execution Plan)
                                                                                   ▼
                                                        Engineering Authorization Review #2
```

**The true critical-path bottleneck is GATE-SEC-002**, since it depends on a separately authorized engineering action (the remediation itself) sitting *outside* this governance program's own authority to perform or schedule. Every other path can complete through governance action alone; this one cannot close without a small, distinct, future engineering authorization of its own. The Architecture Board should treat authorizing that narrow remediation ticket as a priority parallel action, not something to discover late.

---

## 12. Success Criteria

Engineering Authorization Review #2 may be convened only when **all** of the following are true:

1. GATE-OWN-001 through GATE-OWN-005 are all closed (five named, accepting role-holders).
2. GATE-ARCH-001 (Full Architecture Review) is closed.
3. All nine remaining ADRs (`DGX3-ADR-0002` through `DGX3-ADR-0010`) are **Accepted** (status, per `docs/adr/README.md`'s own convention) — bringing the total to all ten required by specification §49/§50.
4. GATE-SEC-001 and GATE-SEC-002 are both closed — the security remediation is scoped, approved, implemented (via its own separate authorization), and independently verified complete.
5. GATE-DATA-001 (DGX 3.0 Data Readiness Report) is closed and accepted.
6. GATE-CERT-001 (Certification-Preparation Authorization) is closed.
7. GATE-EXEC-001 (Engineering Execution Plan) is closed and approved.
8. No new material contradiction is found between any of the above and the repository's actual state at the time Engineering Authorization Review #2 is convened (i.e., a fresh, independent re-verification — matching the discipline every prior review in this program has followed — must be performed at that time, not assumed from this document).

GATE-REPO-001 is explicitly **not** a condition of Engineering Authorization Review #2 — it may close before, during, or after that review without affecting its outcome.

---

## 13. What This Program Does Not Authorize

This program does not authorize engineering, does not change DGX 3.0's maturity (**Specified**) or certification status (**Not Started**), does not accept any ADR, does not approve any specification change, and does not itself perform any of the gates it defines. Every gate above requires its own, separate, future governance or engineering action by the appropriately named authority.

---

*End of DGX 3.0 Governance Closure Program #1 — a planning document. Authorizes nothing.*
