# AI Foundation Certification Sprint — Certification Dashboard

Spec §20: a dedicated, official certification view — separate from the general AI Quality dashboard (DGX 1.6), since it answers a narrower question: *are the mandatory Retrieval Quality Gates passing right now, reproducibly?*

## What was built

- `src/ai-benchmark/reports/certification-data.ts` — `CertificationDashboardDataService`, real Prisma queries only (no synthetic data): latest `BenchmarkRun` for the gold benchmark, full gate table, run-history trend, `KnowledgeSnapshot` status, recent `RetrievalExperiment` rows, `RetrievalQueryLog.failureType` breakdown, regression history.
- `src/ai-benchmark/reports/certification-dashboard.ts` — `generateCertificationDashboardHtml()`, a pure function of that data, reusing `report-generator.ts`'s exact pattern (inline CSS, zero external/CDN references, dark-mode support via `prefers-color-scheme` and `data-theme`).
- Two new routes on the existing `DashboardController`: `GET /ai/dashboard/certification/data` (JSON) and `GET /ai/dashboard/certification/html` (rendered page), both behind the same `PermissionsGuard`/`ai.evaluations.read` permission as the existing dashboard — no new guard, no new permission.
- `run-real-certification-gate-check.ts` (this sprint's own measurement tool) now persists a real `BenchmarkRun` row on every invocation, giving the dashboard real historical trend data instead of only the most recent in-process Prometheus gauge values.

## What it shows

Recall@1/3/5, MRR, nDCG, Identifier Accuracy, p95 latency, current benchmark run ID and timestamp, the full mandatory-gate table with PASS/FAIL/WAIVED pills, a dedicated "failed gates" panel, run-history trend table, snapshot status (version, approval, evaluation/activation timestamps), recent Retrieval Laboratory experiments, and the failure-analysis breakdown by `RetrievalFailureType`.

## Certification readiness banner

The dashboard computes its own readiness verdict from the latest run's gates (`AI_FOUNDATION_CERTIFIED` / `NEEDS_MORE_TUNING` / `NOT_READY`), independently of any verdict text in these docs — so the dashboard and the written final report can never silently drift apart; both derive from the same real `BenchmarkRun.gateStatus`/`metrics` data.

## No Grafana

Consistent with every prior DGX phase (`docs/ai-evaluation/leaderboard.md`), no Grafana instance exists in this environment — this static, self-hosted HTML dashboard is the real, reproducible deliverable instead of an external visualization tool this environment doesn't have.

## Static export

`scripts/verify-ai-foundation-certification.ts` writes a real, generated snapshot of this dashboard to `docs/ai-foundation-certification/reports/latest.html` as part of its own verification run (see [verification-results.md](verification-results.md)) — the same "write the dashboard to disk as part of verification" convention `verify-ai-evaluation-framework.ts` already established.
