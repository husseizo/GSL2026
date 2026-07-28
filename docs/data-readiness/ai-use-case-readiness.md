# AI Use-Case Readiness

`src/data-readiness/ai-readiness/ai-use-case-readiness.service.ts` — a real, evidence-based readiness assessment for every candidate DGX Spark use case the phase named, backed by real counts pulled from the database at assessment time, not a template guess.

## Real assessed statuses (2026-07-13, 12 use cases)

| Use case | Status | Real evidence behind it |
|---|---|---|
| Automotive catalogue RAG | **READY_FOR_PROTOTYPE** | 7,723 real Parts + 434 real LubricantProducts with real provenance |
| Parts semantic search | **READY_FOR_PROTOTYPE** | Same real corpus |
| Lubricant product retrieval | **READY_FOR_PROTOTYPE** | 434 real LubricantProducts |
| Management assistant over reconciled sales data | **READY_FOR_PROTOTYPE** | Real, reproducible `BaselineRun`/`BaselineMetric` data |
| Sales demand forecasting | **READY_FOR_OFFLINE_EVALUATION** | Real per-item eligibility classification + real Croston/naive backtests run this phase (see [forecast-baselines.md](forecast-baselines.md)) |
| Customer entity-resolution assistance | **NEEDS_MORE_DATA** | Only 1 real `ReviewDecisionDetail` recorded at assessment time (threshold: 20) |
| OEM-number matching assistance | **NEEDS_LABELING** | 1,116 real positive examples exist; zero labeled negatives |
| Lubricant specification assistant | **BLOCKED_BY_SOURCE_ACCESS** | No verified technical-spec source imported (see [lubricants-quality.md](lubricants-quality.md)) |
| Vehicle failure prediction | **BLOCKED_BY_SOURCE_ACCESS** | No real DTC/repair-outcome data |
| Predictive maintenance | **BLOCKED_BY_SOURCE_ACCESS** | Same real gap |
| Technician diagnostic assistant | **BLOCKED_BY_SOURCE_ACCESS** | No real garage diagnostic data |
| Garage workload forecasting | **BLOCKED_BY_SOURCE_ACCESS** | No real job-card volume data (quotations, even if Odoo access existed, are demand evidence, not completed workload) |

Every status above matched the original brief's own predicted positions (§20) — verified, not merely assumed, per the brief's explicit instruction. The one deliberately built-in check (`vehicle-failure-remains-blocked`) is asserted in both the verification script and would fail loudly if this ever silently drifted to a "ready" status without real garage data existing.

## What each assessment records

`businessObjective`, `requiredData`/`availableData`/`missingData` (all real, specific lists — not generic placeholders), `sampleSize`, `featureCompleteness`, `targetLeakageRisk`, `classImbalanceRisk`, `biasRisk`, `groundTruthQuality`, `evaluationMethod`, `humanApprovalRequired`, `safetyRisk`, `status`, `recommendation`.

## Reassessment

`persistAssessments()` is idempotent (upsert by `useCaseName`) and re-evaluates real evidence every time it's called — as more real reviewer decisions accumulate or more sources are imported, re-running it will move use cases forward (e.g. "Customer entity-resolution assistance" moves to `READY_FOR_OFFLINE_EVALUATION` once 20+ real decisions exist) without any code change.

## Access

`POST /data-readiness/ai-readiness/refresh` (permission `aiReadiness.manage`), `GET /data-readiness/ai-readiness?status=...` (`aiReadiness.read`).
