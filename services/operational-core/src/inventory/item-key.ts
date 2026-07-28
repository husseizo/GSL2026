// Postgres unique indexes treat NULL as distinct-from-NULL, so a constraint
// like @@unique([partId, lubricantProductId, warehouseId]) would NOT stop two
// balance rows for the same part (lubricantProductId always NULL on both)
// from being created — NULL <> NULL under standard SQL semantics. That's the
// desired behavior for the Phase 1 sync-envelope pattern (sourceSystem +
// sourceRecordId both NULL for natively-created records, where allowing many
// such rows is correct), but it's a bug for "one balance row per item" here.
// Fix: a non-null surrogate key so real uniqueness is enforceable by Postgres.
export function computeItemKey(partId?: string | null, lubricantProductId?: string | null): string {
  if (partId) return `part:${partId}`;
  if (lubricantProductId) return `lubricant:${lubricantProductId}`;
  throw new Error('Either partId or lubricantProductId must be set');
}

export const ORG_WIDE_WAREHOUSE_KEY = 'ORG';

export function computeWarehouseKey(warehouseId?: string | null): string {
  return warehouseId ?? ORG_WIDE_WAREHOUSE_KEY;
}
