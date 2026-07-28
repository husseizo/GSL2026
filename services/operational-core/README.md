# operational-core (AIOS Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Data Consolidation)

The operational core of the Automotive Intelligence Operating System: vehicle
and parts master data, the integration/sync engine, the Phase 2 commercial
data foundation (organizations/branches/warehouses, customers, lubricants,
suppliers, sales, purchases, a movement-based inventory ledger, app-event
ingestion, lost-sales detection, inventory analytics/classification, three
deterministic recommendation engines), the Phase 3 garage domain (reception,
job cards, inspection, diagnostics, estimates and customer approval, labour,
technicians, parts reservation/issue/return, quality control, repeat-repair
detection, a computed Vehicle Digital Twin), a bounded Phase 4 DGX AI
Platform (a real local-LLM/embedding inference boundary, retrieval-augmented
generation over an approved knowledge base, Digital Twin Intelligence,
statistical demand forecasting, and four AI assistants — all advisory, none
of them a system of record), and — as of Phase 5 — the enterprise platform
layer: real identity/authentication (JWT + refresh rotation + MFA),
policy-based authorization, an API platform (Swagger/OpenAPI + generated
SDKs), external-system connectivity (SAP B1/Odoo adapters, real PostgreSQL
CDC), a Branch Gateway for offline-capable edge sites, Redis-backed
distributed services, a Neon-style read-scaling cache database, multi-channel
notifications, real backup/restore-validation tooling, Prometheus/OpenTelemetry
observability, and production security hardening (self-signed TLS, secure
headers, Postgres-enforced audit-log immutability). A follow-up
**Data Consolidation & Master Data Governance** phase then paused new
features entirely to populate the platform with real production data — a
real SAP↔Odoo lubricants middleware database, a real spare-parts/VIN/TecDoc
catalog, and a real existing "AutoHub" commercial application — through a
staged, matched, confidence-scored, human-reviewed, reconciled pipeline
(`src/data-consolidation/`). See
[docs/architecture](../../docs/architecture/00-overview.md) for the full
system design, [docs/architecture/phase5-decision-log.md](../../docs/architecture/phase5-decision-log.md)
for the Phase 5 reasoning, and [docs/data-consolidation/decision-log.md](../../docs/data-consolidation/decision-log.md)
for the Data Consolidation phase's reasoning.

**Before modifying any AI Foundation or capability-layer code** (`retrieval-intelligence/`, `knowledge-platform/`, `ai-benchmark/`, `ai-gateway/`, `ai-assistants/`, `forecasting/`, `twin-intelligence/`, or any future DGX 2.0-6.0 module), contributors must first read [docs/architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md](../../docs/architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md) — the permanent architectural contracts, invariants, and integration rules that govern this codebase.

## What's here

**Phase 1** — vehicle master (`src/vehicles`), parts master with proposed-only
dedup (`src/parts`), and the idempotent integration engine (`src/integration`)
with a `FileDropAdapter` standing in for a real CDC/REST adapter.

**Phase 2** — see [docs/architecture/phase-2-commercial-foundation.md](../../docs/architecture/phase-2-commercial-foundation.md)
for the full write-up. In short:

- `organizations` / `branches` / `warehouses` — org hierarchy, warehouse types.
- `customers`, `lubricants`, `suppliers` — master data, same sync-envelope pattern as Phase 1.
- `sales`, `purchases` — document+line import via the integration engine, idempotent at both the document and line level. Importing a PO never moves stock; a `GoodsReceipt` does. Importing a completed sale does post an inventory movement (see [decision-log.md](../../docs/architecture/decision-log.md)).
- `inventory` — the movement-based ledger (`InventoryLedgerService.postMovement`), reservations, transfers, adjustments. See [docs/architecture/inventory-ledger.md](../../docs/architecture/inventory-ledger.md).
- `app-events` — normalized log ingestion feeding lost-sales detection and analytics.
- `lost-sales` — deterministic detection with session-scoped deduplication.
- `inventory-analytics` — demand metrics, ABC/XYZ, movement classification.
- `purchase-recommendations` / `transfer-recommendations` / `supplier-analytics` — deterministic, evidence-based, human-approved-only.

**Phase 3** — see [docs/architecture/garage-architecture.md](../../docs/architecture/garage-architecture.md)
for the full write-up, plus its linked sub-documents. In short:

- `checklists` — one generic template/response engine reused by reception, job-card, and quality checks.
- `reception` — `VehicleReception`/`VehicleCondition`/`CustomerComplaint`/`VehiclePhoto`/`VehicleAccessory` at check-in.
- `garage-jobs` — the job card and its 19-state workflow, append-only status/timeline history. See [docs/architecture/job-workflow.md](../../docs/architecture/job-workflow.md).
- `inspections` — configurable inspection templates with structured findings (PASS/WARNING/FAIL/NOT_INSPECTED/UNKNOWN). See [docs/architecture/inspection-engine.md](../../docs/architecture/inspection-engine.md).
- `diagnostics` — DTC/symptom/suspected-cause storage; explicitly no AI interpretation. See [docs/architecture/diagnostic-model.md](../../docs/architecture/diagnostic-model.md).
- `estimates` — estimate lines, revisions, per-line customer approval, and conversion to a real `SalesDocument` invoice.
- `garage-inventory` — reservation/issue/return, routed entirely through Phase 2's `ReservationsService`/`InventoryLedgerService` (garage code never posts a movement itself).
- `labour`, `technicians` — labour catalogue/rates/time-logging and technician skills/certifications/availability. See [docs/architecture/labour-engine.md](../../docs/architecture/labour-engine.md).
- `quality-control` — final QC, road test, customer-ready approval. See [docs/architecture/quality-control.md](../../docs/architecture/quality-control.md).
- `vehicle-lifecycle` — the computed Vehicle Digital Twin, Vehicle Timeline, and deterministic repeat-repair detection. See [docs/architecture/vehicle-history.md](../../docs/architecture/vehicle-history.md) and [docs/architecture/repeat-repair.md](../../docs/architecture/repeat-repair.md).
- `notifications`, `workshop-analytics`, `workshop-inventory-requests` — event notifications, computed-on-demand workshop dashboards, and emergency/inter-warehouse requests linked directly to Phase 2's recommendation engines.

RBAC roles (`GARAGE_MANAGER`, `WORKSHOP_SUPERVISOR`, `RECEPTION`, `TECHNICIAN`, `DIAGNOSTIC_TECHNICIAN`, `QUALITY_INSPECTOR`, `SERVICE_ADVISOR`) are documented in [docs/architecture/garage-rbac.md](../../docs/architecture/garage-rbac.md).

**Phase 4** — see [docs/architecture/dgx-platform.md](../../docs/architecture/dgx-platform.md)
for the full write-up, plus its linked sub-documents. In short:

- `ai-gateway` — the one choke point every AI-touching call goes through: prompt sanitization, rate limiting, and per-inference logging (`AiInferenceLog`), talking to the isolated Python inference boundary in `services/dgx-ai-platform/` (never the other way around).
- `model-registry`, `prompt-registry` — versioned, synced-from-reality model catalogue and append-only prompt versioning. See [docs/architecture/model-registry.md](../../docs/architecture/model-registry.md) and [docs/architecture/prompt-registry.md](../../docs/architecture/prompt-registry.md).
- `embeddings`, `vector-search`, `knowledge-base`, `rag` — chunk/embed/dedup pipeline, a swappable vector-index interface (currently a plain Postgres array + cosine similarity — no pgvector on this build), an approved-documents-only knowledge repository, and retrieval-augmented chat/search that never calls the LLM when nothing relevant was retrieved. See [docs/architecture/rag-architecture.md](../../docs/architecture/rag-architecture.md) and [docs/architecture/vector-search.md](../../docs/architecture/vector-search.md).
- `twin-intelligence` — extends the Phase 3 Digital Twin with real deterministic health/risk scoring and evidence-cited predicted maintenance/parts/lubricants. See [docs/architecture/digital-twin-intelligence.md](../../docs/architecture/digital-twin-intelligence.md).
- `forecasting` — statistical demand forecasting (naive/moving-average/exponential-smoothing/seasonal-naive), backtested and compared per series, never assumed deep-learning-is-better. See [docs/architecture/forecasting.md](../../docs/architecture/forecasting.md).
- `purchase-recommendations` (enhanced) — `AiPurchasingSignalsService` attaches forecast/repeat-repair/search-demand evidence to Phase 2's existing recommendations, additive only; the deterministic action/quantity engine is untouched.
- `ai-assistants` — Technician (RAG-grounded, never declares a confirmed diagnosis), Parts and Lubricant (no LLM call at all — structured facts only), Manager (grounded in live operational analytics, not documents).
- `ai-feedback`, `ai-evaluation` — acceptance-rate tracking and real offline retrieval-precision/recall evaluation against `RagService`. See [docs/architecture/ai-governance.md](../../docs/architecture/ai-governance.md) and [docs/architecture/evaluation-framework.md](../../docs/architecture/evaluation-framework.md).

`services/dgx-ai-platform/` is a separate Python/FastAPI service — the only thing that talks to Ollama, with no database driver anywhere in its dependency tree (see [docs/architecture/security-dgx.md](../../docs/architecture/security-dgx.md)). This sandbox has no GPU and no DGX Spark; `llama3`/`nomic-embed-text` run on CPU via a locally-installed Ollama instance. The same code runs unchanged on a real DGX Spark — see [docs/architecture/dgx-platform.md](../../docs/architecture/dgx-platform.md) for exactly what that migration involves.

**Phase 5** — see [docs/architecture/phase5-decision-log.md](../../docs/architecture/phase5-decision-log.md) for the full reasoning behind every choice below, plus each module's own doc:

- `identity` — real JWT access tokens + rotating opaque refresh tokens, TOTP MFA, sessions, trusted devices, password reset/email verification, API keys/service accounts. A global `JwtAuthContextGuard` enriches every existing Phase 1–4 controller's auth check with zero changes to any of them. See [docs/architecture/identity-platform.md](../../docs/architecture/identity-platform.md).
- `authorization` — policy-based hierarchical scope checks (org/branch/warehouse, ownership) layered on top of the existing static `ROLE_PERMISSIONS` map. See [docs/architecture/authorization.md](../../docs/architecture/authorization.md).
- `tenancy` — org-boundary abstraction and per-organization configuration, preparing for (not implementing) multi-tenant SaaS. See [docs/architecture/tenant-readiness.md](../../docs/architecture/tenant-readiness.md).
- `redis` — real Redis (via `redis-memory-server` in this environment) for distributed cache, rate limiting, locks, and queue coordination — never a system of record. See [docs/architecture/redis.md](../../docs/architecture/redis.md).
- `api-platform` — Swagger/OpenAPI (245 documented paths), generated TypeScript/.NET/Python SDKs, URI API versioning, correlation IDs, idempotency keys, structured errors, Redis-backed rate limiting, real dependency health checks. See [docs/architecture/api-platform.md](../../docs/architecture/api-platform.md).
- `integration/adapters` — SAP Business One and Odoo adapters against each system's real documented API contract, tested against `nock`-mocked servers (never a live instance). See [docs/architecture/integration-adapters.md](../../docs/architecture/integration-adapters.md).
- `cdc` — real PostgreSQL logical replication (pgoutput) against a genuinely separate throwaway `wal_level=logical` cluster, Debezium-envelope-compatible events, idempotent replay, checkpoint recovery. See [docs/architecture/cdc.md](../../docs/architecture/cdc.md).
- `branch-gateway` — offline-capable message queue for edge/branch sites: signing, compression, conflict detection/resolution, replay, health tracking. See [docs/architecture/branch-gateway.md](../../docs/architecture/branch-gateway.md) and [docs/architecture/edge-operations.md](../../docs/architecture/edge-operations.md).
- `neon-cache` — a real cross-database sync to a second local Postgres database standing in for a Neon read-scaling cache (no live Neon account here). See [docs/architecture/neon-cache.md](../../docs/architecture/neon-cache.md).
- `notification-service` — multi-channel notifications (real in-app + real webhook delivery; email/SMS/WhatsApp/push are an honest console-log stand-in, no real credentials here). See [docs/architecture/notifications.md](../../docs/architecture/notifications.md).
- `backup` — real `pg_dump`/`psql`-based full backups, encrypted config backups, and restore validation with real row-count comparison. See [docs/architecture/backup-disaster-recovery.md](../../docs/architecture/backup-disaster-recovery.md).
- `observability` — Prometheus metrics (`prom-client`) and OpenTelemetry tracing, real instrumentation with no live Grafana/collector stood up in this environment. See [docs/architecture/production-observability.md](../../docs/architecture/production-observability.md).
- `security` — real self-signed TLS certificate generation/verification and a Postgres-trigger-enforced immutable `AuditLog`. See [docs/architecture/security-production.md](../../docs/architecture/security-production.md).

`services/web-portal/` (Vite + React + TypeScript) is the one frontend built this round — a real Web Management Portal with JWT login (MFA-aware), executive/branch dashboards, user management, and system health, calling this API directly. See "Web Management Portal" below. The Technician PWA, Customer Portal, and Dealer Portal have real supporting APIs but no UI yet — see [docs/architecture/pwa.md](../../docs/architecture/pwa.md), [docs/architecture/customer-portal.md](../../docs/architecture/customer-portal.md), [docs/architecture/dealer-portal.md](../../docs/architecture/dealer-portal.md).

**Data Consolidation & Master Data Governance** — see [docs/data-consolidation/real-data-architecture.md](../../docs/data-consolidation/real-data-architecture.md) for the full write-up. In short, `src/data-consolidation/`:

- `staging.service.ts` — every real source record lands in `RawSourceRecord` first, never straight into a domain table; checksum-based dedup reuses Phase 1's idempotent-replay convention.
- `adapters/molas-lubricants-cache.adapter.ts` / `adapters/parts-catalog-autohub.adapter.ts` — real, read-only `EnterpriseSourceAdapter` implementations against a live SQL Server (`MolasCacheDb`) and a live Neon Postgres (`Parts_Catalog`) — see [docs/data-sources/](../../docs/data-sources/) for what real profiling found there (including that `MOLAS_Live_2021_Cache`, the source named in the original brief, is almost entirely empty, and that the real spare-parts source of truth turned out to be a previously-unnamed existing "AutoHub" application).
- `matching/` — `CustomerMatchingService`/`LubricantMatchingService`/`PartConsolidationMatchingService`, real EXACT/HIGH_CONFIDENCE/POSSIBLE_MATCH/CONFLICT/NO_MATCH rules — never auto-merges below HIGH_CONFIDENCE.
- `import.service.ts` — matches then upserts into the existing, unmodified `Customer`/`Part`/`LubricantProduct`/`SalesDocument` tables.
- `manual-review.service.ts` / `reconciliation.service.ts` — the human-review queue and the per-batch count/financial (Decimal-accurate) reconciliation report.
- Odoo garage-quotation ingestion is documented but **not implemented** — no real, reachable access was confirmed; see [docs/data-sources/odoo-garage-profile.md](../../docs/data-sources/odoo-garage-profile.md).

Real result from the one controlled batch run against live production data on 2026-07-12: 4,247 real customers + 1,302 real lubricant products + 1,640 real sales orders (lubricants, last 90 days) + 9,154 real spare-parts item-master rows + 1,758 real spare-parts sales orders (last 90 days), reconciled with **zero count variance** and a financial reconciliation matching to the cent (1,217,676,208.36 TZS). See [docs/data-consolidation/real-data-architecture.md](../../docs/data-consolidation/real-data-architecture.md) for the full real results, including 241 real ambiguous customer matches correctly routed to human review rather than guessed.

**Data Validation, Business Baselining & AI Readiness** — see [docs/data-readiness/final-readiness-report.md](../../docs/data-readiness/final-readiness-report.md) for the full write-up. Still no new product features — this phase validates the data Data Consolidation imported, establishes reproducible business baselines, and produces evidence-based AI-readiness verdicts. `src/data-readiness/`:

- `authority/source-authority.service.ts` — a formal source-of-truth registry (append-only decision history); real rules seeded for Part/Lubricant/Customer/SalesDocument authority, with garage-quotation authority honestly `UNRESOLVED`.
- `quality/` — `CustomerQualityService`/`PartsQualityService`/`LubricantsQualityService`/`DataQualityScoringService` — real profiling (duplicate rates, missing-field rates, verification states) plus post-validation of the 1,116 real OEM-based part consolidations, which found 38 real category-level conflicts worth reviewing (592 brand-only differences are expected multi-supplier aftermarket coverage, not errors).
- `review/review-prioritization.service.ts` — real business-impact scoring (sales value, source-system count, conflict signals) of the existing 241 pending customer-match reviews, batching, richer decision types (`MERGE_APPROVED`/`KEEP_SEPARATE`/`LINK_AS_RELATED`/.../`ESCALATE`), and audited reversal — never auto-merges a canonical entity.
- `mapping/branch-warehouse-mapping.service.ts` — real analysis of source warehouse codes vs. this platform's existing `Warehouse` rows; finds no exact-code match and correctly leaves it `UNMAPPED` rather than guessing by name similarity.
- `document-semantics.ts` — pure, tested rules for which real document type drives which business metric, preventing double-counting across quotation/order/delivery/invoice/payment chains.
- `inventory-readiness.service.ts` — real per-business-unit inventory-strategy scoring (both lubricants and spare parts recommend Strategy B: opening balance + future movements — neither qualifies for full ledger reconstruction).
- `baseline/baseline.service.ts` — real, versioned, reproducible business KPI computation (22 real metrics in one run; re-running produces byte-identical checksums); inventory/garage metrics explicitly marked `NOT_READY`/`NOT_AVAILABLE`, never fabricated.
- `snapshot/data-snapshot.service.ts` — immutable, checksummed data snapshots for reproducible reporting/AI-dataset builds.
- `ai-readiness/ai-use-case-readiness.service.ts` — real, evidence-based readiness verdicts for 12 candidate DGX use cases (4 `READY_FOR_PROTOTYPE`, 1 `READY_FOR_OFFLINE_EVALUATION`, the rest `NEEDS_MORE_DATA`/`NEEDS_LABELING`/`BLOCKED_BY_SOURCE_ACCESS`) — vehicle-failure-remains-blocked is asserted, not assumed.
- `ml/` — real time-based/entity-grouped dataset splitting, automated leakage checks, and the one approved end-to-end `AIDatasetContract` (real lubricant per-item demand, built from a newly-added `SalesDocumentLine` importer).
- `rag/catalogue-rag-corpus.service.ts` — a real, provenance-preserving retrieval corpus (8,157 entries) — every lubricant entry honestly labeled `PARSED_UNVERIFIED` since no verified technical-spec source exists yet.
- Extends Phase 4's `src/forecasting/forecast-math.ts` with Croston's method (intermittent demand) and WAPE/MASE (so ranking never relies on MAPE alone) — real backtests run against 45 real forecast-eligible/intermittent lubricant items.
- No DGX Spark model training happens this phase — `docs/data-readiness/dgx-data-access-contract.md` defines the contract a future phase's DGX consumption must follow (approved snapshots/APIs only, never unrestricted transactional tables).

**DGX Prototype 1 — Automotive Catalogue RAG, Parts Intelligence & Verified Product Retrieval** — see [docs/ai/catalogue-rag-architecture.md](../../docs/ai/catalogue-rag-architecture.md) and [docs/ai/final-prototype-report.md](../../docs/ai/final-prototype-report.md) for the full write-up. The first real DGX-backed intelligence prototype, built only on the `READY_FOR_PROTOTYPE` catalogue use cases from the AI Readiness phase, reusing Phase 4's AI infrastructure (`RagService`, `VectorSearchService`, `KnowledgeBaseService`, `AiGatewayService`, `AiFeedbackService`, `AiEvaluationService`) rather than duplicating it. `src/catalogue-ai/`:

- `search/catalogue-search.service.ts` — deterministic, zero-DGX-dependency exact-identifier retrieval (internal code, OEM, alternate number, TecDoc id, supersession, keyword) with real, live-rechecked conflict flagging.
- `search/hybrid-ranking.ts` — strict match-type tier ordering; a semantic match can never structurally outrank an exact OEM match, regardless of score.
- `confidence-model.ts` / `corpus-eligibility.ts` — catalogue-specific confidence banding and corpus-indexing eligibility classification, both pure and unit-tested.
- `index-lifecycle/catalogue-index-version.service.ts` — blue-green vector index lifecycle (build → validate → approve → activate → retire/rollback), building a real corpus via Phase 4's `KnowledgeBaseService.ingestDocument()`. A real first run of this phase's own verification script caught a genuine rate-limiting bug (silently dropped ~200 of 230 real embedding calls); fixed with real client-side pacing — see [docs/ai/vector-index-lifecycle.md](../../docs/ai/vector-index-lifecycle.md).
- `relationships/part-relationship.service.ts` — the real supersession/kit/replacement graph beyond what `PartCompatibility`/`PartMatchCandidate` already cover; every relationship starts `PENDING`, never auto-verified.
- `comparison/product-comparison.service.ts` — structured part/lubricant comparison; never concludes interchangeability without real evidence.
- `rag/catalogue-rag.service.ts` — deterministic-lookup-first RAG orchestrator; an obvious exact identifier never reaches the LLM before a real database lookup is tried.
- `evaluation/` — real offline evaluation (self-consistency ground truth from real catalogue rows) with pure retrieval/generation metric functions. Real measured result on a representative sample: Recall@1/3/5 = 1.0 (deterministic retrieval), but generation groundedness (0.1999) and unsupported-claim rate (0.3333) do not yet clear the acceptance thresholds — honest verdict is **NEEDS_TUNING**, not production-ready.
- Only `nomic-embed-text` and `llama3` are locally available in this environment — the spec's multi-model comparisons are honestly scoped to one model each; see [docs/ai/embedding-model-evaluation.md](../../docs/ai/embedding-model-evaluation.md) and [docs/ai/llm-model-evaluation.md](../../docs/ai/llm-model-evaluation.md).
- `scripts/verify-dgx-catalogue-rag.ts` — the real, 36-step verification script, every step labeled Executed/Passed/Failed/Skipped/Deferred; includes a genuine DGX-unavailable fallback test (a second, isolated application context pointed at an unreachable DGX URL) proving deterministic search keeps working while the semantic path degrades honestly.

**DGX Prototype 1.5 — AI Evaluation, Prompt Engineering, Retrieval Optimization & Safety Tuning** — see [docs/ai-tuning/final-tuning-report.md](../../docs/ai-tuning/final-tuning-report.md) and [docs/ai-tuning/decision-log.md](../../docs/ai-tuning/decision-log.md) for the full write-up. No new business features — this phase tunes the Prototype 1 catalogue RAG system from its `NEEDS_TUNING` verdict toward controlled internal daily use:

- An immediate security hotfix (identity endpoints no longer leak `passwordHash`/`mfaSecretEncrypted`/etc. — `src/identity/dto/auth.dto.ts`'s `USER_SAFE_SELECT`), landed and regression-tested before any AI tuning work began.
- `rag/query-understanding.ts` — the deterministic query classifier now also extracts a single embedded identifier-shaped token from a longer sentence (any language), not just whole-string identifiers — a real bug this phase's own live verification found (a Swahili-mixed query's OEM number was silently dropped) and fixed.
- `rag/catalogue-rag.service.ts` — rewritten generative path: evidence grouped by quality, a narrow structured-JSON schema (`format: "json"`), post-generation claim verification against real retrieved evidence text, and citation validation — replacing Prototype 1's free-text, unverified generation.
- `evaluation/ground-truth.ts` — ground-truth governance (`DRAFT`/`REVIEW_REQUIRED`/`APPROVED`/`CONFLICTING`/`RETIRED`); only `APPROVED` cases count toward official metrics, enforced as real filtering code.
- `evaluation/calibration-metrics.ts` — reliability diagram, Expected Calibration Error, Brier score — real functions, honestly run against a small real sample (see [docs/ai-tuning/confidence-calibration.md](../../docs/ai-tuning/confidence-calibration.md) for why no larger calibration dataset exists yet).
- `scripts/verify-dgx-prototype-1-5.ts` — the real, 40-step verification script. Its first live run surfaced several real bugs — a recall-metric collection gap (missing `INTERNAL_CODE`/`TECDOC_ID` coverage), a groundedness-averaging methodology gap (zero-evidence `NO_ANSWER` cases skewing the average), and a verify-script self-reporting bug (a step hardcoding a pass) — all found, fixed, and reverified live within this same phase; see the decision log.
- Honest verdict: **PILOT_READY** for controlled internal shadow-mode use (`CATALOGUE_RAG_SHADOW_MODE`, every answer visibly advisory) — not production-ready. The main named limitation: generation-quality metrics currently rest on n=1 real evidence-bearing generative case in the officially-approved evaluation set; growing that sample is the top recommended next step.

**DGX Prototype 1.6 — Automotive AI Evaluation Framework** — see [docs/ai-evaluation/production-readiness.md](../../docs/ai-evaluation/production-readiness.md) and [docs/ai-evaluation/decision-log.md](../../docs/ai-evaluation/decision-log.md) for the full write-up. No new business feature — builds the evaluation platform every future AI capability must pass through, in a new `src/ai-benchmark/` directory deliberately separate from the existing, differently-scoped Phase 4/5 `src/ai-evaluation/`:

- `registry/benchmark-registry.service.ts` — append-only `Benchmark`/`BenchmarkCase`/`BenchmarkRun` versioning with immutable, checksum-verified Gold Dataset freezing (`addCases()` on a frozen benchmark is rejected).
- `categories/category-taxonomy.ts` — 16 independently-scored categories (retrieval, generation with nested hallucination/citation sub-scores, safety, prompt injection, security, Swahili/English/mixed-language, reasoning, performance/latency/reliability, production readiness, and more) — never blended into one score.
- `experiments/prompt-experiment.service.ts` — real 2-arm-and-up A/B prompt testing with metric-only winner selection, reusing `PromptRegistryService`'s existing publish/revert mechanics rather than a parallel versioning system.
- `embedding-reranker/` — embedding/reranker comparison, honestly scoped to whatever model(s) are actually locally available in this environment (single-candidate today).
- `pipeline/regression-detector.ts` / `pipeline/quality-gates.ts` — real two-run metric comparison and a 7-gate pass/fail decision, including a `HUMAN_APPROVAL` gate that never auto-passes.
- `leaderboard/leaderboard.service.ts` / `reports/` — 16 independent per-category leaderboards and a self-contained static HTML dashboard (no Grafana in this environment).
- `scripts/verify-ai-evaluation-framework.ts` — the real 41-step verification script. Its first live run found and fixed two real defects (a dead-code lint failure in `runPermissionEnforcementCategory()`, and a relative-path bug that crashed the HTML-report/docs-completeness steps).
- Honest verdict: **PILOT_READY** as infrastructure — no AI feature's production readiness is certified by this phase; three named conditions (REASONING cases, Swahili/mixed-language fluency review, multi-model comparison) remain before full maturity.

**DGX Prototype 1.7 — Automotive Knowledge Platform** — see [docs/knowledge-platform/final-report.md](../../docs/knowledge-platform/final-report.md) and [docs/knowledge-platform/decision-log.md](../../docs/knowledge-platform/decision-log.md) for the full write-up. No new business feature — builds the governed knowledge layer every future AI capability (Catalogue AI, Demand Forecasting, Predictive Maintenance, Technician Copilot, Management Assistant, Customer Service Assistant) will consume, in a new `src/knowledge-platform/` directory:

- `source-registry/knowledge-source-registry.service.ts` — a real license-eligibility gate (`assertPublishEligible()`); a non-`INTERNAL_WORKSHOP` source must be license-verified before any of its items can publish.
- `versioning/knowledge-item-registry.service.ts` — append-only `KnowledgeItem`/`KnowledgeItemVersion`, a direct structural mirror of `BenchmarkRegistryService`; publishing materializes exactly one companion `KnowledgeDocument` via the existing, unmodified `KnowledgeBaseService.ingestDocument()`, inheriting real chunk/embed/`isApproved`-gated retrieval for free.
- `provenance/knowledge-claim.service.ts` / `structured-facts/structured-fact.service.ts` — deterministic (never LLM) claim extraction with exact-substring evidence, and a structured-facts table gated by `extractedBy`/`reviewedAt` so an unreviewed LLM-assisted fact never reaches an AI consumer.
- `ingestion/ingestion-pipeline.service.ts` — an 11-real-stage pipeline over 5 real zero-dependency formats (text/markdown/html/csv/json); PDF/DOCX honestly `DEFERRED` with a documented error, never a silent no-op.
- `security/document-injection-scanner.ts` — a document-ingestion-specific prompt-injection defense (stricter block/quarantine posture, per-finding offsets) distinct from the existing chat-facing `prompt-sanitizer.ts`/`query-understanding.ts` defenses.
- `review-workflow/`, `conflicts/`, `expiry-supersession/`, `snapshots/`, `graph/` — multi-reviewer review workflow, deterministic conflict detection/resolution, expiry/supersession with a real lock-step visibility invariant, blue-green immutable snapshots, and a 2-table Postgres-relational knowledge graph (bounded-depth BFS, no separate graph database).
- `retrieval/knowledge-retrieval.service.ts` — the strict AI-consumer contract: deterministic authority-ranked, expiry/restriction-excluded retrieval with real citations, plus an additive, feature-flagged (`KNOWLEDGE_PLATFORM_CATALOGUE_INTEGRATION_ENABLED`, default off) enrichment point for Catalogue AI.
- `src/ai-benchmark/` gained one new `KNOWLEDGE` evaluation category (7 independent sub-scores) reusing `freezeAsGold()` unmodified for a Gold Knowledge Dataset.
- `scripts/verify-automotive-knowledge-platform.ts` — the real 45-step verification script. Its live runs found and fixed real defects: a missing `AiBenchmarkModule` DI wiring (would have crashed app bootstrap), a missing graph node/edge type for lubricant-approval relationships, and several test-fixture bugs in the verify script itself (never the services under test) — see the decision log.
- Honest verdict: **KNOWLEDGE_PLATFORM_PILOT_READY** — named limitations: no real licensed OEM content ingested yet (every source is internal or test-labeled), PDF/DOCX/OCR/malware-scanning deferred, the 19-screen portal UI deferred (API/CLI only), encryption-at-rest adapter built but not yet wired to a call site, and no dedicated Prometheus metrics for Knowledge Platform events yet.

**DGX Prototype 1.7.1 — Trusted Automotive Knowledge Onboarding, Validation and Evaluation Pilot** — see [docs/trusted-knowledge-pilot/final-report.md](../../docs/trusted-knowledge-pilot/final-report.md) and [docs/trusted-knowledge-pilot/decision-log.md](../../docs/trusted-knowledge-pilot/decision-log.md) for the full write-up. No new business feature, no Knowledge Platform redesign, no Evaluation Framework rebuild — closes DGX 1.7's named limitations above with real content and real infrastructure:

- Real ETL from two already-live company systems, composed (never rebuilt) over the existing `MolasLubricantsCacheAdapter`/`PartsCatalogAutoHubAdapter`: 362 real Liqui Moly lubricant rows (structured fields only — marketing text/image URLs excluded, see licensing-decisions.md), 15,723 real TecDoc articles, a bounded 50,000-edge real fitment-graph sample out of 3,378,514 real rows, 7 real internal repair cases, and 8 self-authored workshop SOPs.
- `permissions/knowledge-source-permission.service.ts` — a new 13-action permission matrix (`KnowledgeSourcePermission`), enforced together with (never instead of) DGX 1.7's existing legacy boolean source flags via AND logic.
- `acquisition/document-acquisition.service.ts` — real checksum/MIME-magic-byte/size/zip-bomb/password-protection checks, real EICAR malware detection, and a real (if locally inactive — no ClamAV binary in this sandbox) ClamAV adapter.
- `parsing/parsers/pdf.parser.ts` / `docx.parser.ts` — real `pdf-parse`/`mammoth` extraction, real `tesseract.js` OCR fallback, closing DGX 1.7's `DEFERRED_FORMATS` gap entirely.
- `security/document-encryption-key.service.ts` — real AES-256-GCM encryption at rest with key rotation, mirroring the existing `JwtKeyService` pattern, wired into `IngestionPipelineService.ingest()` for `RESTRICTED`-classified sources.
- `extraction-profiles/`, `entity-normalization/` — 11 versioned per-document-type extraction profiles; normalization functions that preserve original forms (`5W-30` never silently becomes `5W30`) while distinguishing approval-vs-recommendation, fitment-vs-compatibility, and supersession-vs-alternative.
- `review-workflow/` gained dual-review and escalation; `conflicts/` gained a new cross-source approval-status-mismatch comparator; `graph/` gained 8 new relationship types (`FITS`, `HAS_ALTERNATIVE`, `REQUIRES_TORQUE`, `SUPERSEDED_BY`, etc.).
- `src/ai-benchmark/pipeline/trusted-knowledge-quality-gates.ts` — a new, separate 8-gate evaluator (DGX 1.6's `quality-gates.ts` untouched), gating real snapshot activation.
- Real corpus scale: 16,138 `KnowledgeItem`s, 17,129 structured facts, 32,293 claims, 50,002 `FITS` graph edges, 123 published item versions.
- `scripts/verify-trusted-knowledge-onboarding.ts` — the real 70-step verification script. 70/70 steps passed; real defects found and fixed included a rate-limit tight-loop bug that silently broke most real embeddings, an OCR presence-threshold bug, a claim-extraction pattern gap, and a gold-benchmark idempotency bug.
- Honest verdict: **NEEDS_MORE_TUNING** — every real infrastructure/security/parsing/review/conflict/graph/snapshot/portal/metrics step passes; two of eight trusted-knowledge quality gates (exact-identifier Recall@1, MRR) genuinely fail because generically-titled real catalogue content ranks lower than distinctively-worded content in the existing retrieval index — a real, investigated, honestly reported limitation, not a defect, and not fixed this phase since it would require redesigning retrieval ranking (out of scope). Snapshot activation was correctly blocked, never forced.

**DGX Prototype 1.7.2 — Retrieval Intelligence Platform** — see [docs/retrieval-intelligence/final-report.md](../../docs/retrieval-intelligence/final-report.md) and [docs/retrieval-intelligence/decision-log.md](../../docs/retrieval-intelligence/decision-log.md) for the full write-up. The final AI Foundation phase — no new AI capability. Directly closes DGX 1.7.1's own named retrieval-ranking limitation, in a new `src/retrieval-intelligence/` module:

- `query-understanding/` — a real 21-class query classifier (identifier/language/typo classes), real formatting-variant normalization (reusing the existing 3-tier `normalizeIdentifierForSearch()`), a real dictionary-based Swahili/English/mixed-language detector, real Levenshtein-based typo/approximate-search detection.
- `strategy/` — a pure decision table selecting which of 13 real retrieval strategies and 10 hybrid modes to run per query class — identifier-shaped queries always try deterministic exact lookup first, never "run everything."
- `ranking/` — a real, explainable 15-signal ranking engine (`combineSignals()`) with a structural, tested guarantee that a real exact-identifier match always outranks a non-exact one; a real Okapi BM25 implementation (not the existing simpler TF scorer mislabeled); a documented (not implemented) Learning-to-Rank seam mirroring the existing `VectorIndexProvider` pattern.
- `graph-expansion/` — an additive-only wrapper over the existing, unmodified `KnowledgeGraphService.traverse()`; 3 new graph edge types (`HAS_ENGINE`, `HAS_TRANSMISSION`, `RELATED_TO`); real `HAS_ENGINE` edges populated from the real (if small) internal `Vehicle` table.
- `pipeline/retrieval-pipeline.service.ts` — the real 16-stage orchestration, persisting a real `RetrievalQueryLog` row for every run.
- `lab/retrieval-lab.service.ts` — real Query Lab replay/A-B strategy comparison over real logged queries.
- Real, additive, feature-flagged (`RETRIEVAL_INTELLIGENCE_ENABLED`) wiring into both `CatalogueRagService` and `KnowledgeRetrievalService` via a genuinely resolvable circular module dependency (`forwardRef()`, confirmed by booting the full app) — neither consumer's public API changed. In wiring `KnowledgeRetrievalService`, three real, confirmed DGX-1.7-era bugs were fixed: `knowledgeDomains`/`vehicleContext` were accepted but never used, and `allowConflicts` was a confirmed no-op (both ternary branches returned the same value).
- `src/ai-benchmark/pipeline/retrieval-intelligence-quality-gates.ts` — a new, separate 10-gate evaluator (DGX 1.6's `quality-gates.ts` and DGX 1.7.1's `trusted-knowledge-quality-gates.ts` both untouched).
- A real 1,840-case gold evaluation dataset (`RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1`), composed from reused DGX 1.6 generators plus new real fitment/lubricant/engine-code/VIN/procedure/typo/no-answer/restricted-content generators.
- `scripts/verify-retrieval-intelligence.ts` — the real 31-step verification script. 31/31 steps passed; real defects found and fixed included an `APPROVAL_PATTERN` false positive on internal item codes, a typo-detection ordering bug, and two distinct real citation-mislabeling bugs (graph-relationship candidates and legacy pre-DGX-1.7 Catalogue AI documents were both falsely claimed to be citable `KNOWLEDGE_ITEM` content).
- Honest verdict: **NEEDS_MORE_TUNING** — every real query-understanding/strategy/ranking/graph/pipeline/citation/metrics/health step passes; 3 of 10 quality gates (Recall@1, MRR, identifier accuracy) genuinely fail on the semantic-search portion of the real gold set — a real, investigated, honestly reported tuning gap, not a defect.

**AI Foundation Certification Sprint** — see [docs/ai-foundation-certification/final-report.md](../../docs/ai-foundation-certification/final-report.md) and [docs/ai-foundation-certification/decision-log.md](../../docs/ai-foundation-certification/decision-log.md) for the full write-up. The final AI Foundation phase — closes DGX 1.7.2's `NEEDS_MORE_TUNING` gap under an explicit architecture freeze: retrieval tuning only, no new module/service/database/API, no schema migration.

- Root-caused and fixed real query-classification/candidate-generation bugs in the existing, unmodified `retrieval-intelligence/` module — never a ranking-weight rewrite: pure-numeric OEM numbers (38.6% of the real catalogue) falling to `UNKNOWN`; a `candidateIdentifier` bug skipping the catalogue lookup's own strict-match cascade; a real trailing-`+` OEM convention and embedded pure-numeric identifiers never extracted; no deterministic tie-break for genuine duplicate-OEM rows; a real embedding-model artifact (0.7 cosine similarity for a nonexistent identifier-shaped query) fixed by suppressing vector-origin candidates when identifier-shaped exact lookup finds nothing real.
- Validating against the *full* 1,840-case gold set (not just the 150-case sample) revealed a real, honest residual gap the smaller sample missed — real short (3-character) and long ("/"-joined) OEM numbers outside the classifier's length bounds, and a real, rare pure-alphabetic engine code — fixed in two measured rounds, the second of which fixed an over-strict guard the first round itself introduced.
- New `src/ai-benchmark/reports/certification-data.ts` + `certification-dashboard.ts` — a dedicated Certification Dashboard (`GET /ai/dashboard/certification/html`), reusing the existing DGX 1.6 dashboard pattern and `PermissionsGuard`.
- `build-retrieval-intelligence-gold-eval-v2.ts` — Gold Dataset v2 (1,851 real cases: all 1,840 v1 cases carried forward unchanged + 11 new real regression cases), checksum-verified.
- `scripts/verify-ai-foundation-certification.ts` — the real 13-step final verification script. 13/13 steps passed on its confirmed clean run; a real field-access bug found in the script itself during its first run (reading a persisted `BenchmarkRun`'s gate inputs from the wrong nested JSON key) was fixed and re-verified, not silently patched over.
- Honest verdict: **AI_FOUNDATION_CERTIFIED** — every mandatory Retrieval Quality Gate passes on the full, real 1,851-case gold set (Recall@1=0.986, MRR=0.988, Identifier Accuracy=1.000 exact, zero wrong-fitment/supersession/lubricant-approval/leakage, p95 latency 2,878ms), full regression suite clean (146/146 suites, 862/862 tests), zero gates waived except the one honestly-unwaivable `NO_REGRESSION_VS_1_7_1` baseline comparison. Per this phase's own transition rule, the AI Foundation is now permanently complete — future work moves to capability layers (DGX 2.0-6.0); no further AI Foundation prototypes will be created.

## Setup

```bash
npm install
cp .env.example .env          # set DATABASE_URL to your Postgres instance
docker compose up -d          # starts Postgres (or point DATABASE_URL at any Postgres 14+)
npx prisma migrate deploy     # applies all migrations
npm run start:dev
```

If you don't have Docker, any reachable PostgreSQL 14+ works — just set
`DATABASE_URL` in `.env`. (This repo's own verification run used a portable,
non-Docker PostgreSQL 16 instance for exactly this reason.)

### Phase 4: the DGX AI service

Phase 4 needs a running Ollama instance (`https://ollama.com`, `ollama pull llama3` and
`ollama pull nomic-embed-text` at minimum) and the Python FastAPI boundary in front of it:

```bash
cd services/dgx-ai-platform
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8800   # port 8000 is Windows-reserved on this box; use whatever's free
```

`operational-core`'s `DgxClientService` defaults to `http://127.0.0.1:8800` — override with
`DGX_SERVICE_URL` in `.env` if you run the FastAPI service on a different port or host (e.g.
pointed at a real DGX Spark's Ollama instance later). Every Phase 4 integration test and the
Phase 4 verification script require this service (and therefore Ollama) to be reachable — see
[docs/architecture/dgx-platform.md](../../docs/architecture/dgx-platform.md).

### Phase 5: Redis, JWT/encryption secrets, and the optional CDC/Neon-cache clusters

Phase 5's integration tests and `verify-phase5.ts` need a few more things running. Most of it
is a single real Redis instance — this environment has no system Redis, so
`scripts/start-dev-redis.js` starts a genuine Redis binary (via `redis-memory-server`) on port
16379:

```bash
node scripts/start-dev-redis.js   # prints REDIS_URL=redis://127.0.0.1:16379 — leave it running
```

Set in `.env` (see `.env` in this repo for the actual values used in this build's own
verification run): `REDIS_URL`, `ENCRYPTION_KEY`, `JWT_SECRET_CURRENT`, `JWT_KID_CURRENT`,
`BRANCH_GATEWAY_SIGNING_KEY`. These are required — `env-validation.ts` fails startup if any
required Phase 5 secret is missing.

Two more pieces are **optional** and only needed for their specific integration test files:

- **CDC** (`cdc.integration-spec.ts`) needs a second, separate PostgreSQL cluster with
  `wal_level=logical` (the default shared dev database runs `wal_level=replica`, which real
  logical replication cannot use) — set `CDC_TEST_HOST`/`CDC_TEST_PORT`/`CDC_TEST_DATABASE`.
  See [docs/architecture/cdc.md](../../docs/architecture/cdc.md) for why this is a separate
  cluster rather than a setting flipped on the shared database.
- **Neon cache** (`neon-cache-sync.integration-spec.ts`) needs a second local database (no
  live Neon account exists here) — set `NEON_DATABASE_URL` to a second database on your
  Postgres instance (e.g. `aios_neon_cache`). See [docs/architecture/neon-cache.md](../../docs/architecture/neon-cache.md).

Backups (`backup.integration-spec.ts`, `BackupService`) shell out to real `pg_dump`/`psql` —
set `PG_DUMP_PATH`/`PSQL_PATH` to your Postgres installation's binaries and `BACKUP_DIR` to a
writable directory.

None of the above blocks Phases 1–4's tests or the base application from running — only the
specific Phase 5 suites that need that particular piece of infrastructure.

### Data Consolidation: real production source credentials (optional — only needed to re-run against live data)

`scripts/verify-real-data-consolidation.ts` and the real adapters connect to live company systems.
The automated test suite never touches these — `data-consolidation.integration-spec.ts` uses only
fake, in-memory source adapters against the (separate) test database. To re-run the real
verification script, set in `.env`:

```bash
SQLSERVER_HOST=localhost            # or the real SQL Server host/instance
SQLSERVER_USER=sa                   # or a scoped db_datareader login — see docs/data-consolidation/decision-log.md
SQLSERVER_PASSWORD=...
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_SERVER_CERT=true
SQLSERVER_MOLAS_LUBRICANTS_DATABASE=MolasCacheDb
SQLSERVER_MOLAS_SPARES_DATABASE=MOLAS_Live_2021_Cache   # profiled, not ingested — see docs/data-sources/molas-live-2021-cache-profile.md
NEON_PARTS_CATALOG_DATABASE_URL="postgresql://user:pass@host/Parts_Catalog?sslmode=require"
```

Every adapter issues `SELECT` statements only — see [docs/data-sources/source-data-risks.md](../../docs/data-sources/source-data-risks.md)
for why this is a code-discipline guarantee, not a database-permission one, given the credential
provided in this build was `sa` (full instance access). Run the real, controlled batch:

```bash
npx ts-node -T scripts/verify-real-data-consolidation.ts
```

It profiles both real sources' connectivity, stages and imports a bounded real batch (full
customer/product master data, last-90-days sales orders), reconciles counts and financial totals,
proves idempotency by re-running the identical batch, proves safe updates by simulating one
corrected source record (never written back to the source), and proves cursor safety by
simulating one source-connection failure — then re-verifies the real source row counts are
unchanged. See [docs/data-consolidation/real-data-architecture.md](../../docs/data-consolidation/real-data-architecture.md)
for the real results from the run performed in this build.

## Seeding master data and running the verification workflow

`scripts/verify-phase2.ts` is both a seed script and an executable
walkthrough of every Phase 2 requirement — it seeds organizations, branches,
warehouses, customers, suppliers, and lubricants; syncs vehicles, parts,
purchases, and sales (twice each, to prove idempotency, plus once more with a
corrected record); posts opening-balance inventory movements; records goods
receipts; ingests app events; detects and reviews lost sales; recalculates
inventory analytics; generates and reviews both recommendation types; and
recalculates supplier analytics. Run it against a fresh database:

```bash
npx prisma migrate deploy
npx ts-node -T scripts/verify-phase2.ts
```

It's safe to re-run from a clean database (`npx prisma migrate reset` first,
or drop/recreate). It is **not** designed to be re-run against a database
that already has its data — the sales-correction step copies a file into
`sample-data/legacy-sales/`; delete `batch-002-correction.ndjson` from that
directory before re-running from scratch.

`scripts/verify-phase3.ts` continues directly from Phase 2's seeded data (run
`verify-phase2.ts` first) and walks through the full garage lifecycle:
technician/labour seeding, checklist/inspection templates, vehicle reception
(plus a deliberate lower-mileage second reception to trigger the
impossible-mileage-decrease check), job creation (plus a deliberate duplicate
job card), an illegal status transition (rejected), inspection recording, a
diagnostic session with a confirmed cause, an estimate with a partial
approval, part reservation (plus a deliberate duplicate reservation),
technician time logging (plus a deliberate overlapping assignment), labour
recording, part issue/return through the ledger, QC/road-test/customer
approval, invoice generation via `convertToInvoice`, job completion, a
second job pushed to `READY_FOR_COLLECTION` with nothing recorded (to show
the missing-QC/road-test/estimate flags firing), repeat-repair detection and
resolution, Digital Twin and Timeline retrieval, workshop analytics, a
workshop inventory request linked to Phase 2's recommendation engines, and
notifications (including an overdue-job scan and mark-read). Run it against
a freshly migrated database, after `verify-phase2.ts`:

```bash
npx prisma migrate deploy
npx ts-node -T scripts/verify-phase2.ts
npx ts-node -T scripts/verify-phase3.ts
```

`scripts/verify-phase4.ts` continues from there (run `verify-phase2.ts` and `verify-phase3.ts`
first) and requires the DGX FastAPI service running (see above). It walks through: a real
Ollama model sync into the Model Registry, real embedding + generation calls with full
inference logging, ingesting and approving a real knowledge document, a RAG chat answer
grounded in that document (plus a deliberately irrelevant query to show the "insufficient
evidence" path), Digital Twin Intelligence scoring on a vehicle with repeat brake-related
DTCs, a demand forecast with multi-method backtesting, an AI-enhanced purchase
recommendation, all four AI assistants, feedback recording and acceptance-rate calculation,
and a real retrieval-precision/recall evaluation run:

```bash
npx prisma migrate deploy
npx ts-node -T scripts/verify-phase2.ts
npx ts-node -T scripts/verify-phase3.ts
npx ts-node -T scripts/verify-phase4.ts
```

`scripts/verify-phase5.ts` continues from there (run `verify-phase2.ts`, `verify-phase3.ts`,
and `verify-phase4.ts` first) and walks through: real user registration/login/JWT issuance,
refresh-token rotation, MFA enrollment and confirmation, session listing and revocation,
policy-based scope checks (an org-wide role vs. a branch-scoped role against the same
resource), organization configuration, a Redis-backed rate-limit/lock/queue exercise, an
idempotent request replay, a SAP B1/Odoo adapter sync against mocked contracts, a Branch
Gateway enqueue/replay/conflict-resolution walkthrough, a notification send/retry with a real
webhook delivery, a real backup + restore-validation run, and a Prometheus metrics read-back:

```bash
npx prisma migrate deploy
npx ts-node -T scripts/verify-phase2.ts
npx ts-node -T scripts/verify-phase3.ts
npx ts-node -T scripts/verify-phase4.ts
npx ts-node -T scripts/verify-phase5.ts
```

`scripts/verify-data-baseline-ai-readiness.ts` continues from there and walks through the
Data Validation/Business Baselining/AI Readiness phase (source-authority registry, quality
profiling, prioritized review, an approved baseline run, a data snapshot, the lubricant-demand
dataset build, and AI-readiness verdicts). `scripts/verify-dgx-catalogue-rag.ts` continues from
there again — the DGX Prototype 1 verification: selects an approved snapshot, builds a real
(representative-sample) vector index, runs deterministic/semantic/adversarial/lubricant/
comparison/RAG-answer queries, a manual-review handoff, feedback capture, a genuine
DGX-unavailable fallback test, and the real offline evaluation suite:

```bash
npx prisma migrate deploy
npx ts-node -T scripts/verify-phase2.ts
npx ts-node -T scripts/verify-phase3.ts
npx ts-node -T scripts/verify-phase4.ts
npx ts-node -T scripts/verify-phase5.ts
npx ts-node -T scripts/verify-real-data-consolidation.ts
npx ts-node -T scripts/verify-data-baseline-ai-readiness.ts
npx ts-node -T scripts/verify-dgx-catalogue-rag.ts
```

## Web Management Portal

`services/web-portal/` is a real Vite + React + TypeScript app — login (with MFA prompt when
required), automatic JWT refresh-on-401, and Executive/Branch/User-Management/System-Health
pages, all calling this API's real endpoints (no mocked data).

```bash
cd services/web-portal
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:3900" > .env   # point at your running backend
npm run dev
```

Verified in this environment via a real production build (`npm run build`, 245 KB JS / 78 KB
gzip) plus real end-to-end API integration testing — registering a real admin user, logging in
for a real JWT, and confirming every endpoint each page calls returns real data with that
token. **No browser automation tool is available in this environment**, so visual
browser-rendering verification was not performed; this is reported honestly rather than
implied.

## Example API calls

Auth is real as of Phase 5 — see [docs/architecture/identity-platform.md](../../docs/architecture/identity-platform.md).
Register/login for a real JWT, then call any endpoint with `Authorization: Bearer <token>`.
The legacy `x-user-role` header stand-in from Phases 1–4 still works unchanged (both are
accepted by `getRequestActor()`), so every example below continues to work as written:

```bash
# Phase 5: register, log in, use a real JWT
curl -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" \
  -d '{"email": "admin@aios.local", "password": "Str0ngP@ssw0rd!", "name": "Admin", "role": "GENERAL_MANAGER"}'
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email": "admin@aios.local", "password": "Str0ngP@ssw0rd!"}'
# -> { "tokens": { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 } }
curl http://localhost:3000/workshop-analytics/dashboard -H "Authorization: Bearer <accessToken>"

# Legacy stand-in header — still works unchanged
```

```bash
# Inventory: current balance for an item at a warehouse
curl "http://localhost:3000/inventory/balance?itemType=PART&partId=<id>&warehouseId=<id>" \
  -H "x-user-role: STOREKEEPER"

# Purchase recommendations: generate, then review
curl -X POST http://localhost:3000/purchase-recommendations/generate -H "x-user-role: PURCHASING_MANAGER"
curl http://localhost:3000/purchase-recommendations -H "x-user-role: PURCHASING_MANAGER"
curl -X PATCH http://localhost:3000/purchase-recommendations/<id>/approve \
  -H "x-user-role: PURCHASING_MANAGER" -H "Content-Type: application/json" \
  -d '{"decidedById": "user-1", "decisionNote": "Approved for next PO batch"}'

# Transfer recommendations
curl -X POST http://localhost:3000/transfer-recommendations/generate -H "x-user-role: BRANCH_MANAGER"
curl http://localhost:3000/transfer-recommendations -H "x-user-role: BRANCH_MANAGER"

# Lost sales: detect, list, confirm
curl -X POST http://localhost:3000/lost-sales/detect -H "x-user-role: PARTS_MANAGER"
curl http://localhost:3000/lost-sales -H "x-user-role: PARTS_MANAGER"
curl -X PATCH http://localhost:3000/lost-sales/<id>/confirm \
  -H "x-user-role: PARTS_MANAGER" -H "Content-Type: application/json" \
  -d '{"resolvedById": "user-1", "resolutionReason": "Confirmed with customer"}'

# Garage jobs: create, transition, assign a technician
curl -X POST http://localhost:3000/garage-jobs -H "x-user-role: GARAGE_MANAGER" \
  -H "Content-Type: application/json" -d '{"vehicleId": "<id>", "branchId": "<id>"}'
curl -X PATCH http://localhost:3000/garage-jobs/<id>/transition \
  -H "x-user-role: TECHNICIAN" -H "Content-Type: application/json" \
  -d '{"newStatus": "CHECKED_IN", "reason": "Vehicle checked in at reception"}'
curl -X POST http://localhost:3000/garage-jobs/<id>/assignments \
  -H "x-user-role: WORKSHOP_SUPERVISOR" -H "Content-Type: application/json" \
  -d '{"technicianId": "<id>", "role": "TECHNICIAN"}'

# Estimates: respond to a customer approval, then convert to invoice
curl -X PATCH http://localhost:3000/estimates/approval-requests/<id>/respond \
  -H "x-user-role: SERVICE_ADVISOR" -H "Content-Type: application/json" \
  -d '{"lineDecisions": [{"estimateLineId": "<id>", "decision": "APPROVED"}]}'
curl -X POST http://localhost:3000/estimates/<id>/convert-to-invoice -H "x-user-role: GARAGE_MANAGER"

# Vehicle Digital Twin and Timeline
curl http://localhost:3000/vehicles/<vehicleId>/digital-twin -H "x-user-role: SERVICE_ADVISOR"
curl http://localhost:3000/vehicles/<vehicleId>/timeline -H "x-user-role: SERVICE_ADVISOR"

# Phase 4: RAG chat (answers only from approved knowledge, never hallucinates)
curl -X POST http://localhost:3000/ai/chat -H "x-user-role: SERVICE_ADVISOR" \
  -H "Content-Type: application/json" -d '{"question": "What causes a P0301 misfire code?"}'

# Phase 4: Digital Twin Intelligence — health/risk scoring and predicted maintenance
curl http://localhost:3000/ai/vehicle-health/<vehicleId> -H "x-user-role: SERVICE_ADVISOR"
curl http://localhost:3000/ai/predict-maintenance/<vehicleId> -H "x-user-role: SERVICE_ADVISOR"

# Phase 4: forecast, then read it back
curl -X POST http://localhost:3000/ai/forecast -H "x-user-role: GARAGE_MANAGER" \
  -H "Content-Type: application/json" -d '{"targetType": "GARAGE_WORKLOAD", "targetId": "<branchId>", "windowDays": 30}'
curl "http://localhost:3000/ai/forecast?targetType=GARAGE_WORKLOAD&chosenAsBest=true" -H "x-user-role: GARAGE_MANAGER"

# Phase 4: AI assistants
curl -X POST http://localhost:3000/ai/technician-assistant -H "x-user-role: TECHNICIAN" \
  -H "Content-Type: application/json" -d '{"vehicleId": "<id>", "symptoms": ["rough idle"], "dtcCodes": ["P0301"]}'
curl http://localhost:3000/ai/recommend-parts/<partId> -H "x-user-role: PARTS_MANAGER"
curl -X POST http://localhost:3000/ai/recommend-lubricant -H "x-user-role: LUBRICANTS_MANAGER" \
  -H "Content-Type: application/json" -d '{"brand": "BMW", "model": "5 Series", "engineCode": "N20"}'
curl -X POST http://localhost:3000/ai/manager-assistant -H "x-user-role: GENERAL_MANAGER" \
  -H "Content-Type: application/json" -d '{"question": "Which parts are becoming dead stock?"}'

# Phase 4: model registry, GPU health
curl -X POST http://localhost:3000/ai/model-registry/sync -H "x-user-role: GENERAL_MANAGER"
curl http://localhost:3000/ai/model-registry/gpu-health -H "x-user-role: GENERAL_MANAGER"

# Phase 5: MFA enrollment, sessions, API platform health/metrics
curl -X POST http://localhost:3000/auth/mfa/enroll -H "Authorization: Bearer <accessToken>"
curl http://localhost:3000/auth/sessions -H "Authorization: Bearer <accessToken>"
curl http://localhost:3000/health
curl http://localhost:3000/metrics

# Phase 5: Branch Gateway enqueue + replay
curl -X POST http://localhost:3000/branch-gateway/<branchId>/enqueue \
  -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d '{"payload": {"type": "job-update", "jobId": "<id>"}}'
curl http://localhost:3000/branch-gateway/<branchId>/queue -H "Authorization: Bearer <accessToken>"

# Phase 5: notifications
curl -X POST http://localhost:3000/notifications/send -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" -d '{"userId": "<id>", "channel": "IN_APP", "templateKey": "job-ready", "variables": {}}'

# Phase 5: backup + restore validation
curl -X POST http://localhost:3000/backup/full -H "Authorization: Bearer <accessToken>"
curl http://localhost:3000/backup/runs -H "Authorization: Bearer <accessToken>"
```

## Recommendation / lost-sales / transfer walkthroughs

Run `scripts/verify-phase2.ts` and read its console output top to bottom —
each step is labeled and prints the actual generated recommendations,
lost-sale candidates, and their evidence. The sample data is specifically
constructed so a single run produces a `DO_NOT_BUY` (dead stock, no confirmed
demand), a `PURCHASE_ON_CONFIRMED_ORDER` (rare item, open sales order), a
`REVIEW_DATA` (insufficient history), a `CLEAR_EXISTING_STOCK` (excess
stock), a `MONITOR`, and one `TRANSFER` recommendation (surplus at one
warehouse covering a shortfall at another) — see
[docs/architecture/purchase-recommendation-engine.md](../../docs/architecture/purchase-recommendation-engine.md)
for exactly which sample items produce which action and why.

## Tests

```bash
npm test                  # unit tests — pure logic, no database
npm run test:integration  # real PostgreSQL, a running DGX service, and a running Redis
                          # (see "Phase 5: Redis..." above) required. Set TEST_DATABASE_URL
                          # or edit src/test-setup-integration.ts / test-global-setup-integration.ts
npm run test:all          # both — 483 tests total as of the Data Validation & AI Readiness phase
```

Integration tests truncate the test database at the start of the run
(`src/test-global-setup-integration.ts`) — point `TEST_DATABASE_URL` at a
database you don't mind being wiped, never at your dev database. Phase 4's
integration tests additionally require the DGX FastAPI service (and Ollama
behind it) to be reachable at `DGX_SERVICE_URL` — they make real embedding/
generation calls, not mocked ones, so a handful of them take several seconds
each on CPU-only hardware.

## Notes on what's deliberately not here yet

- Real auth exists as of Phase 5 (JWT + refresh rotation + MFA — see
  [docs/architecture/identity-platform.md](../../docs/architecture/identity-platform.md)), layered
  on top of the still-present `x-user-role`/`x-branch-id`/`x-warehouse-id` header stand-in via a
  global guard that enriches, not replaces, the existing `getRequestActor()` contract — both
  work side by side. Branch/warehouse scope enforcement now exists via `ScopeGuard` (see
  [docs/architecture/authorization.md](../../docs/architecture/authorization.md)) but is only
  wired up on the Branch Gateway controller so far, not retrofitted onto every Phase 1–4
  controller.
- DTCs are still stored, not interpreted, by the diagnostic module itself
  (see [docs/architecture/diagnostic-model.md](../../docs/architecture/diagnostic-model.md)) —
  Phase 4's Technician Assistant reasons over evidence via RAG but never
  writes a diagnosis back to `DiagnosticSession`/`SuspectedCause`.
- No GPU and no real DGX Spark in this environment — Phase 4/5's local LLM/
  embedding inference genuinely runs (via a locally-installed Ollama
  instance, CPU-only), but `/ai/model-registry/gpu-health` and Phase 5's
  DGX benchmark honestly report `gpuAvailable: false` here. The same code
  activates real GPU acceleration and reporting unchanged on an actual DGX
  Spark — see [docs/architecture/dgx-platform.md](../../docs/architecture/dgx-platform.md)
  and [docs/architecture/dgx-deployment.md](../../docs/architecture/dgx-deployment.md).
- No pgvector/Qdrant/Milvus — vector search runs on a plain Postgres array
  with cosine similarity computed in application code, behind an interface
  designed so a real vector database is a config change later, not a
  rewrite — see [docs/architecture/vector-search.md](../../docs/architecture/vector-search.md).
- No live SAP Business One, Odoo, or POS instance — Phase 5's adapters are built against each
  system's real documented API contract and tested against `nock`-mocked servers, never a live
  instance. `FileDropAdapter` still stands in for a real file-based CDC/REST source from Phase 1.
  See [docs/architecture/integration-adapters.md](../../docs/architecture/integration-adapters.md).
- No live Neon account, no live SAP/Odoo, no Docker daemon, no live Prometheus/Grafana/OTLP
  collector, no branch-local offline client, and no UI for the Technician PWA/Customer/Dealer
  portals — every one of these is reported explicitly, with the real stand-in or partial
  implementation used instead, in [docs/architecture/phase5-decision-log.md](../../docs/architecture/phase5-decision-log.md)
  and the relevant module doc (see the Phase 5 module list above).
- Inventory analytics aggregates in application code, not SQL — fine at
  current data volumes, not built for high-volume production; see
  [docs/architecture/phase-2-commercial-foundation.md](../../docs/architecture/phase-2-commercial-foundation.md) §5–6.
- A handful of the spec's ~20 Phase 2 data-quality checks aren't wired up yet — see
  [docs/architecture/data-quality-phase-2.md](../../docs/architecture/data-quality-phase-2.md) for exactly which.
- No supplier-performance "overall score" — deliberately not produced without
  sufficient sample data, per spec.
- Body shop, tyre center, fleet management, and EV workshop domains are not
  built — Phase 3's checklist engine, reservation/issue/return pattern, and
  computed-read-model approach (Digital Twin, Timeline) are the reusable
  pieces intended to support them without foundation changes; see
  [docs/architecture/garage-architecture.md](../../docs/architecture/garage-architecture.md).
- Data Consolidation phase: real, live connectivity to `MolasCacheDb` and
  `Parts_Catalog` (Neon) is genuinely proven — see above. No real, reachable
  Odoo/garage-quotation source was confirmed, so that adapter was never
  written against a guessed schema — see
  [docs/data-sources/odoo-garage-profile.md](../../docs/data-sources/odoo-garage-profile.md).
  Purchase-order import, invoice/delivery/payment document types, historical
  (beyond 90 days) sales, inventory opening-balance/ledger reconstruction,
  and branch/warehouse code mapping are all documented (with a real,
  specific reason each) but not yet executed — see
  [docs/data-consolidation/decision-log.md](../../docs/data-consolidation/decision-log.md)
  and [docs/data-consolidation/production-backfill-runbook.md](../../docs/data-consolidation/production-backfill-runbook.md)
  for exactly what's next and why it was sequenced this way.
