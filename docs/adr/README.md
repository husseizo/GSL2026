# Architecture Decision Records (ADR) — Index

This directory holds AIOS's Architecture Decision Records, per the ADR policy defined in [`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md`](../architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md) and referenced by the [Capability Governance Standard](../governance/AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md).

## What an ADR is for

A formal, permanent record of a single architectural or governance decision — the context that forced it, the decision itself, the alternatives rejected, and its consequences. An ADR is written **before** the decision is implemented, never as after-the-fact justification. Once accepted, an ADR is never rewritten — a changed decision gets a new ADR that supersedes the old one, which stays in place, inspectable, exactly as the Foundation's own append-only discipline requires everywhere else (gold datasets, certification baselines, knowledge snapshots).

## Index

| ID | Title | Status | Purpose |
|---|---|---|---|
| [ADR-0001](ADR-0001-warehouse-capacity.md) | Add `Warehouse.capacity` field to enforce a real physical/logical stock ceiling | **Accepted** — implemented in Sprint 1 | Closes a Critical Safety Gate: enforces that no purchase recommendation may exceed a warehouse's real, known capacity. |
| [ADR-0002](ADR-0002-historical-metrics-persisted-exclusion.md) | Recognize a narrow, evidence-gated exclusion for mathematically undefined WAPE/MASE under verified zero business activity | **Accepted** — approved via Certification Standard Amendment v1.1 and formal Enterprise Change Control | Resolves a real governance ambiguity found during DGX 2.0 Remediation Cycle 1: distinguishes an honest, mathematically-undefined forecast metric from an actual implementation defect, without weakening the `HISTORICAL_METRICS_PERSISTED` certification gate. |

## Cross-references

- ADR-0001 is cited by [`DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md`](../capabilities/DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md) §14 (Business Rules) and the Sprint 1 evidence recorded in [`DGX2_PHASE_A_BASELINE_1_0.md`](../execution/DGX2_PHASE_A_BASELINE_1_0.md).
- ADR-0002 is cited by [`DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md`](../certification/DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md) and the Remediation Cycle 1/2 record in [`DGX2_PHASE_A_BASELINE_1_0.md`](../execution/DGX2_PHASE_A_BASELINE_1_0.md).

## Future ADR process

1. **Draft**: open a PR adding a new `ADR-NNNN-short-title.md` file, using the next sequential, unused number — existing ADRs are never renumbered, even if a gap or an out-of-order merge occurs.
2. **Required sections**: Title, Status, Context, Decision, Alternatives Considered, Consequences, Risks (matching ADR-0001/0002's own structure — see either as a template).
3. **Review**: per the Capability Governance Standard's Approval Committee model (§12) for any ADR touching a governed capability; Architecture Review for anything touching the Foundation or Reference Architecture directly.
4. **Status values**: `Proposed` (drafted, pending review) → `Accepted` (approved, now in force) → `Superseded by ADR-NNNN` (a later ADR replaced this decision; the original text is never edited) → `Rejected` (considered, not adopted — kept for record, not deleted).
5. **Update this index** in the same PR that adds or changes an ADR's status — this file is the authoritative, current-status summary; the ADRs themselves are the permanent, frozen record of what was decided and why.
