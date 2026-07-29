# DGX3-ADR-0001: Existing Operational Core Ownership Decision

## Title

Existing Operational Core Ownership Decision — the architectural relationship between DGX 3.0 Predictive Maintenance and the existing `vehicle-lifecycle`/`twin-intelligence` implementation inside Operational Core.

## Status

**Accepted** — architecture ownership boundary resolved by the DGX 3.0 Architecture Review Board. This ADR does not itself authorize engineering. Engineering Authorization Review remains a separate, future gate (see "Engineering Authorization" below). No source code, schema, migration, API, or maturity record is changed by this ADR.

## Context

The DGX 3.0 Predictive Maintenance Specification v1.0 (`docs/capabilities/DGX_3_PREDICTIVE_MAINTENANCE_SPECIFICATION_V1.md`, commit `fc1986abe2c2cf3b6f59623f898eb812f8255855`) reached **Specified** maturity (Formal Review #1: `APPROVED_WITH_CONDITIONS`; conditions CR-001 through CR-005 closed; final closure verdict `APPROVED_AS_SPECIFIED`) while deliberately leaving one question open: the architectural relationship between DGX 3.0 and a real, pre-existing body of code inside `services/operational-core` — `src/vehicle-lifecycle/` and `src/twin-intelligence/` — that performs deterministic vehicle-health and maintenance-risk scoring today, predating DGX numbering entirely. The specification's Executive Summary recorded this explicitly:

> "Existing `vehicle-lifecycle` and `twin-intelligence` functionality may provide a Phase A foundation, but its ownership and relationship to DGX 3.0 remain unresolved pending `DGX3-ADR-0001`. No architectural conclusion about adoption, wrapping, migration, ownership, or replacement of that existing code is made or implied by this specification."

`DGX3-ADR-0001` was named as the mandatory precondition for any Implemented-stage engineering (§49, §50 of the specification) — engineering may not begin against, adopt, wrap, migrate, or replace this existing code until this ADR is accepted. This ADR performs that resolution now, using direct repository evidence, and using DGX 2.0's own ADR precedent (`ADR-0001-warehouse-capacity.md`, `ADR-0002-historical-metrics-persisted-exclusion.md`) as the governing model for how an architecture decision is recorded in this repository.

## Repository Analysis

Direct, fresh inspection of the repository (this ADR does not rely solely on the specification's own prior description) confirmed the following facts:

**Module structure and registration**
- `src/vehicle-lifecycle/` contains: `digital-twin.service.ts`, `repeat-repair.service.ts`, `repeat-repair-math.ts` (+ unit spec), `vehicle-timeline.service.ts`, `vehicle-lifecycle.controller.ts`, `vehicle-lifecycle.module.ts`, and an integration spec.
- `src/twin-intelligence/` contains: `twin-intelligence-math.ts` (+ unit spec), `twin-intelligence.controller.ts`, `twin-intelligence.module.ts`, and an integration spec.
- Both modules are registered directly in `services/operational-core/src/app.module.ts` (`VehicleLifecycleModule`, `TwinIntelligenceModule`) — they are first-class, permanent parts of the Operational Core application, not a prototype or a side experiment.

**`TwinIntelligenceModule` is not an independent computation source — it is a thin, read-only consumer of `vehicle-lifecycle`.** Its own module definition:
```ts
@Module({
  imports: [VehicleLifecycleModule],
  controllers: [TwinIntelligenceController],
})
export class TwinIntelligenceModule {}
```
And its controller's own code comment states directly: *"Thin slices of the same Digital Twin the vehicle-lifecycle module already computes — no separate aggregation, no separate scoring path."* It exposes two real, live HTTP endpoints — `GET /ai/vehicle-health/:vehicleId` and `GET /ai/predict-maintenance/:vehicleId` — both gated by the real `PermissionsGuard` under a new permission string, `ai.vehicleHealth`, and both implemented by injecting `VehicleDigitalTwinService` from `vehicle-lifecycle` via standard NestJS dependency injection — not a network call, not a duplicated query, not a re-derivation of the math.

**A second, independent real precedent for the same consumption pattern exists**: `src/ai-assistants/technician-assistant.service.ts`'s `TechnicianAssistantService` also directly injects `VehicleDigitalTwinService` from `vehicle-lifecycle` (alongside a RAG service and the repeat-repair service) to ground its own AI-assistant responses in the same real Digital Twin data. `ai-assistants.module.ts` imports `VehicleLifecycleModule` directly for this purpose.

**No real caller of the existing `/ai/vehicle-health` or `/ai/predict-maintenance` endpoints was found** in `services/web-portal/src/` (empty result) or in any other service. The only repository reference to these route names is the auto-generated TypeScript SDK (`services/operational-core/sdks/typescript/api.ts`), which mechanically mirrors every controller route and is not itself a consumer. This is material: superseding or reconciling these endpoints later carries **low real migration risk**, since nothing currently depends on them in production use.

**`digital-twin.service.ts`'s own code comment is direct, first-party evidence of intent**, predating DGX numbering:
> "`predictedMaintenance`/`aiConfidenceScore` were Phase 3 placeholders (always null) — Phase 4 replaces them with real, deterministic, evidence-cited scoring (`twin-intelligence-math.ts`), never a trained model fit to this system's still-small per-vehicle history."

This is the same design philosophy DGX 3.0's own specification independently arrives at in §18 ("Phase A uses no machine-learning model at all... never assume deep learning is automatically better"). The existing code was not built *for* DGX 3.0, but it was built to solve exactly the problem DGX 3.0 exists to solve, using exactly the discipline DGX 3.0's specification requires.

**Coverage overlap with DGX 3.0's own named Phase A scope (specification §7) is extensive, not incidental.** `digital-twin.service.ts`'s `computeIntelligence()` method aggregates real `GarageJob`, `DiagnosticCode`, `InspectionResult`, `CustomerComplaint`, and `RepeatRepairFlag` evidence and produces, today: `healthScore`, `maintenanceRiskScore`, `systemRisks` (via the real `SystemCategory` classification: `COOLING`/`ENGINE`/`TRANSMISSION`/`SUSPENSION`/`ELECTRICAL`/`BRAKE`), `serviceComplianceScore`, `warrantyRiskScore`, `predictedMaintenance`, `predictedFutureParts`, `predictedLubricantNeeds`, and `aiConfidenceScore` (via `computeOverallConfidence`, the same job-count confidence gate the specification's §14 already cites and adopts). This is not a partial precedent — it is close to a working implementation of DGX 3.0's entire named Phase A scope, missing only the governance layer (persisted `RiskAssessment` records, human acknowledgment/override, evidence citation, audit completeness, certification framing) that the specification requires and the existing code does not provide.

**Confirmed absent, independently of the specification's own claims**: no `Component`, `Warranty`, `FailureEvent`, or `FailureLabel` model exists in `schema.prisma`; `RepeatRepairFlag` carries a real `RepeatRepairStatus` enum (`POSSIBLE`/`CONFIRMED`/`WARRANTY_CANDIDATE`/`DISMISSED`) with `resolvedById`/`resolvedAt`/`note` and a real, audit-logged resolve endpoint (`vehicle-lifecycle.controller.ts`, `PATCH :id/resolve`) — a real, currently-operating human review workflow, not a passive relation.

## Existing Architecture Assessment

| Concern | Current owner | Evidence |
|---|---|---|
| Vehicle/job/diagnostic/complaint/inspection domain data | Operational Core (Prisma models: `Vehicle`, `GarageJob`, `DiagnosticCode`, `CustomerComplaint`, `InspectionResult`, etc.) | Direct schema inspection |
| Deterministic risk/health math (`twin-intelligence-math.ts`) | Operational Core (`src/twin-intelligence/`) | Module registration, direct code read |
| Digital Twin aggregation (`digital-twin.service.ts`) | Operational Core (`src/vehicle-lifecycle/`) | Direct code read |
| Repeat-repair detection and human resolution workflow | Operational Core (`src/vehicle-lifecycle/repeat-repair.service.ts`, real controller, real `AuditLog` writes) | Direct code read, live schema |
| Existing `/ai/vehicle-health`, `/ai/predict-maintenance` read endpoints | Operational Core (`TwinIntelligenceController`, `ai.vehicleHealth` permission) | Direct code read |
| AI-assistant grounding in vehicle health data | Operational Core (`ai-assistants/technician-assistant.service.ts`) | Direct code read |
| Governed risk-assessment records, human acknowledgment/override, evidence citation, certification design | **Nobody today — does not exist** | Confirmed absent (`RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome` models do not exist in `schema.prisma`) |

## Ownership Analysis

Business rules, maintenance calculations, and risk calculations are, today, unambiguously owned by Operational Core: they are pure functions and a single aggregation service living inside `services/operational-core`, operating directly against Operational Core's own domain models, already depended upon by two other real, in-production Operational Core modules (`twin-intelligence`, `ai-assistants`). Repeat repair, service history, and vehicle intelligence are likewise Operational Core's own, real, tested capabilities. No part of this computation exists in, or has ever been associated with, `services/dgx-ai-platform`.

Customer-facing recommendation logic and future ML integration are the one part of this landscape that does **not** yet exist anywhere in the repository — no `RiskAssessment`, `MaintenanceRecommendation`, `Override`, or `Outcome` model, no acknowledgment workflow, no evidence-citation record, no certification-readiness structure. This is DGX 3.0's own, genuinely new contribution — not a duplicate of anything Operational Core already owns.

## Alternatives Considered

### Option A — DGX 3.0 owns vehicle lifecycle outright
Advantages: a clean, single-owner story for anything "maintenance-risk" shaped.
Disadvantages: requires forking or migrating live, tested, in-production code (`digital-twin.service.ts`, `twin-intelligence-math.ts`, `repeat-repair.service.ts`) and the domain models two other real modules (`ai-assistants`, `twin-intelligence`) already depend on, purely to relabel ownership. Directly violates the specification's own Capability Isolation rule (§23: "Shared data... belongs to the Foundation/Operational Core, never to DGX 3.0") and the Capability Governance Standard's anti-pattern list (§21: "capability owning another capability... without governance's involvement").
Migration impact: high and unjustified — real, working code would need to move or fork for no functional gain.
Governance impact: breaks the Foundation-owns-shared-data principle that every other capability (including DGX 2.0) already follows.
Engineering impact: substantial, high-risk rewrite of already-correct code.
Certification implications: would require re-certifying code that already has real, passing unit/integration coverage today, for no evidentiary benefit.
**Rejected.**

### Option B — Operational Core owns vehicle lifecycle; DGX 3.0 consumes outputs only
Advantages: matches the *already-real, already-working* precedent set by `TwinIntelligenceModule` and `TechnicianAssistantService`, both of which consume `VehicleDigitalTwinService` via direct dependency injection rather than owning or duplicating it. Preserves capability isolation exactly as specified (§21, §23). No engineering risk to existing, tested code.
Disadvantages (if read too literally as "read-only, arms-length consumption of only already-published outputs"): the existing math is uncalibrated, ungoverned, and was never designed to produce an auditable, human-reviewable recommendation — DGX 3.0 cannot satisfy its own specification (§17 explainability, §27 Safety Decision Matrix, §29 auditability) by merely reading today's raw `healthScore`/`maintenanceRiskScore` numbers; it must add real governance structure around them.
Migration impact: none to existing code; additive only.
Governance impact: fully consistent with existing governance precedent.
Engineering impact: DGX 3.0's own new module consumes existing services via standard DI (the same pattern already proven twice in this codebase) and adds new, additive entities/services for governance.
Certification implications: DGX 3.0's future certification standard evaluates its own new governance layer and its use of the existing math, not the existing math's internals (Operational Core's own tests already cover those).
**Accepted, with the refinement below.**

### Option C — DGX 3.0 wraps Operational Core behind a new facade/adapter service
Advantages: would formalize a boundary if the existing code were awkward to consume directly.
Disadvantages: unnecessary — the existing precedent (`TwinIntelligenceModule`, `TechnicianAssistantService`) already demonstrates that direct, in-process service consumption via constructor injection is clean, already proven, and requires no new adapter layer. Introducing a facade the codebase's own precedent doesn't use would be an unjustified abstraction (three near-identical ways of calling the same service).
Migration impact: low, but introduces avoidable complexity.
Governance impact: neutral.
Engineering impact: extra, unnecessary indirection.
Certification implications: none, but adds a component to certify that adds no real value.
**Rejected as unnecessary** — its intent (a clean, non-invasive boundary) is already achieved by Option B without a new facade.

### Option D — Hybrid ownership (split by data vs. computation, or case-by-case)
Advantages: superficially flexible.
Disadvantages: this is exactly the ambiguous, undefined boundary the Governance Standard's own anti-pattern list warns against ("cyclic capability dependency," "capability owning another capability... without governance's involvement"). "Hybrid" without a precise rule is not an architecture decision — it is a deferral wearing a decision's clothing.
Migration impact: unknown — undefined boundaries produce unpredictable, ad hoc migration work later.
Governance impact: negative — leaves exactly the ambiguity this ADR exists to remove.
Engineering impact: high long-term risk (unclear ownership breeds duplicate logic and silent coupling).
Certification implications: unclear ownership makes it unclear whose certification standard covers what.
**Rejected.**

### Option E — Defer to a future migration decision
Advantages: avoids commitment now.
Disadvantages: this ADR's entire purpose, as named by the specification itself (§49, §50), is to end this specific deferral before Implemented-stage engineering can begin. Deferring again leaves Engineering Authorization permanently blocked and repeats the exact deferral this ADR exists to close.
**Rejected** — the evidence gathered above is sufficient to decide now; no future information is needed to resolve the ownership question itself (only the tactical migration of the two ungoverned `/ai/*` endpoints, addressed below, is left for engineering-time planning).

## Final Architecture Decision

**Operational Core permanently owns the vehicle/maintenance domain data and the existing deterministic computation** (`src/vehicle-lifecycle/`, `src/twin-intelligence/`, and everything they read from `schema.prisma`). **DGX 3.0 consumes this computation directly, via the same in-process service-injection pattern already proven twice in this codebase** (`TwinIntelligenceModule`, `TechnicianAssistantService`) **— it does not fork, re-derive, or duplicate the math, and it does not take ownership of `Vehicle`, `GarageJob`, `RepeatRepairFlag`, or any other Operational Core model.** DGX 3.0's own, genuinely new ownership is scoped to exactly what does not exist today: `RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome`, evidence-citation records, and the certification/audit/human-oversight governance surface the specification's §17, §27, §28, and §29 require.

This is Option B, precisely scoped: not a vague "consumption" of only already-published outputs, but a specific, evidenced instruction that any future DGX 3.0 Phase A engineering work is expected to be implemented as an additive module inside `services/operational-core` (following the existing precedent's location and pattern), composing `VehicleDigitalTwinService`, `RepeatRepairService`, and `VehicleTimelineService` exactly as `ai-assistants` and `twin-intelligence` already do — never bypassing them with a direct, duplicated query against the same underlying tables.

**Why this decision, and not the others**: the repository does not present an open architectural question so much as an **existing, twice-proven pattern** for exactly this situation. Option A and Option C would each introduce cost or indirection the existing codebase's own precedent shows is unnecessary. Option D fails to be a decision. Option E fails this ADR's own purpose. Option B, precisely scoped, is the only alternative that matches what the codebase already, demonstrably does — twice — for the same category of problem.

**Named, explicit non-decision**: this ADR does **not** resolve what becomes of the existing, ungoverned `/ai/vehicle-health` and `/ai/predict-maintenance` endpoints (`TwinIntelligenceController`, permission `ai.vehicleHealth`) once DGX 3.0's own governed API surface (specification §24, new `maintenance-risk.*` permissions) exists. No real caller of these endpoints was found in this repository, so the migration risk is low, but the tactical decision (deprecate, alias, or leave coexisting) is an engineering-time API-design question, not an architecture-ownership question, and is out of this ADR's scope. It is recorded here as a required follow-up for whichever future work plans DGX 3.0's Phase A engineering.

## Boundary Definition

- **Operational Core responsibilities**: `Vehicle`, `GarageJob`, `DiagnosticCode`, `CustomerComplaint`, `InspectionResult`, `RepeatRepairFlag` and its resolution workflow, `twin-intelligence-math.ts`'s deterministic scoring functions, `digital-twin.service.ts`'s aggregation, `vehicle-timeline.service.ts`. All are read/write-owned by Operational Core, permanently.
- **DGX 3.0 responsibilities**: `RiskAssessment`, `MaintenanceRecommendation`, `Override`, `Outcome`, evidence-citation records, model/policy version tracking, and the certification/audit/human-oversight processes wrapped around them. DGX 3.0 writes only to its own new tables, never to any Operational Core model (matching specification §21's read/write contract table exactly).
- **Shared contracts**: `VehicleDigitalTwinService`, `RepeatRepairService`, `VehicleTimelineService` — consumed via constructor injection within the same NestJS application, the same way `ai-assistants` and `twin-intelligence` already do.
- **Published interfaces**: any future DGX 3.0 HTTP surface (specification §24, `maintenance-risk.*` permissions) is DGX 3.0's own, to be consumed by DGX 4.0 or any other future capability only through that published surface — never through direct access to Operational Core's internal tables or services (specification §23, already-stated Capability Isolation rule).
- **Internal implementation**: `twin-intelligence-math.ts`'s specific formulas, `digital-twin.service.ts`'s query shape, and `RepeatRepairFlag`'s resolution mechanics remain Operational Core's internal implementation detail — DGX 3.0 must not depend on their internals beyond the service methods they expose.
- **Forbidden coupling**: DGX 3.0 must never query `Vehicle`, `GarageJob`, `DiagnosticCode`, `CustomerComplaint`, `InspectionResult`, or `RepeatRepairFlag` directly via Prisma; it must never write to any Operational Core model; Operational Core must never depend on any DGX 3.0 model or service (no cyclic dependency, per Governance Standard §18).

## Safety Responsibilities

- **Repair authorization**: owned by nobody today, and by design will never be automated — remains a human technician/service-advisor decision, per specification §16, §27, §28. Neither Operational Core nor DGX 3.0 may ever own this decision itself.
- **Human approval / acknowledgment / override**: to be owned by DGX 3.0's new governance layer (`Override`, `Outcome` records), since no equivalent mechanism exists in Operational Core today beyond `RepeatRepairFlag`'s own resolution workflow (which remains Operational Core's, for repeat-repair specifically, and is consumed — not replicated — by DGX 3.0).
- **Recommendation generation**: DGX 3.0's own responsibility, built on top of Operational Core's existing risk/health computation.
- **Risk scoring (the underlying math)**: Operational Core's responsibility, as established above — DGX 3.0 does not recompute or override the underlying deterministic scores; it adds governance, evidence citation, and human-review structure around them.
- **Final decision**: always a named human, per specification §16 ("no AI recommendation may become the legal or technical owner of a repair decision") — never Operational Core, never DGX 3.0.
- **Audit responsibility**: DGX 3.0 owns audit completeness for its own new records (`RiskAssessment`, recommendations, overrides, outcomes), using the existing, real, append-only `AuditLog` pattern Operational Core already provides (per specification §29's already-recorded correction: `AuditLog.actorId` is nullable today, so DGX 3.0 must enforce accountable-actor attribution at its own application layer, not assume the existing table enforces it).

## Engineering Implications

- No source code, schema, migration, or API is created or changed by this ADR.
- This decision establishes the direction for a future, separately-authorized engineering effort: a new, additive module inside `services/operational-core` (not a new service, not `services/dgx-ai-platform`, since Phase A requires no AI-provider inference per specification §18/§22) that composes the existing `vehicle-lifecycle`/`twin-intelligence` services rather than duplicating them, and introduces DGX 3.0's own new, additive entities and governance surface.
- The existing `/ai/vehicle-health`/`/ai/predict-maintenance` endpoints and `ai.vehicleHealth` permission are flagged as a required future engineering-time reconciliation (deprecate, alias, or coexist) — low migration risk, since no real caller was found — but this ADR does not decide that tactical question.
- This decision does not, by itself, satisfy any of the remaining Pre-Engineering Entry Gates in specification §50 (Business Owner assignment, Operational Owner assignment, Architecture Review, security remediation per §26, etc.) — it resolves only the capability-boundary gate this ADR was created for.

## Consequences

- The specification's Recorded finding (§1) and the ADR register (§49) are now resolved for `DGX3-ADR-0001` specifically; the other nine required ADRs (`DGX3-ADR-0002` through `DGX3-ADR-0010`) remain open and unaffected by this decision.
- Any future DGX 3.0 engineering proposal that re-derives, forks, or duplicates `twin-intelligence-math.ts`, `digital-twin.service.ts`, or `repeat-repair.service.ts` instead of consuming them directly must be treated as a deviation from this ADR, requiring its own review.
- Any future DGX 3.0 engineering proposal that writes to `Vehicle`, `GarageJob`, `DiagnosticCode`, `CustomerComplaint`, `InspectionResult`, or `RepeatRepairFlag` must be treated as a violation of this ADR's boundary definition.

## Risks

- **Precedent risk**: this ADR relies on two existing modules (`twin-intelligence`, `ai-assistants`) as architectural precedent; if either is later found to be a poor pattern for unrelated reasons, this ADR's reasoning should be revisited — but as of this ADR's evidence, both are real, tested, in-production, and structurally sound.
- **Scope-creep risk**: "consume, don't duplicate" could be read too loosely at engineering time to justify copying logic "for performance" or "for isolation." Mitigated by this ADR's explicit Forbidden Coupling list.
- **Endpoint-reconciliation risk**: the existing ungoverned `/ai/*` endpoints, if a real caller is later discovered that this ADR's search did not find, could complicate the eventual reconciliation decision. Mitigated by flagging this explicitly as a required, not-yet-resolved, engineering-time follow-up rather than asserting it is risk-free.

## Future Review Conditions

This ADR must be revisited if:
- A future engineering proposal needs to write to any Operational Core model directly, rather than through `vehicle-lifecycle`/`twin-intelligence`'s own services.
- The existing `vehicle-lifecycle`/`twin-intelligence` modules are materially restructured for reasons unrelated to DGX 3.0 (e.g., a future Operational Core refactor) in a way that changes the service boundary this ADR relies on.
- A real caller of the existing `/ai/vehicle-health`/`/ai/predict-maintenance` endpoints is discovered, changing the migration-risk assessment above.

## Approval Requirements

Per `AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md` §12 (Approval Committee model), this ADR — as a capability-boundary decision, not a Foundation/Reference-Architecture change — requires the same review discipline ADR-0001 and ADR-0002 followed:

| Role | Confirms |
|---|---|
| Architecture Board | The ownership boundary is consistent with existing Capability Isolation rules (specification §23, Governance Standard §18) and does not create a cyclic or ambiguous dependency. |
| Business Owner (not yet assigned) | The decision does not foreclose any business option prematurely — it does not; DGX 3.0's future recommendation logic remains fully independent of Operational Core's internal implementation. |
| Engineering | The two named existing precedents (`TwinIntelligenceModule`, `TechnicianAssistantService`) are correctly characterized and remain the intended consumption pattern for DGX 3.0's own future module. |

No implementation may begin under this ADR alone — Engineering Authorization Review, and the remaining Pre-Engineering Entry Gates in specification §50, are separate, future, not-yet-issued actions.

## Engineering Authorization

**Architecture ownership resolved. Engineering Authorization Review may begin.**

This statement means exactly what it says and no more: the capability-boundary question this ADR was created to answer is now resolved, and the Engineering Authorization Review process referenced in specification §50 may now be convened. **This ADR does not itself authorize engineering, coding, implementation, a pilot, production, or any change to DGX 3.0's current maturity or certification status.** Engineering remains **NOT AUTHORIZED** until the remaining Pre-Engineering Entry Gates in specification §50 — including Business Owner assignment, Operational Owner assignment, Architecture Review, the §26 security remediation, and the nine other required ADRs (`DGX3-ADR-0002` through `DGX3-ADR-0010`) — are separately satisfied.

---

*This ADR is a permanent, append-only record. Once accepted, it is never rewritten — a changed decision requires a new ADR that supersedes this one, per `docs/adr/README.md`'s own governing convention.*
