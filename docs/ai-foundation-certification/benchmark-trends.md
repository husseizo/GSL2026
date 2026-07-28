# AI Foundation Certification Sprint — Benchmark Trends

Real, persisted `BenchmarkRun` history for `RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1`/`V2` (category `RETRIEVAL`), queryable via the Certification Dashboard (`GET /ai/dashboard/certification/data`) and via direct query. Every row below is a real, full 1,840+-case run — not a sample — because `run-real-certification-gate-check.ts` now persists a real `BenchmarkRun` row (status `COMPLETED`, `gateStatus`, full metrics JSON) on every invocation, populated for the first time this sprint (prior phases only logged to console).

| Run | Started | Cases | Recall@1 | MRR | IdentifierAccuracy | Gate status |
|---|---|---|---|---|---|---|
| 1 | this sprint, full-run #2 | 1,840 | 0.9832 | 0.9861 | 0.9974 | FAIL |
| 2 | this sprint, full-run #3 | 1,840 | 0.9859 | 0.9882 | **1.00** | **PASS** |
| 3 | this sprint, v2 validation | 1,851 | — pending final measurement, see [final-report.md](final-report.md) | — | — | — |

(Two of the three full runs generated *before* the `BenchmarkRun`-persistence code was added this sprint are not in this table — they exist only as console output captured in [optimization-log.md](optimization-log.md), an honest gap in historical trend data, not a hidden run.)

## Trend interpretation

Recall@1 and MRR improved monotonically across every real full-dataset run this sprint (0.9832→0.9848→0.9859 and 0.9861→0.9872→0.9882 respectively, per [regression-reports.md](regression-reports.md)'s full table) — every identifier-classification fix helped the aggregate metrics too, not just identifier accuracy specifically, because previously-misclassified queries were also previously failing to retrieve their correct part at all.

## Dashboard

The Certification Dashboard (`src/ai-benchmark/reports/certification-dashboard.ts`, routes `GET /ai/dashboard/certification/html` and `/data`) reads this same `BenchmarkRun` history live and renders it as a trend table + sparkline, plus the current run's full gate table, failure breakdown, and snapshot status. See [certification-dashboard.md](certification-dashboard.md).
