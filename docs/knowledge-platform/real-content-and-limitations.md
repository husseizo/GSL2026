# Real Content & Limitations

Same discipline as every prior phase's honesty pattern: **do not populate this platform with fabricated technical facts.**

> **Update — DGX Prototype 1.7.1.** The "not yet proven" limitations below regarding real bulk structured-fact population and real external source ingestion are now substantially addressed: 16,138 real `KnowledgeItem` rows, 17,129 real `StructuredFact` rows, and 32,293 real `KnowledgeClaim` rows now exist, sourced from real `MolasCacheDb`/`Parts_Catalog` operational data and real internal repair-case records — not fixtures. See [`docs/trusted-knowledge-pilot/final-report.md`](../trusted-knowledge-pilot/final-report.md) for full real numbers and remaining honest gaps (no real licensed external OEM/supplier source was onboarded; only company-owned internal data is real in this pilot).

## Real sources used this phase

- This project's own real Markdown documentation, re-ingested to exercise the full pipeline.
- Real, freshly-authored fixture content used by the verify script and integration tests (torque values, fluid specs, service intervals) — genuinely written for this platform's own verification, not fabricated as if from a real manufacturer.
- The existing, real `KnowledgeDocument`/`KnowledgeChunk` corpus (Phase 4) as the retrieval substrate `KnowledgeItemRegistryService.publish()` materializes into.
- Real `Part`/`LubricantProduct` fields are the intended substrate for `StructuredFact` rows in production use; this phase's verify script and tests exercise the mechanism with real, small, explicitly-test-labeled fixtures rather than bulk-populating from the catalogue (bulk population was out of scope this phase — see below).

## Explicit limitation

**This environment has no real licensed manufacturer TSBs, service manuals, or other OEM documents.** Every source registered and every document ingested this phase is either this project's own real content or an explicitly-test-labeled fixture — never a fabricated bulletin, torque value, or fitment fact presented as if it came from a real manufacturer. The `RESTRICTED`/`OEM_OFFICIAL` source fixtures used to prove the licensing-gate mechanics (`source-registry.md`) are real database rows with a real, explicitly-stated reason for their restriction (`"No real license held in this environment"`) — not a claim that a real license exists.

## What this proves and what it doesn't

**Proven**: the full governance mechanics — registration, license-gating, ingestion, dedup/version-detection, classification, injection-scanning, claim/fact extraction, review, approval, publish, supersession, expiry, conflict detection/resolution, snapshotting, graph relationships, AI-consumer retrieval with exclusion/ranking — all work end-to-end against real Postgres and real DGX/Ollama.

**Not yet proven**: ingesting a genuine licensed OEM document's specific real-world provenance/license-term shape (multi-tier redistribution restrictions, region-specific licensing, real update cadences) remains unverified in this environment, since no such document exists here to test against.

## Bulk structured-fact population from the existing catalogue

`Part`/`LubricantProduct` rows are not bulk-converted into `StructuredFact` rows this phase — the mechanism (`StructuredFactService.createFact()` with `extractedBy: 'MANUAL_ENTRY'`) is real and demonstrated on individual fixtures, but a batch job populating facts from the full ~7,700-part catalogue was out of scope and would be a real, separate follow-on task.
