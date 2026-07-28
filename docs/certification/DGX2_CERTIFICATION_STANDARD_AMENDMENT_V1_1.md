# DGX 2.0 — Demand Forecasting Certification Standard

### Amendment v1.1 — Historical Metrics Persistence: Mathematically Undefined Metrics Under Verified Zero Activity

---

## Document Control

| Field | Value |
|---|---|
| Amends | `DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md`, version 1.0 (unchanged, frozen, not rewritten) |
| Amendment version | 1.1 |
| Status | Proposed — pending Architecture Board approval per `docs/adr/ADR-0002-historical-metrics-persisted-exclusion.md` |
| Affected certification gate | `HISTORICAL_METRICS_PERSISTED` only (part of Evaluation Category 1, Forecast Quality, §5/§6 of v1.0) |
| Nature of change | Additive clarification only. No section of v1.0 is deleted, reworded, or renumbered. |
| Effective date | Not yet effective. Becomes effective upon Architecture Board approval and formal publication; the effective date will be recorded here at that time. Until then, v1.0 governs certification in full, unmodified. |
| Approval required from | Architecture Board, Engineering, Governance/Procurement (per §23 of v1.0 and ADR-0002). |

---

## Reason for Amendment

Certification Run #1 and Certification Remediation Cycle 1 produced real, reproduced evidence that a small number of `ForecastRun` rows correctly store a `null` WAPE/MASE value because the real, underlying business activity for that row's held-out evaluation window was verifiably zero — making the metric mathematically undefined (0/0), not merely small or low-confidence. The current text of v1.0 (§6) does not state how such a case should be treated, and in its silence would require treating it identically to an actual defect. This amendment closes that gap with a narrow, deterministic, fully auditable clarification — it does not change any threshold, scoring rule, or certification difficulty.

---

## New Wording (additive — inserted as a new subsection following §6 of v1.0; nothing in §6 itself is altered)

### §6A. Mathematically Undefined Metrics (Amendment v1.1)

A real `ForecastRun` row's WAPE and/or MASE value MAY be excluded from the `HISTORICAL_METRICS_PERSISTED` completeness calculation, and MUST NOT otherwise be excluded, treating the following as a complete and exhaustive test:

The exclusion MUST be recognized only when all five of the following conditions are simultaneously and verifiably true for that specific row:

1. **Mathematical undefinedness.** The metric's computation is undefined by its own formula (a 0/0 condition or equivalent), not merely imprecise, low-confidence, or numerically extreme.
2. **Verified zero business activity.** The real, underlying business activity for the row's evaluation window is demonstrably zero, established from the same real data the forecast was computed against.
3. **Preserved evidence.** The implementation has persisted real, inspectable evidence proving condition 2, independent of and prior to any certification review — evidence produced after the fact, or asserted without a persisted record, does not satisfy this condition.
4. **No suppression, substitution, or fabrication.** The implementation MUST NOT have suppressed, replaced, estimated, or fabricated any metric value in producing this row. A row that stores any non-null WAPE or MASE value does not qualify for this exclusion regardless of how that value was derived.
5. **Deterministic, reproducible, auditable exclusion.** Re-evaluating the same persisted row, with no additional input, MUST always yield the same exclusion decision. The exclusion MUST be traceable to conditions 1–4 from persisted data alone, without reference to any human judgment made at certification time.

If any one of the five conditions cannot be independently verified from persisted evidence, the row **MUST** be counted as a failure of `HISTORICAL_METRICS_PERSISTED`, exactly as under v1.0 with no amendment applied.

### §6B. Explicitly Prohibited Grounds for Exclusion (Amendment v1.1)

The following **MUST NOT**, under any circumstance, be treated as satisfying §6A, and **MUST NOT** be used as grounds to exclude a row from the `HISTORICAL_METRICS_PERSISTED` completeness calculation:

- Poor forecast quality.
- Missing or incomplete implementation.
- Software defects of any kind.
- Missing persistence not arising from a verified zero-activity condition.
- Data corruption.
- Processing failures or timeouts.
- Manual intervention of any kind.
- Unknown or unestablished cause.
- Insufficient evidence to independently verify all five conditions of §6A.
- Any discretionary engineering or reviewer judgment, however well-intentioned.

This list is illustrative of the governing principle, not exhaustive: **the only permitted exclusion under this Standard is a mathematically undefined metric caused exclusively by verified zero real business activity, evidenced per §6A.** Any cause not affirmatively satisfying all five conditions of §6A is, by default, a failure.

### §6C. Threshold and Scoring Preservation (Amendment v1.1)

This amendment **SHALL NOT** be read to change, and does not change, any of the following:

- The `HISTORICAL_METRICS_PERSISTED` gate's required completeness threshold remains unchanged (all rows not validly excluded under §6A must carry both WAPE and MASE).
- No other certification gate, threshold, or scoring rule in v1.0 is altered.
- The overall certification difficulty is unchanged — this amendment narrows the *interpretation* of one specific, previously-unaddressed condition; it introduces no new pass path, no relaxed criterion, and no discretionary leniency anywhere else in the Standard.
- The certification verdict levels (§22 of v1.0) and their required cumulative conditions are unchanged.

---

## Removed Wording

None. This amendment is purely additive. No word of `DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md` v1.0 is deleted, reworded, or renumbered.

---

## Normative Language Key

- **MUST / MUST NOT** — a mandatory requirement or prohibition; no exception exists beyond what is explicitly stated in this amendment.
- **SHALL / SHALL NOT** — a binding statement of scope or effect (used above to state what this amendment does not change).
- **MAY** — a condition that is permitted once its stated prerequisites are fully satisfied; it is never an invitation to discretionary judgment.

---

## Affected Certification Gate

`HISTORICAL_METRICS_PERSISTED` only. No other gate named in `DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md` (§8 Safety Gates, §9 Human Trust Gates, or any Forecast Quality metric other than the persistence-completeness check) is in scope for this amendment.
