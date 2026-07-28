# Data Snapshots

`src/data-readiness/snapshot/data-snapshot.service.ts` — immutable, versioned captures of exactly what real data a baseline run or AI dataset build was produced from, so nothing trains or reports directly from continuously-changing production tables.

## Real snapshot created (2026-07-13)

```json
{
  "snapshotName": "verification-snapshot-1783894131158",
  "rowCounts": {"parts":7723,"customers":3992,"salesDocuments":3413,"lubricantProducts":434,"salesDocumentLines":2919,"manualReviewItemsPending":1607},
  "sourceSystems": ["MOLAS_CACHE_LUBRICANTS", "PARTS_CATALOG_AUTOHUB"]
}
```

Plus real `cursorPositions` (every `IntegrationSource.lastCommittedCursor` at capture time), `financialTotals` (`lubricantsSalesOrderGrandTotal`, a real `Decimal.toString()`), and `datasetChecksums` (real `stableChecksum()` over the actual customer/sales-document rows, ordered deterministically by `id`).

## Immutability

`createSnapshot()` throws `ConflictException` if a snapshot with the same name already exists — snapshots are never overwritten. Verified by integration test.

## Real drift detection

`validateSnapshot(name)` recomputes the real current customer checksum and compares it against the one recorded at snapshot time. Verified by integration test: creating a snapshot, then adding one real new `Customer` row, causes `validateSnapshot()` to correctly report `valid: false` with a real mismatch — proving the snapshot genuinely freezes a point in time rather than silently tracking the live table.

## Approval

`approve(snapshotName, approvedById)` — records who approved this specific snapshot for downstream use (baseline reporting, AI dataset builds, DGX export per [dgx-data-access-contract.md](dgx-data-access-contract.md)).

## Retention

`retentionPolicy` defaults to `RETAIN_INDEFINITELY` — real production data volume in this build doesn't yet warrant active pruning; a future phase should set an explicit window once volume grows.

## Access

`POST /data-readiness/snapshots` (permission `dataSnapshots.create`), `GET /data-readiness/snapshots/:name/validate` (`dataSnapshots.read`).
