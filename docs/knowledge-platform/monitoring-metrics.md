# Monitoring & Metrics

> **Update — DGX Prototype 1.7.1.** The gap described below is closed. ~23 new Knowledge Platform Prometheus series now exist in `src/observability/metrics.service.ts`, including the first `Gauge` usage in that file (review backlog, open conflicts, snapshot age, sources-by-status). See [`docs/trusted-knowledge-pilot/metrics.md`](../trusted-knowledge-pilot/metrics.md) for the full list, real call sites, and the honest limitation on Gauges that lack a continuously-running refresh scheduler.

## Honest status as of DGX Prototype 1.7 (superseded, see update above): no dedicated Knowledge Platform metrics were added that phase

Confirmed by grep against `src/observability/metrics.service.ts` — zero new `record*()` methods for Knowledge Platform business events (ingestion counts, quarantine counts, publish counts, conflict counts, snapshot activations). This is a real, named gap, not an oversight hidden from this report.

## What exists today, for free

Every new controller this phase (`KnowledgeSourceRegistryController`, `KnowledgeReviewController`, `KnowledgeSnapshotController`, `KnowledgeGraphController`, `IngestionController`) automatically gets the existing, unconditional `observability/metrics.middleware.ts` applied — `aios_http_requests_total` and `aios_http_request_duration_seconds`, both labeled by `method`/`route`/`status`, cover every new endpoint without any Knowledge-Platform-specific code. The real `/metrics` endpoint (`ObservabilityController`) exposes the shared Prometheus registry, unchanged.

`AuditLog` (see `audit-logging.md`) is the actual detailed observability mechanism for this phase — every governance-relevant event is there, queryable, with before/after state — even though it isn't a Prometheus metric.

## What's genuinely missing

Dedicated counters/histograms for: ingestion throughput, quarantine rate, review-queue depth/age, conflict backlog size, snapshot-activation latency. None of these exist yet. No Grafana dashboard exists in this environment (same honest limitation DGX Prototype 1.6 already documented for its own leaderboard/dashboard work) — the only real dashboard-equivalent is the static-HTML-report pattern used elsewhere in `ai-benchmark`, not yet built for Knowledge Platform events specifically.
