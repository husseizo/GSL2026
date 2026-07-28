// AI Foundation Certification Sprint — Phase II Sprint 3 (DGX 2.0
// Certification Dataset). Real types shared by the dataset builder script,
// the dataset validator, the gate evaluators, and the scorecard. See
// docs/certification/datasets/DGX2_CERTIFICATION_DATASET_V1.md and
// DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md §20.

// Every category named in the Certification Standard's own §11 Scenario
// Test Suite that this dataset is capable of covering with *real* business
// data in this environment today. Categories with zero real coverage are
// still listed (with count 0) rather than silently omitted — see
// `knownLimitations` on Dgx2CertificationDataset.
export type Dgx2ScenarioCategory =
  | 'MULTI_WAREHOUSE'
  | 'MULTI_SUPPLIER'
  | 'HIGH_VOLUME_ITEM'
  | 'LOW_VOLUME_ITEM'
  | 'INTERMITTENT_DEMAND'
  | 'STOCKOUT_RISK'
  | 'EXCESS_INVENTORY'
  | 'TRANSFER_CANDIDATE'
  | 'VARYING_LEAD_TIME'
  | 'VARYING_SUPPLIER_PERFORMANCE';

// A single real reference into the operational database — never a copy of
// the underlying row, so the dataset never goes stale relative to the real
// system of record and never duplicates data across two places.
export interface Dgx2DatasetEntry {
  category: Dgx2ScenarioCategory;
  entityType: 'InventoryItemMetric' | 'Warehouse' | 'Supplier' | 'SupplierMetric' | 'TransferRecommendation' | 'ForecastRun';
  entityId: string;
  // A short, real, human-readable fact justifying why this real row
  // belongs in this category — e.g. "movementClass=FAST_MOVING,
  // qtySold90d=25" — always derived directly from the real row's own
  // fields, never invented.
  evidence: string;
}

export interface Dgx2CertificationDataset {
  datasetVersion: string;
  generatedAt: string;
  // The real wall-clock window the underlying operational data was
  // queried from — not a claim about how far back real history goes.
  queryWindow: { from: string; to: string };
  entries: Dgx2DatasetEntry[];
  coverage: Record<Dgx2ScenarioCategory, number>;
  recordCounts: {
    warehouses: number;
    suppliers: number;
    inventoryItemMetrics: number;
    supplierMetrics: number;
    transferRecommendations: number;
    forecastRuns: number;
  };
  knownLimitations: string[];
  checksum: string;
}
