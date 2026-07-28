// See docs/architecture/02-integration-contracts.md §1 — this interface is the
// contract every source integration implements. Phase 1 ships FileDropAdapter
// as the only implementation; a later phase adds a real CDC/REST adapter
// against the actual sales/ERP database without changing this interface or
// anything downstream of it.

export type SyncCursor = string | null;

export interface RawChangeRecord<TRaw> {
  sourceRecordId: string;
  operation: 'UPSERT' | 'DELETE';
  payload: TRaw;
  sourceTimestamp: Date;
  recordVersion?: string;
}

export interface RawChangeBatch<TRaw> {
  /** Watermark to persist AFTER this batch's writes commit. */
  cursor: SyncCursor;
  records: RawChangeRecord<TRaw>[];
}

export interface SourceAdapter<TRaw = unknown> {
  readonly sourceSystem: string;
  // Descriptive label only — IntegrationService.runSync doesn't branch on it.
  // Widened in Phase 2 to cover the new entity types without touching the
  // engine itself.
  readonly entityType: 'VEHICLE' | 'PART' | 'CUSTOMER' | 'LUBRICANT' | 'SUPPLIER' | 'SALES_DOCUMENT' | 'PURCHASE_DOCUMENT';
  fetchChanges(cursor: SyncCursor): AsyncIterable<RawChangeBatch<TRaw>>;
}
