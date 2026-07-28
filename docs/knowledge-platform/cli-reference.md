# Knowledge Platform CLI

`src/knowledge-platform/cli/knowledge-platform.cli.ts` — a thin wrapper invoking the real services via a real NestJS application context. Run via:

```
npx ts-node -T src/knowledge-platform/cli/knowledge-platform.cli.ts <command> [...args]
```

## Real, wired commands

- `register-source <name> <authority>` — `KnowledgeSourceRegistryService.register()`.
- `ingest <itemKey> <sourceId> <format> <filePath>` — reads a real file, runs it through `IngestionPipelineService.ingest()`.
- `compare-versions <versionAId> <versionBId>` — `KnowledgeItemRegistryService.diff()`.
- `publish <versionId>` — `KnowledgeItemRegistryService.publish()`.
- `generate-snapshot` — `KnowledgeSnapshotService.buildSnapshot()`.
- `activate-snapshot <snapshotId>` — `KnowledgeSnapshotService.activate()`.
- `rollback-snapshot <badId> <reactivateId>` — `KnowledgeSnapshotService.rollback()`.
- `rebuild-graph` — explains that graph nodes/edges update incrementally at publish time; no standalone rebuild is needed unless recovering from data loss.

## Recognized but not yet wired

`reprocess` and `supersede` are listed in the CLI's known-command set (so an unknown-command error correctly distinguishes "not a command" from "not implemented yet") but fall through to an honest "recognized but not yet wired" message rather than doing nothing silently.
