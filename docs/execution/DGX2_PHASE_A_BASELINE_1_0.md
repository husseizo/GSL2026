# DGX 2.0 — Phase A Baseline 1.0

### Permanent Archival Record of the DGX 2.0 Phase A Program

---

## Document Control

| Field | Value |
|---|---|
| Program Name | DGX 2.0 — Demand Forecasting Capability, Phase A |
| Program Version | Phase A (classical forecasting baseline) |
| Baseline Identifier | `DGX2-PHASE-A-BASELINE-1.0` |
| Closure Date | Recorded per the Executive Declaration (`DGX2_PHASE_A_EXECUTIVE_CLOSURE_DECLARED`) issued this program cycle |
| Status | **Frozen — historical, immutable archival record** |
| Owner | AIOS Baseline Management Authority |

This document is archival only. It records what was approved and completed; it authorizes nothing further and reopens nothing prior.

---

## 1. Phase A Baseline Summary

DGX 2.0 Phase A delivered a classical, backtested demand-forecasting baseline (five methods: Naive, Moving Average, Exponential Smoothing, Seasonal Naive, Croston's), the certification evidence infrastructure and standard needed to evaluate it, one governance amendment closing a real ambiguity found during evaluation, two real, executed certification runs, and a formal transition of operational ownership to Business Operations under a confirmed Manual operational model. The program is closed as an implementation effort; the capability now lives in the operational lifecycle.

## 2. Approved Artifact Register

**Phase I — Frozen Foundation Documents** (pre-existing, unmodified throughout Phase A):
- `docs/architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md`
- `docs/ai-foundation-certification/final-report.md` (AI Foundation Certification)
- `docs/governance/AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md`
- `docs/architecture/AIOS_REFERENCE_ARCHITECTURE_V1.md`
- `docs/strategy/AIOS_ENTERPRISE_ROADMAP_V1.md`
- `docs/capabilities/DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md`
- `docs/certification/DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md` (v1.0)
- `docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md`

**Phase A — Governance Artifacts**:
- `docs/adr/ADR-0001-warehouse-capacity.md`
- `docs/adr/ADR-0002-historical-metrics-persisted-exclusion.md`
- `docs/certification/DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md`

**Phase A — Certification Evidence Artifacts**:
- `docs/certification/datasets/dgx2-certification-dataset-v1.json` and `DGX2_CERTIFICATION_DATASET_V1.md`
- `docs/certification/reports/dgx2-certification-report-1785229549715.md` (Certification Run #1)
- `docs/certification/reports/dgx2-certification-report-1785239892742.md` (Certification Run #2)

**Phase A — Engineering Artifacts** (`services/operational-core/`):
- `src/purchase-recommendations/purchase-recommendation-math.ts`, `src/transfer-recommendations/transfer-recommendation-math.ts` (Safety Gates)
- `src/observability/metrics.service.ts` (forecast/recommendation metrics)
- `src/forecasting/forecast-math.ts`, `forecasting.service.ts` (WAPE/MASE persistence, `testActualSum` evidence)
- `src/dgx2-certification/` (`dataset-types.ts`, `dataset-validator.ts`, `gate-evaluators.ts`, `scorecard.ts`, `historical-metrics-exclusion.ts`, and their test files)
- `scripts/build-dgx2-certification-dataset.ts`, `scripts/run-dgx2-certification-check.ts`

## 3. Scope Register

**In scope and delivered**: classical forecasting baseline; Safety Gates; certification evidence infrastructure; Certification Dataset v1; Certification Runner and Scorecard; Certification Standard v1.0 and Amendment v1.1; two executed certification runs; operational SOP and ownership transition.

**Explicitly excluded from Phase A** (see §8): Scheduled Forecasting (Phase D), Event-Driven Forecasting, any model family beyond the five classical methods (Prophet, gradient boosting, deep sequence models — DGX 2.0 Specification §10/§24 Phase B), Hybrid AI (Phase C), Certification Run #3, Pilot, Production.

## 4. Operational Baseline

- **Operational Model**: Manual — a real, authenticated `POST /ai/forecast` request, permission-gated (`ai.forecast.generate`), consistent with the identical pattern used by Purchase and Transfer Recommendations.
- **Operational Owner**: Inventory Planners (per `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §5), under Business Operations.
- **Cadence**: business-process cadence (weekly/monthly/pre-procurement/pre-transfer/pre-replenishment/ad hoc), not a technical scheduler — none exists in Phase A.
- **Evidence status at closure**: 50 real `ForecastRun` rows, most recent dated 2026-07-12; zero organic growth observed since Certification Run #2, honestly reported by the Operational Evidence Accumulation Program.

## 5. Certification Baseline

- **Standard in force**: DGX 2.0 Certification Standard v1.1 (v1.0 base, unmodified, plus the additive Amendment v1.1).
- **Certification Run #1**: verdict `NOT_READY` — 9/11 gates passed; failed `FORECAST_QUALITY_MASE` (mean 1.242) and `HISTORICAL_METRICS_PERSISTED` (45/50).
- **Certification Run #2**: verdict `NOT_READY` — same two gates failed, evaluated under v1.1's five-condition exclusion mechanism; zero rows qualified for exclusion because none yet carry the required `testActualSum` evidence.
- **Certification status at baseline freeze**: `NOT_READY`, unchanged by this baseline and not reinterpreted by it.

## 6. Governance Baseline

- **ADR-0001**: `Warehouse.capacity` field (Sprint 1, Critical Safety Gate closure).
- **ADR-0002**: recognized a narrow, five-condition, evidence-gated exclusion for mathematically undefined WAPE/MASE under verified zero business activity.
- **Certification Standard Amendment v1.1**: adopted via formal Enterprise Change Control (`AIOS_CHANGE_CONTROL_APPROVED`) — additive only; no threshold, scoring rule, or certification difficulty changed.
- No governance item remains open at baseline freeze.

## 7. Architecture Baseline

AIOS Foundation Architecture and Reference Architecture remain approved and unmodified throughout Phase A. No architectural defect was identified at any point in the program's record; no architecture change was made or required.

## 8. Future Scope Exclusion Register

The following remain unauthorized by this baseline and require independent authorization through the Product Roadmap and Architecture Board governance process before any work begins:

- Scheduled Forecasting (DGX 2.0 Specification §24, Phase D)
- Event-Driven Forecasting
- Any model family beyond the five classical methods (Phase B) or Hybrid AI (Phase C)
- Certification Run #3
- Pilot deployment
- Production deployment
- Any automation beyond the confirmed Manual operational model

## 9. Historical Timeline

| Milestone | Outcome |
|---|---|
| Sprint 1 — Critical Safety Gates | Complete (`SPRINT_1_COMPLETE`) |
| Sprint 2 — Certification Infrastructure | Complete (`SPRINT_2_COMPLETE`) |
| Sprint 3 — Certification Evidence Package | Complete (`SPRINT_3_COMPLETE`) |
| Sprint 4 — Certification Run #1 | Executed; verdict `NOT_READY` |
| Remediation Cycle 1 — Investigation | Complete (`DGX2_REMEDIATION_CYCLE_1_COMPLETE`); no viable engineering fix found; governance ambiguity identified |
| Architecture Board Review | `DGX2_PHASE_A_CONTINUES` |
| Governance Amendment Program | `AIOS_GOVERNANCE_AMENDMENT_V1_1_READY` |
| Enterprise Change Control | `AIOS_CHANGE_CONTROL_APPROVED` |
| Remediation Cycle 2 — Implementation | Complete (`DGX2_REMEDIATION_CYCLE_2_COMPLETE`) |
| Certification Run #2 | Executed; verdict `NOT_READY` |
| Operational Evidence Accumulation Program | `OPERATIONAL_EVIDENCE_ACCUMULATION_ACTIVE` |
| Operational Readiness Review | `MANUAL_OPERATION_CONFIRMED` |
| Business Operations Adoption | `BUSINESS_OPERATIONS_READY` |
| Phase A Operational Transition | `PHASE_A_OPERATIONAL_TRANSITION_APPROVED` |
| Program Closure Review | `DGX2_PHASE_A_PROGRAM_CLOSED` |
| Executive Declaration | `DGX2_PHASE_A_EXECUTIVE_CLOSURE_DECLARED` |

## 10. Lessons Learned

- Real, exhaustive, measured investigation (Remediation Cycle 1) is more valuable than a fabricated fix: four independent experiments proved no available engineering lever could honestly improve `FORECAST_QUALITY_MASE`, and reporting that plainly was the correct outcome, not a shortfall.
- A governance ambiguity (mathematically undefined metrics under real zero activity) was only discoverable by running a real certification against real data — it was not visible from specification review alone.
- A Manual operational model, while simple and auditable, means certification evidence accumulates only as fast as genuine business usage — this was observed directly (zero growth over the observed period) rather than assumed.
- Keeping certification evidence, governance amendment, and operational adoption as separate, sequential, evidence-gated stages (rather than collapsing them) preserved auditability at every step.

## 11. Baseline Freeze Declaration

"DGX 2.0 Phase A Baseline 1.0 is hereby frozen as the official historical baseline of the program.

All approved artifacts are preserved without modification.

Any future capability shall evolve from this baseline through independently authorized roadmap initiatives.

This baseline shall remain immutable and shall serve as the official reference for all future phases."
