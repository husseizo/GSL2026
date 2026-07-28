// Pure — no DB, no I/O. Mirrors the exact tamper-evidence pattern
// ai-benchmark/registry/checksum.ts already established for the AI
// Foundation's own Gold Dataset, applied here to the DGX 2.0 Certification
// Dataset.
import { createHash } from 'crypto';
import { Dgx2CertificationDataset, Dgx2ScenarioCategory } from './dataset-types';

export const REQUIRED_SCENARIO_CATEGORIES: Dgx2ScenarioCategory[] = [
  'MULTI_WAREHOUSE',
  'MULTI_SUPPLIER',
  'HIGH_VOLUME_ITEM',
  'LOW_VOLUME_ITEM',
  'INTERMITTENT_DEMAND',
  'STOCKOUT_RISK',
  'EXCESS_INVENTORY',
  'TRANSFER_CANDIDATE',
  'VARYING_LEAD_TIME',
  'VARYING_SUPPLIER_PERFORMANCE',
];

export function computeDatasetChecksum(entries: { category: string; entityType: string; entityId: string }[]): string {
  // Keyed by category+entityType+entityId, not entityType+entityId alone —
  // the same real entity legitimately appears under more than one scenario
  // category (e.g. a real Supplier is both MULTI_SUPPLIER and
  // VARYING_LEAD_TIME evidence simultaneously); what must never duplicate
  // is the same (category, entity) pair.
  const sorted = [...entries].map((e) => `${e.category}:${e.entityType}:${e.entityId}`).sort();
  return createHash('sha256').update(sorted.join('\n')).digest('hex');
}

export interface DatasetValidationResult {
  valid: boolean;
  checksumMatches: boolean;
  missingCategories: Dgx2ScenarioCategory[];
  zeroCoverageCategories: Dgx2ScenarioCategory[];
  totalEntries: number;
  issues: string[];
}

// Real, structural validation — never assumes a dataset file is well-formed
// just because it parsed as JSON. "Required" here means "the category must
// be present in the coverage map," not "must have at least one real entry"
// — a category can honestly report 0 (see knownLimitations) without that
// making the whole dataset invalid; a *missing* category (absent from the
// coverage map entirely) is the real structural defect this catches.
export function validateDatasetIntegrity(dataset: Dgx2CertificationDataset): DatasetValidationResult {
  const issues: string[] = [];

  const recomputedChecksum = computeDatasetChecksum(dataset.entries);
  const checksumMatches = recomputedChecksum === dataset.checksum;
  if (!checksumMatches) issues.push(`Checksum mismatch: stored=${dataset.checksum}, recomputed=${recomputedChecksum}`);

  const missingCategories = REQUIRED_SCENARIO_CATEGORIES.filter((c) => !(c in dataset.coverage));
  if (missingCategories.length > 0) issues.push(`Missing required categories from coverage map: ${missingCategories.join(', ')}`);

  const zeroCoverageCategories = REQUIRED_SCENARIO_CATEGORIES.filter((c) => (dataset.coverage[c] ?? 0) === 0);
  if (zeroCoverageCategories.length > 0) {
    issues.push(`Categories with zero real coverage (see knownLimitations for why): ${zeroCoverageCategories.join(', ')}`);
  }

  const versionFormatValid = Boolean(dataset.datasetVersion) && /^v\d+$/.test(dataset.datasetVersion);
  if (!versionFormatValid) {
    issues.push(`Dataset version "${dataset.datasetVersion}" does not match the expected "v<N>" format`);
  }

  if (dataset.entries.length === 0) {
    issues.push('Dataset has zero entries — cannot be used for certification evidence');
  }

  const entryIds = new Set(dataset.entries.map((e) => `${e.category}:${e.entityType}:${e.entityId}`));
  if (entryIds.size !== dataset.entries.length) {
    issues.push('Dataset contains duplicate entries (same category+entityType+entityId listed more than once)');
  }

  return {
    valid: checksumMatches && missingCategories.length === 0 && versionFormatValid && dataset.entries.length > 0 && entryIds.size === dataset.entries.length,
    checksumMatches,
    missingCategories,
    zeroCoverageCategories,
    totalEntries: dataset.entries.length,
    issues,
  };
}
