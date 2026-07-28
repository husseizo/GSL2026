// Bridges the generic sync pipeline (IntegrationService) to an entity-specific
// table (Vehicle, Part, ...). One handler implementation per entity type.
// See docs/architecture/02-integration-contracts.md §2 for the pipeline stages
// this maps to: validate -> normalize -> checksum/dedup -> upsert.

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface EntitySyncHandler<TRaw, TNormalized> {
  readonly entityType: 'VEHICLE' | 'PART' | 'CUSTOMER' | 'LUBRICANT' | 'SUPPLIER' | 'SALES_DOCUMENT' | 'PURCHASE_DOCUMENT';

  validate(raw: TRaw): ValidationResult;

  // Phase 2 sales/purchase document handlers resolve customer/branch/
  // warehouse/part references by code, which requires a DB lookup — hence
  // Promise<TNormalized> alongside the Phase 1 handlers' plain synchronous
  // return. Backward compatible: IntegrationService always `await`s this, and
  // awaiting a non-Promise value is a no-op.
  normalize(raw: TRaw): TNormalized | Promise<TNormalized>;

  /** Deterministic hash of the normalized payload — same input, same output. */
  checksum(normalized: TNormalized): string;

  /** Null if this (sourceSystem, sourceRecordId) hasn't been synced before. */
  getExistingChecksum(sourceSystem: string, sourceRecordId: string): Promise<string | null>;

  upsert(params: {
    sourceSystem: string;
    sourceRecordId: string;
    recordVersion?: string;
    checksum: string;
    normalized: TNormalized;
  }): Promise<void>;
}
