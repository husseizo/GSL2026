# Internal Repair Case Ingestion

## Source

`GARAGE_VERIFIED_REPAIR_CASES` — real `DiagnosticSession` (5 rows) and `InspectionResult` (2 rows) records, read directly via Prisma (no external adapter; these tables already live in the operational database this service owns).

## Extraction

`repair-case-extraction.ts` (deterministic, non-LLM) maps each row to a `KnowledgeItem` with `itemType: REPEAT_REPAIR_CASE` or `INTERNAL_CASE_NOTE`, classified per the outcome taxonomy in [privacy-and-anonymization.md](privacy-and-anonymization.md). All 7 real rows were ingested and published through the same `IngestionPipelineService.ingest()` path as every other source — no special-cased shortcut.

## Real count vs. target

7 real cases, against a spec target that implicitly expects more volume for meaningful conflict/pattern analysis. This is the real, honest count of what exists in the operational database today — reported as-is rather than padded, per the spec's own explicit instruction to report actual counts rather than fabricate content to hit numeric targets.

## Rule enforced

Per [privacy-and-anonymization.md](privacy-and-anonymization.md), only `VERIFIED_RESOLUTION`-classified cases are surfaced as default supporting evidence, and no internal case ever overrides official safety/technical guidance.
