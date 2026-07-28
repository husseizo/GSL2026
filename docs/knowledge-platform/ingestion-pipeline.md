# Ingestion Pipeline

`IngestionPipelineService.ingest()` (`src/knowledge-platform/ingestion/`) runs every real stage as a separately-callable, independently-observable step recorded on an `IngestionRun` accumulator — never one monolithic method, matching `BenchmarkPipelineService`'s per-category method precedent from DGX Prototype 1.6.

## Real stages this phase (mapped to the spec's 24-stage design)

`acquire` → `checksum` → `dedup` → `version-detect` → `parse` → `metadata-extract` → `classify` → `restricted-injection-scan` → `validate` → `draft` → `candidate-claims`. Each stage records `EXECUTED_PASSED | EXECUTED_FAILED | QUARANTINED | DEFERRED` with a real detail string — never silently promoted to passing.

- **acquire**: the caller already provides raw content (no network fetcher/web crawler exists this phase — see `real-content-and-limitations.md`).
- **checksum/dedup/version-detect**: `DedupVersionDetectStage` computes a real sha256 and classifies the result as `EXACT_DUPLICATE | NEW_VERSION | NO_EXISTING_ITEM` — an exact duplicate short-circuits with zero new rows created.
- **parse/metadata-extract**: dispatches to the real format parser (see `parsing-format-scope.md`); a `DEFERRED` format (PDF/DOCX) stops the pipeline here with a documented error, never a silent no-op.
- **classify**: `classifyContent()` assigns a `KnowledgeItemType` from real keyword matching, overridable by the caller.
- **restricted-injection-scan**: `scanDocumentForInjection()` — a hard block, not a warning (see `security-document-injection.md`). A match quarantines the ingest entirely: no `KnowledgeItemVersion` is created, and the finding is audit-logged.
- **validate**: refuses to draft an empty body.
- **draft**: always creates a `DRAFT` version — publishing is always a separate, explicit, human-gated call (`KnowledgeItemRegistryService.publish()`). Ingestion never auto-publishes, even when every prior stage passed cleanly.
- **candidate-claims**: real, deterministic claim extraction against the just-created draft (see `claim-provenance.md`).

## Real, honest scoping this phase

No standalone "reprocess" pipeline exists yet — the CLI recognizes a `reprocess` command but does not wire it (see `cli-reference.md`). No live scheduler/cron triggers ingestion automatically; every real ingestion in this environment is triggered by an explicit call (CLI, controller, or test).
