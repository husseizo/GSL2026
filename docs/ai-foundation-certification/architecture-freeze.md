# AI Foundation Certification Sprint — Architecture Freeze

## What is frozen

Per the sprint's own mandate, the following are frozen for the duration of this sprint — no redesign, no replacement, no schema redesign, no architectural refactoring:

- Operational Core (Phase 1-3 domain modules)
- Security (Identity, Authorization, `PermissionsGuard`)
- Knowledge Platform (`knowledge-platform/`) — versioning, snapshots, structured facts, source registry
- Knowledge Governance (lifecycle, expiry/supersession)
- Evaluation Framework (`ai-benchmark/`) — benchmark registry, gold dataset, quality gates, dashboards
- Trusted Knowledge Pipeline (DGX 1.7.1)
- Retrieval Intelligence Platform (`retrieval-intelligence/`) — pipeline stages, ranking signal set, strategy catalog
- Catalogue AI integration APIs
- Knowledge Snapshot lifecycle
- Evaluation Dataset structure (`Benchmark`/`BenchmarkCase`/`BenchmarkRun` schema)
- Public retrieval contracts (`RetrievalRequest`/`RetrievalResult` shapes)

**Confirmed at the end of this sprint: no Prisma schema migration was created, no new NestJS module was added, and no existing public interface's shape changed.** Every change landed inside already-existing files in `retrieval-intelligence/`, `ai-benchmark/`, `catalogue-ai/evaluation/`, and `observability/`, or as new files that are pure tuning/experiment/documentation artifacts within those same existing directories — matching the exact "additive file within an existing module" discipline every prior DGX phase used.

## What was explicitly allowed and exercised

Identifier Boosting, Query Normalization, Query Classification, Candidate Generation, Candidate Filtering, Ranking Functions, Benchmark Coverage, Evaluation Dataset Quality, Regression Fixes, and Bug Fixes directly affecting retrieval quality — all exercised. Field Weighting, BM25 Parameters, Hybrid Search Weighting, Vector Weighting, Graph Expansion Weighting, Embedding Selection/Parameters, and Learning-to-Rank preparation were considered (see [ranking-experiments.md](ranking-experiments.md)) but not ultimately needed, since the real root causes this sprint found were all classification/candidate-generation bugs, not ranking-weight miscalibration.

## What was explicitly avoided

- No new AI service, database, or API.
- No Forecasting/Predictive Maintenance/Copilot/Customer Assistant/Management AI/autonomous agent work — DGX 2.0-6.0 remain untouched, per spec §27.
- No change to the snapshot lifecycle, the quality-gate definitions, or the gate thresholds.
- No benchmark case removed to improve a score; no synthetic data substituted for real data. Every fix that touched the gold dataset was additive (`build-retrieval-intelligence-gold-eval-v2.ts` carries all 1,840 v1 cases forward unchanged and adds new real cases — see [decision-log.md](decision-log.md)).

## Real, load-bearing exception this sprint added

One structural behavior change was made inside the (unmodified) `RetrievalPipelineService.retrieve()` method: when a query classifies as identifier-shaped and genuine exact lookup finds no real match, vector-origin candidates are now suppressed from the final result rather than falling back to semantic search. This is a real, measured fix for a genuine embedding-model artifact (a nonexistent identifier-shaped query scored a real 0.7 cosine similarity against an unrelated document), not an architectural change — it is a conditional filter inside the existing candidate-filtering stage, exactly the kind of "Candidate Filtering" work the sprint's own scope explicitly allows.
