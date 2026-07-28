# ADR-0002: Recognize a narrow, evidence-gated exclusion for mathematically undefined WAPE/MASE under verified zero business activity

## Title

Governance clarification of the `HISTORICAL_METRICS_PERSISTED` certification gate — mathematically undefined metrics arising from verified zero-activity evaluation windows.

## Status

Proposed — pending Architecture Board approval. Not yet effective. No implementation authorized by this ADR.

## Context

Certification Run #1 (`docs/certification/reports/dgx2-certification-report-1785229549715.md`) recorded `HISTORICAL_METRICS_PERSISTED: FAIL` — 45 of 50 real `ForecastRun` rows carried both a persisted WAPE and MASE value; 5 did not. Certification Remediation Cycle 1 directly reproduced the mechanism for 4 of the 5: a real `GARAGE_WORKLOAD` target whose most recent real 14-day held-out evaluation window contains zero real garage-job activity. Under this condition, WAPE's denominator (sum of absolute real actual demand) and MASE's denominator (mean absolute real one-step naive difference) are both exactly zero — the metrics are not merely small, they are mathematically undefined (0/0), not computable by any correct implementation. The existing, unmodified code (`finiteOrNull()`) correctly stores `null` in this case rather than fabricating a value such as `0` or `Infinity`. The 5th incomplete row is unrelated legacy data predating an earlier fix and carries no evidentiary weight for this ADR.

The Architecture Board (prior review) accepted, in principle, that the Certification Standard as currently written does not distinguish this condition from an implementation defect, a missing-persistence bug, or any other cause of an incomplete metric — it currently treats all of them identically as gate failures.

## Problem Statement

`DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md` §6 requires every forecast-accuracy metric to be "computed from real backtested history — never estimated, never assumed." It does not currently state what a certification run must do when a metric is honestly *impossible* to compute because the real, underlying business activity for the evaluation window was verifiably zero. In the current Standard's silence, the only literal reading is that such a case must be treated identically to a real defect — which would require the capability to either (a) fabricate a value to satisfy the gate (violating the Foundation's "never invent certainty" principle and this Standard's own §6 prohibition on estimation), or (b) remain permanently unable to reach 100% completeness for any target whose real activity is intermittent enough to occasionally produce a zero-activity window — regardless of how correct and defect-free the implementation is.

## Decision

Recommend that the Architecture Board approve a narrow, additive clarification to the Certification Standard (drafted as Amendment v1.1, `docs/certification/DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md`) stating that a `ForecastRun`'s missing WAPE/MASE value may be excluded from the `HISTORICAL_METRICS_PERSISTED` completeness denominator **only** when all five conditions below are simultaneously, verifiably true for that specific row:

1. The metric is mathematically undefined (not merely small, imprecise, or low-confidence).
2. The real underlying business activity for the evaluation window is demonstrably zero.
3. The implementation has preserved real evidence proving the zero-activity condition.
4. The implementation has not suppressed, replaced, estimated, or fabricated any metric value.
5. The exclusion is deterministic, reproducible, and fully auditable from persisted evidence alone.

If any one condition cannot be verified, the row counts as a failure exactly as it does today. This decision changes only the *interpretation* of an already-mathematically-impossible measurement. It does not change any threshold, any scoring rule, or the certification difficulty for any other gate or metric.

## Alternatives Considered

- **Leave the Standard unchanged.** Preserves maximum simplicity, but permanently and unfairly penalizes correct, defensive abstention (a `null` produced by refusing to fabricate a value) identically to an actual defect, for every target whose real business activity is intermittent enough to occasionally produce a zero-activity window — regardless of code quality.
- **Report completeness as a percentage against a target threshold (e.g., ≥95%) rather than a hard 100% requirement.** Simpler to implement, but introduces a discretionary numeric threshold not grounded in any specific, auditable condition — exactly the kind of "discretionary engineering judgment" the governing mandate for this amendment program prohibits.
- **Lower or remove the `HISTORICAL_METRICS_PERSISTED` gate entirely.** Rejected outright — this would weaken certification, which is explicitly forbidden by the amendment program's non-negotiable principles.
- **Allow engineers to mark a row "excluded" at their discretion during certification review.** Rejected outright — this is exactly the "discretionary interpretation" and "manual intervention" exclusion the amendment program explicitly prohibits; any exclusion must be deterministic and reproducible from persisted evidence, never a human judgment call made at certification time.

## Rejected Alternatives

The following exclusion rationales are explicitly and permanently rejected as grounds for exclusion under this ADR, and must be carried into the Standard Amendment verbatim as prohibited:

- Poor forecast quality.
- Missing or incomplete implementation.
- Software defects of any kind.
- Missing persistence unrelated to a verified zero-activity condition.
- Data corruption.
- Processing failures or timeouts.
- Manual intervention of any kind.
- Unknown or unestablished cause.
- Insufficient evidence to verify the five conditions above.
- Any discretionary engineering or reviewer judgment.

## Consequences

- The `HISTORICAL_METRICS_PERSISTED` gate becomes capable of correctly distinguishing an honest mathematical non-event from an actual defect, without weakening its ability to catch real defects (every prohibited cause above still fails the gate exactly as today).
- Certification evidence must, going forward, be sufficient to prove a zero-activity condition on its own, from persisted data — this is a clarification of evidentiary expectation, not a new capability requirement, since the underlying data (real test-period actual values) already exists wherever a `ForecastRun` is computed.
- The Standard gains a documented, narrow precedent for how mathematically-impossible measurements are treated; this precedent applies only to this gate and only under the five stated conditions — it creates no general discretionary-exception mechanism for any other gate.

## Risks

- **Scope-creep risk**: a narrowly-worded exception could be misread or extended informally to other gates or other causes over time. Mitigated by explicit, permanent scoping to this one gate and this one condition, and the explicit, non-exhaustive-but-illustrative prohibited-causes list in the Amendment.
- **Evidentiary risk**: if the "proof of zero activity" requirement is not held to a strict, auditable standard, this could become a de facto discretionary exception. Mitigated by requiring the proof to be reproducible from persisted evidence alone, never asserted by a reviewer.
- **Precedent risk**: approving any exception, however narrow, could be cited in future to justify a less rigorous one. Mitigated by requiring any future exception request to independently satisfy the same five-condition test and go through the same ADR/Amendment process — this ADR sets a bar, not a shortcut.

## Future Review Conditions

This ADR and its resulting Amendment must be revisited if:
- Any future certification run applies the exclusion to a case that, on audit, does not satisfy all five conditions.
- A pattern emerges where the exclusion is invoked so frequently that it materially changes what "certified" means for a given capability's real business population — at that point the Architecture Board must assess whether the underlying eligibility/data-population question (raised separately in Remediation Cycle 1) requires its own, distinct governance action.
- Any other certification gate is proposed for a similar exception — this ADR's five-condition test does not automatically transfer; a new ADR is required.

## Approval Requirements

Per `AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md` and this Standard's own §23, approval requires sign-off from:

| Role | Confirms |
|---|---|
| Architecture Board | The amendment is additive, does not weaken certification, and is consistent with the Foundation's and this Standard's existing principles. |
| Engineering | The five conditions are independently verifiable from persisted evidence without new subjective judgment. |
| Governance/Procurement | The clarification does not change what "certified" represents to business stakeholders who rely on the verdict. |

No implementation, Standard rewrite, or Remediation Cycle 2 engineering work may begin until this ADR and the accompanying Amendment v1.1 are formally approved.
