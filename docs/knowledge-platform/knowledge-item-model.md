# Canonical KnowledgeItem + Append-Only KnowledgeItemVersion

`KnowledgeItem` is a stable identity (`key`, unique). `KnowledgeItemVersion` is an append-only chain of corrections — a direct structural mirror of `Benchmark`/`BenchmarkRegistryService`'s proven pattern from DGX Prototype 1.6: `key` never changes, `currentVersionId` is the only ever-mutated pointer, and a correction always creates `version = latest + 1`, never edits a previously published row. See `KnowledgeItemRegistryService` (`src/knowledge-platform/versioning/`).

## 28 `KnowledgeItemType` values

Spanning technical bulletins, repair/diagnostic/inspection procedures, torque/fluid/fitment/supersession specs, safety warnings, warranty rules, workshop SOPs, inventory/purchasing/customer-service/data-governance/AI-governance policies, training material, vehicle/engine/transmission technical profiles, troubleshooting guides, known issues, and internal case notes/repeat-repair cases. Each type maps to a `KnowledgeSourceType` for coarse retrieval filtering (`ITEM_TYPE_TO_SOURCE_TYPE` in the registry service).

## Status state machine

`DRAFT → IN_REVIEW → APPROVED → PUBLISHED → SUPERSEDED | EXPIRED | WITHDRAWN`, or `DRAFT → IN_REVIEW → REJECTED`. Every transition goes through `transitionStatus()` and is audit-logged.

## Materialization on publish

Publishing a version doesn't just flip a status — it calls the existing, unmodified `KnowledgeBaseService.ingestDocument()` to create exactly one companion `KnowledgeDocument` row (`KnowledgeDocument.knowledgeItemVersionId`, a new nullable, unique FK), inheriting real chunk/embed/`isApproved`-gated retrieval for free from `VectorSearchService`. See `retrieval-and-ai-consumer-contract.md`.

**Real, named fragile invariant**: `KnowledgeItemVersion.status` and the materialized `KnowledgeDocument.isApproved` must be kept in lock-step by `publish()`, `withdraw()`, `supersede()`, and snapshot `activate()`. No DB constraint enforces this — only service-layer discipline. Verified explicitly by the verify script's steps 28/29/32/37.

## Content integrity

`contentChecksum` (real sha256, `versioning/checksum.ts`) detects exact duplicates and drives the ingestion pipeline's dedup/version-detect stage (see `ingestion-pipeline.md`).
