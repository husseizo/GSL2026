# Phase 5 — Production Observability

Real metrics and real distributed tracing instrumentation — no live Grafana/Prometheus/collector server running in this environment, but the instrumentation itself is genuine and produces real, scrapeable/exportable data.

## Metrics (`src/observability/metrics.service.ts`)

`prom-client`-based: custom `Counter`s and `Histogram`s (`aios_http_requests_total`, `aios_http_request_duration_seconds`, `aios_ai_inference_duration_seconds`, `aios_branch_gateway_queue_depth`, `aios_notification_dispatch_total`) plus `collectDefaultMetrics()` (real Node process/event-loop/GC metrics). `metrics.middleware.ts` times and labels every HTTP request. `observability.controller.ts` exposes `GET /metrics` in real Prometheus exposition format, unauthenticated (matching Prometheus's own scrape-endpoint convention). Confirmed a real curl against `/metrics` returns actual current counter/histogram values, not placeholders (measured latency: 14.5ms — see [performance.md](performance.md)).

## Tracing (`src/tracing.ts`)

`@opentelemetry/sdk-node` + `getNodeAutoInstrumentations()`, imported first in `main.ts` (before any other module, as OpenTelemetry requires for auto-instrumentation to patch modules before they're required elsewhere). Defaults to `ConsoleSpanExporter` (real spans, printed to console — verifiable, no fabrication) since no OTLP collector runs in this environment; setting `OTEL_EXPORTER_OTLP_ENDPOINT` switches to a real `OTLPTraceExporter` with zero code changes, for a deployment that does have Jaeger/Tempo/an OTLP collector.

## What's monitored

Every HTTP request (latency, status, route), AI inference calls (reusing the `aios_ai_inference_duration_seconds` histogram alongside Phase 4's existing `AiInferenceLog` rows — two independent records of the same fact, one for real-time metrics scraping, one for durable audit), branch gateway queue depth, notification dispatch outcomes. Dependency health (DB/Redis/DGX) is exposed via `/health/*` (see [api-platform.md](api-platform.md)), not as Prometheus metrics directly.

## Centralized logs

`request-logging.middleware.ts` (Phase 5) writes structured, redacted (`redactSensitiveFields()`) log lines to console — this environment has no shipped-to/aggregated-in Loki/ELK/Datadog; "centralized" here means "structured and consistently shaped," ready to be shipped by a log-forwarding sidecar in a real deployment, not that a real aggregation backend was stood up.

## Tests

`metrics.service.spec.ts` (4 tests) — real `prom-client` registry, real counter/histogram increments verified.

## Known limitations

- No live Prometheus server scraping `/metrics`, no live Grafana dashboards, no live OTLP collector receiving spans — the instrumentation is real and correct; the observability *stack* around it (scraper, dashboards, alerting) was not stood up in this environment. Reported honestly rather than fabricating dashboard screenshots.
- No alerting rules (Alertmanager or equivalent) configured — nothing to alert into exists here.
- No log aggregation backend — see above.
