# DGX Prototype 1.7.1 — Trusted Automotive Knowledge Onboarding Architecture

## Purpose

This phase does not redesign the Knowledge Platform built in DGX Prototype 1.7 (`src/knowledge-platform/`, verdict `KNOWLEDGE_PLATFORM_PILOT_READY`). It populates that platform with real, legally scoped, human-reviewed automotive knowledge, and evaluates the result through the existing DGX 1.6 Evaluation Framework. Every new capability below is additive: new Prisma models/enum values, new files, new optional fields, new controller endpoints, new comparator functions appended to existing services. No existing service's external behavior changed.

## Component map

```
                     ┌─────────────────────────────┐
Real sources ───────▶│ structured-ingestion/        │
 - MolasCacheDb       │  (composes existing adapters,│
 - Parts_Catalog       │   feeds existing ingest())   │
 - internal SOP .md    └──────────────┬───────────────┘
 - DiagnosticSession/                 │
   InspectionResult                   ▼
                     ┌─────────────────────────────┐
                     │ acquisition/                  │  checksum, MIME sniff,
                     │  document-acquisition.service  │  size/zip-bomb limits,
                     │  + malware scanner adapters    │  malware scan, quarantine
                     └──────────────┬───────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │ ingestion-pipeline.service     │  (existing, 11 stages,
                     │  (real PDF/DOCX/OCR parsers,   │   unmodified contract)
                     │   encryption-at-rest wiring)    │
                     └──────────────┬───────────────┘
                                    ▼
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
 provenance/                 structured-facts/            review-workflow/
 knowledge-claim.service      structured-fact.service       (dual review,
 (candidate claims)           (torque/fluid/approval facts)  escalation, batches)
        │                           │                           │
        └─────────────┬─────────────┴─────────────┬─────────────┘
                       ▼                           ▼
               conflicts/ (cross-source        graph/ (FITS, HAS_ALTERNATIVE,
               comparators incl. approval-      REQUIRES_TORQUE, SUPERSEDED_BY,
               status mismatch)                 SUPPORTED_BY, CONTRADICTS, ...)
                       │                           │
                       └─────────────┬─────────────┘
                                     ▼
                          snapshots/ (TRUSTED_AUTOMOTIVE_KNOWLEDGE_PILOT_V1,
                                       gated on trusted-knowledge quality gates)
                                     │
                                     ▼
                          ai-benchmark/pipeline/trusted-knowledge-quality-gates.ts
                          (separate evaluator, DGX 1.6's quality-gates.ts untouched)
                                     │
                                     ▼
                          retrieval/ + Catalogue AI pilot integration
```

## Real, verified corpus scale (queried directly from the live database, not estimated)

| Metric | Real count |
|---|---|
| KnowledgeItem rows | 16,138 |
| KnowledgeItemVersion — PUBLISHED | 123 |
| KnowledgeItemVersion — DRAFT | 16,010 |
| StructuredFact rows | 17,129 |
| KnowledgeClaim rows | 32,293 |
| KnowledgeGraphEdge (`FITS`) | 50,002 |
| KnowledgeSource rows (production, non-verify-script) | 4 |
| ExtractionProfile rows | 11 |
| KnowledgeSourcePermission rows | 78 |
| KnowledgeConflict rows | 4 (all resolved) |
| KnowledgeReviewAssignment rows | 139 (4 dual-review) |
| KnowledgeItemVersion with `encryptionKeyId` set | 3 |
| AuditLog rows | 50,284 |

## Deliberately unmodified components

`KnowledgeItemRegistryService`'s append-only versioning, `KnowledgeSnapshotService`'s blue-green state machine, `KnowledgeGraphService`'s traversal engine, `KnowledgeRetrievalService.searchKnowledge()`'s contract shape, `IngestionPipelineService`'s 11-stage pipeline order, DGX 1.6's `quality-gates.ts`/`category-metrics.ts`, `BenchmarkRegistryService.freezeAsGold()`, and both existing data-consolidation adapters' constructors and `fetchChanges()` contracts.

## See also

[source-inventory.md](source-inventory.md), [decision-log.md](decision-log.md), [final-report.md](final-report.md).
