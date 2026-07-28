# Knowledge Platform Metrics

## New Prometheus series (~23, first `Gauge` usage in `metrics.service.ts`)

Counters: `knowledge_sources_total`, `knowledge_documents_ingested_total`, `knowledge_ingestion_failures_total`, `knowledge_documents_quarantined_total`, `knowledge_parser_failures_total`, `knowledge_ocr_pages_total`, `knowledge_ocr_low_confidence_total`, `knowledge_candidate_claims_total`, `knowledge_claims_approved_total`, `knowledge_claims_rejected_total`, `knowledge_structured_facts_total`, `knowledge_expired_items_total`, `knowledge_stale_items_total`, `knowledge_permission_denials_total`, `knowledge_citation_failures_total`, `knowledge_evaluation_gate_failures_total`, `knowledge_malware_scan_failures_total`.

Histograms: `knowledge_review_latency`, `knowledge_retrieval_latency`.

Gauges (new to this file): `knowledge_sources_by_status`, `knowledge_review_backlog`, `knowledge_conflicts_open`, `knowledge_snapshot_age_seconds`.

Every series follows the existing `readonly xMetric = new Counter/Histogram/Gauge({..., registers: [this.registry]})` + `recordX()`/`setX()` pattern already established in `metrics.service.ts`.

## Real call sites

All metrics have real call sites wired into the services that produce the underlying events (`IngestionPipelineService`, `StructuredFactService`, `KnowledgeClaimService`, `KnowledgeReviewService`, `KnowledgeConflictService`, `KnowledgeRetrievalService`) via `@Optional() private readonly metrics?: MetricsService` — additive, non-breaking for any existing manual-construction test call site.

## Honest limitation on Gauges

Where no live scheduler exists to continuously refresh a Gauge (e.g. `knowledge_snapshot_age_seconds`, `knowledge_conflicts_open`), the value is set from the most recent real service call that touches it (e.g. `refreshOpenConflictsGauge()` runs after `detectAndPersistConflicts()`), not from a continuously-running background job. This matches the same `SCHEDULED_DOC_ONLY`-style limitation already accepted in DGX 1.6/1.7 — named here rather than silently implied to be live-refreshing.

## Verification

Verify script step confirms all new metric names appear on the real `/metrics` endpoint.
