# Integration Layer Contract

The real sales server, ERP, and DGX Spark are not reachable from this build environment. This doc defines the **contract** the integration layer implements against; Phase 1 ships a mock adapter satisfying this contract, so a later phase can drop in a real adapter (CDC off the legacy Postgres/MySQL sales DB, or a REST pull against the ERP) without touching anything downstream.

## 1. Adapter interface

Every source integration implements:

```ts
interface SourceAdapter<TRaw> {
  readonly sourceSystem: string;           // e.g. "LEGACY_POS"
  fetchChanges(cursor: SyncCursor): AsyncIterable<RawChangeBatch<TRaw>>;
  // cursor is opaque: an incrementing ID, a timestamp watermark, or a CDC LSN —
  // adapter owns its meaning, integration layer only persists and replays it.
}

interface RawChangeBatch<TRaw> {
  cursor: SyncCursor;      // watermark to persist AFTER this batch commits
  records: RawChangeRecord<TRaw>[];
}

interface RawChangeRecord<TRaw> {
  sourceRecordId: string;
  operation: 'UPSERT' | 'DELETE';
  payload: TRaw;
  sourceTimestamp: Date;
  recordVersion?: string;   // source's own version/lsn if it has one
}
```

## 2. Pipeline stages (fixed order, every adapter goes through all of them)

1. **Fetch** — adapter pulls a batch since the last committed cursor.
2. **Validate** — schema-check the raw payload; anything that fails goes straight to the dead-letter queue with the validation error, batch continues.
3. **Normalize** — map source shape to the canonical entity shape (vehicle / part / etc.), attach the sync envelope fields.
4. **Deduplicate / idempotency check** — compute `checksum` over the normalized payload. If a row with the same `(sourceSystem, sourceRecordId)` already has the same checksum, skip the write (no-op, but cursor still advances). This is what makes replays safe.
5. **Upsert** — single transaction per record (or per batch, chunked): write to the operational table keyed by `(sourceSystem, sourceRecordId)`, never by inferring identity from business fields at this stage (that's the matching pipeline's job downstream, not the sync layer's).
6. **Commit cursor** — only after the batch's writes commit. On crash mid-batch, replay from the last committed cursor; step 4 makes replay idempotent.
7. **Reconcile** (scheduled, separate job) — periodically compares row counts / checksums between source and AIOS for drift detection, independent of the streaming path.

## 3. Dead-letter queue

Every record that fails validation, normalization, or repeated upsert (after N retries with backoff) lands in `SyncDeadLetter` with: source system, raw payload, stage it failed at, error, retry count, first/last seen. A human (data-quality role) reviews and either fixes-and-replays or discards-with-reason. Dead letters never silently disappear.

## 4. Idempotency guarantee

The integration layer **must never create duplicate transactions**. This is enforced structurally, not by convention:
- Unique constraint on `(sourceSystem, sourceRecordId)` per entity table.
- Checksum short-circuit (stage 4) avoids redundant writes even on cursor replay.
- All writes for a batch happen in one DB transaction with the cursor advance, so a crash can't leave "records written, cursor not advanced" as a state that causes reprocessing to duplicate rows (it just reprocesses, checksum makes it a no-op).

## 5. Phase 1 mock adapter

`FileDropAdapter` watches a directory of newline-delimited JSON files (simulating what a CDC export or nightly extract would look like from the real sales DB) and implements exactly the interface above. Swapping it later for `PostgresCdcAdapter` or `RestPullAdapter` requires zero changes to validate/normalize/dedup/upsert/reconcile — only `fetchChanges` differs.

## 6. What Phase 1 explicitly does not attempt

- No live connection to a real sales server (none is reachable here).
- No log ingestion pipeline yet (app-event schema is designed in the roadmap, not built).
- No DGX-side embedding/RAG wiring — the matching pipeline in Phase 1 uses a deterministic normalizer + a pluggable `SimilarityScorer` interface with a trivial string-similarity implementation, so the real embedding-based scorer can be substituted later without changing the merge-review workflow.
