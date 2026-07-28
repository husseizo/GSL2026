# Portal UI — Explicitly Deferred

The spec's §41 describes a 19-screen internal Knowledge Portal (source registry management, ingestion monitoring, review queues, claim/conflict resolution, structured-fact editing, snapshot management, graph exploration, and more). **No UI was built this phase.**

## Confirmed decision

Asked directly during planning, the user chose backend/API + CLI only this phase (see `decision-log.md`). None of the phase's completion criteria require the UI to exist — only the underlying capabilities the UI would eventually present. This mirrors the discipline already established in prior phases: build the real mechanism first, defer the presentation layer explicitly rather than half-building it.

## What exists in its place today

Every capability the 19 screens would expose is already reachable through a real, tested surface:

- **Controllers**: `KnowledgeSourceRegistryController`, `KnowledgeReviewController` (includes `reviewQueue()` — the real "review queue" screen's data), `KnowledgeSnapshotController`, `KnowledgeGraphController`, `IngestionController`.
- **CLI**: `knowledge-platform.cli.ts` (see `cli-reference.md`) — register a source, ingest a document, compare versions, publish, build/activate/rollback a snapshot.
- **Direct service calls**: every method documented across this `docs/knowledge-platform/` set is callable from a script or a future controller with zero further backend work.

## What a future phase would need to add

A real frontend application (or a new set of screens in an existing one) consuming these already-real APIs — no new backend capability, just presentation. Not started this phase.
