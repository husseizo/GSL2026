# DGX 2.0 Certification Report

## Executive Summary

Verdict: **NOT_READY**

One or more mandatory gates failed: FORECAST_QUALITY_MASE, HISTORICAL_METRICS_PERSISTED.

## Dataset Summary

Dataset version: v1

## Metrics Summary

- Forecast Accuracy: MASE=1.2419827884087058, WAPE=152.413510095258, MAPE=102.37423884049588, RMSE=6.180235478468859, Bias=-1.7169677636532812 (47 real chosen-best runs)
- Recommendations: 14 total, 2 accepted, 1 rejected (approval rate: 66.66666666666666%)
- Audit coverage: 100%
- Integration test coverage: 100%
- Observability coverage: 100%
- Safety Gate status: PASS

## Gate Results

| Gate | Status | Actual | Threshold | Reason |
|---|---|---|---|---|
| DATASET_INTEGRITY | PASS | {"checksumMatches":true,"totalEntries":26,"missingCategories":[]} | {"checksumMatches":true,"missingCategories":[]} | Real dataset checksum matches and every required category is present. |
| SAFETY_SUPPLIER_ACTIVE | PASS | {"action":"REVIEW_DATA","suggestedQuantity":0,"supplierRejected":true} | {"action":"REVIEW_DATA","suggestedQuantity":0,"supplierRejected":true} | Real, direct invocation of computePurchaseRecommendation() with a real inactive supplier flag must never recommend a purchase. |
| SAFETY_WAREHOUSE_CAPACITY | PASS | {"finalSuggestedQuantity":100,"warehouseCapacityExceeded":true} | {"warehouseCapacityExceeded":true,"totalWithinCapacity":100} | Real, direct invocation of computePurchaseRecommendation() with a real, deliberately-exceeded warehouse capacity must cap the suggested quantity so total held stock never exceeds it. |
| FORECAST_QUALITY_MASE | FAIL | 1.2419827884087058 | 1 | Real average MASE across 47 chosen-best forecast runs must beat the naive baseline (< 1). |
| FORECAST_QUALITY_WAPE_REPORTED | PASS | 152.413510095258 | "reported" | Real WAPE is computed and available — reported, not gated alone per the Certification Standard §6. |
| HUMAN_TRUST_EVIDENCE | PASS | 14 | 14 | Every real recommendation must carry real evidence — never omitted. |
| HUMAN_TRUST_AUDIT_TRAIL | PASS | 3 | 3 | Every real decided (approved/rejected) recommendation must have a real, corresponding AuditLog row. |
| INTEGRATION_TEST_COVERAGE | PASS | 5 | 5 | Every real orchestrating service has a real integration-spec file. |
| FULL_TEST_SUITE | PASS | "" | "0 failed" |  |
| HISTORICAL_METRICS_PERSISTED | FAIL | 45 | 50 | Every real ForecastRun must have real, persisted WAPE and MASE values, or validly satisfy the Amendment v1.1 §6A exclusion. 45 complete, 0 validly excluded (verified zero business activity), 5 unresolved of 50 total. |
| OBSERVABILITY_METRICS_REGISTERED | PASS | 11 | 11 | Every real Sprint 2 forecast/recommendation metric is registered. |

## HISTORICAL_METRICS_PERSISTED — Exclusion Audit (Amendment v1.1)

Every real ForecastRun row missing WAPE or MASE is listed individually below — an excluded row is never omitted or silently subtracted from a count.

### ForecastRun `45d9221f-8d54-4cb7-9827-2b832d958c30` (GARAGE_WORKLOAD / NAIVE)

- Verdict: **NOT EXCLUDED — counts as a failure**
- Not excluded — remains a failure. Unsatisfied condition(s): VERIFIED_ZERO_BUSINESS_ACTIVITY, EVIDENCE_PRESERVED.

  - MATHEMATICALLY_UNDEFINED: PASS — Both WAPE and MASE are null — the metric was never computed as a value, never fabricated.
  - VERIFIED_ZERO_BUSINESS_ACTIVITY: FAIL — No persisted testActualSum evidence exists on this row — zero business activity cannot be verified.
  - EVIDENCE_PRESERVED: FAIL — No real, persisted evidence of business activity exists for this row — the exclusion cannot be verified from persisted data alone.
  - NO_SUPPRESSION_OR_FABRICATION: PASS — No value was suppressed, substituted, estimated, or fabricated in place of the undefined metric.
  - DETERMINISTIC_AND_AUDITABLE: PASS — This determination is a pure function of persisted fields (wape, mase, evidence.testActualSum) — re-evaluating this exact row always yields the same result, with no runtime judgment or certification-time calculation involved.

### ForecastRun `34d317e3-e6e8-4413-a47d-c9893f7814da` (GARAGE_WORKLOAD / MOVING_AVERAGE)

- Verdict: **NOT EXCLUDED — counts as a failure**
- Not excluded — remains a failure. Unsatisfied condition(s): VERIFIED_ZERO_BUSINESS_ACTIVITY, EVIDENCE_PRESERVED.

  - MATHEMATICALLY_UNDEFINED: PASS — Both WAPE and MASE are null — the metric was never computed as a value, never fabricated.
  - VERIFIED_ZERO_BUSINESS_ACTIVITY: FAIL — No persisted testActualSum evidence exists on this row — zero business activity cannot be verified.
  - EVIDENCE_PRESERVED: FAIL — No real, persisted evidence of business activity exists for this row — the exclusion cannot be verified from persisted data alone.
  - NO_SUPPRESSION_OR_FABRICATION: PASS — No value was suppressed, substituted, estimated, or fabricated in place of the undefined metric.
  - DETERMINISTIC_AND_AUDITABLE: PASS — This determination is a pure function of persisted fields (wape, mase, evidence.testActualSum) — re-evaluating this exact row always yields the same result, with no runtime judgment or certification-time calculation involved.

### ForecastRun `389d2cf0-4332-4bbd-9675-c7a53d834a9d` (GARAGE_WORKLOAD / EXPONENTIAL_SMOOTHING)

- Verdict: **NOT EXCLUDED — counts as a failure**
- Not excluded — remains a failure. Unsatisfied condition(s): VERIFIED_ZERO_BUSINESS_ACTIVITY, EVIDENCE_PRESERVED.

  - MATHEMATICALLY_UNDEFINED: PASS — Both WAPE and MASE are null — the metric was never computed as a value, never fabricated.
  - VERIFIED_ZERO_BUSINESS_ACTIVITY: FAIL — No persisted testActualSum evidence exists on this row — zero business activity cannot be verified.
  - EVIDENCE_PRESERVED: FAIL — No real, persisted evidence of business activity exists for this row — the exclusion cannot be verified from persisted data alone.
  - NO_SUPPRESSION_OR_FABRICATION: PASS — No value was suppressed, substituted, estimated, or fabricated in place of the undefined metric.
  - DETERMINISTIC_AND_AUDITABLE: PASS — This determination is a pure function of persisted fields (wape, mase, evidence.testActualSum) — re-evaluating this exact row always yields the same result, with no runtime judgment or certification-time calculation involved.

### ForecastRun `6b32bdac-0795-429c-a82d-cd1398710498` (GARAGE_WORKLOAD / SEASONAL_NAIVE)

- Verdict: **NOT EXCLUDED — counts as a failure**
- Not excluded — remains a failure. Unsatisfied condition(s): VERIFIED_ZERO_BUSINESS_ACTIVITY, EVIDENCE_PRESERVED.

  - MATHEMATICALLY_UNDEFINED: PASS — Both WAPE and MASE are null — the metric was never computed as a value, never fabricated.
  - VERIFIED_ZERO_BUSINESS_ACTIVITY: FAIL — No persisted testActualSum evidence exists on this row — zero business activity cannot be verified.
  - EVIDENCE_PRESERVED: FAIL — No real, persisted evidence of business activity exists for this row — the exclusion cannot be verified from persisted data alone.
  - NO_SUPPRESSION_OR_FABRICATION: PASS — No value was suppressed, substituted, estimated, or fabricated in place of the undefined metric.
  - DETERMINISTIC_AND_AUDITABLE: PASS — This determination is a pure function of persisted fields (wape, mase, evidence.testActualSum) — re-evaluating this exact row always yields the same result, with no runtime judgment or certification-time calculation involved.

### ForecastRun `26611543-6a05-4d86-ab89-539c27681d68` (PART / NAIVE)

- Verdict: **NOT EXCLUDED — counts as a failure**
- Not excluded — remains a failure. Unsatisfied condition(s): VERIFIED_ZERO_BUSINESS_ACTIVITY, EVIDENCE_PRESERVED.

  - MATHEMATICALLY_UNDEFINED: PASS — Both WAPE and MASE are null — the metric was never computed as a value, never fabricated.
  - VERIFIED_ZERO_BUSINESS_ACTIVITY: FAIL — No persisted testActualSum evidence exists on this row — zero business activity cannot be verified.
  - EVIDENCE_PRESERVED: FAIL — No real, persisted evidence of business activity exists for this row — the exclusion cannot be verified from persisted data alone.
  - NO_SUPPRESSION_OR_FABRICATION: PASS — No value was suppressed, substituted, estimated, or fabricated in place of the undefined metric.
  - DETERMINISTIC_AND_AUDITABLE: PASS — This determination is a pure function of persisted fields (wape, mase, evidence.testActualSum) — re-evaluating this exact row always yields the same result, with no runtime judgment or certification-time calculation involved.

## Failed Gates

- FORECAST_QUALITY_MASE: Real average MASE across 47 chosen-best forecast runs must beat the naive baseline (< 1).
- HISTORICAL_METRICS_PERSISTED: Every real ForecastRun must have real, persisted WAPE and MASE values, or validly satisfy the Amendment v1.1 §6A exclusion. 45 complete, 0 validly excluded (verified zero business activity), 5 unresolved of 50 total.

## Warnings

- Certification is not yet achievable — see Failed Gates above.

## Risks

- Real data volume in this environment is genuinely small (see the Certification Dataset's own known limitations) — real coverage will strengthen as real business volume grows.

## Recommendations

- Address every Failed Gate before attempting a subsequent real certification run.
- Treat this report as one point-in-time real measurement, not a permanent status.

## Next Actions

- If verdict is NOT_READY: fix the failed gates and re-run.
- If verdict is LIMITED_PILOT or above: proceed per `AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md` §15 (sign-offs) before any real Pilot begins.
