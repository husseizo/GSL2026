import { computeDatasetChecksum, validateDatasetIntegrity, REQUIRED_SCENARIO_CATEGORIES } from './dataset-validator';
import { Dgx2CertificationDataset, Dgx2ScenarioCategory } from './dataset-types';

// AI Foundation Certification Sprint — Phase II Sprint 3 (DGX 2.0
// Certification Dataset). Pure unit coverage — no DB, no I/O.
function buildValidDataset(overrides: Partial<Dgx2CertificationDataset> = {}): Dgx2CertificationDataset {
  // One real entry per required category, so a "well-formed dataset" test
  // fixture carries zero real "zero coverage" issues by default — tests
  // that want to exercise a missing/zero-coverage category do so
  // explicitly via overrides instead of relying on this baseline gap.
  const entries = REQUIRED_SCENARIO_CATEGORIES.map((category, i) => ({
    category,
    entityType: 'Warehouse' as const,
    entityId: `entity-${i}`,
    evidence: `evidence for ${category}`,
  }));
  const coverage = REQUIRED_SCENARIO_CATEGORIES.reduce(
    (acc, cat) => ({ ...acc, [cat]: entries.filter((e) => e.category === cat).length }),
    {} as Record<Dgx2ScenarioCategory, number>,
  );
  const dataset: Dgx2CertificationDataset = {
    datasetVersion: 'v1',
    generatedAt: new Date().toISOString(),
    queryWindow: { from: new Date(0).toISOString(), to: new Date().toISOString() },
    entries,
    coverage,
    recordCounts: { warehouses: 1, suppliers: 1, inventoryItemMetrics: 0, supplierMetrics: 0, transferRecommendations: 0, forecastRuns: 0 },
    knownLimitations: [],
    checksum: '',
    ...overrides,
  };
  dataset.checksum = computeDatasetChecksum(dataset.entries);
  return { ...dataset, ...overrides };
}

describe('computeDatasetChecksum', () => {
  it('produces the same real checksum regardless of input entry order (order-independent)', () => {
    const a = computeDatasetChecksum([
      { category: 'MULTI_WAREHOUSE', entityType: 'Warehouse', entityId: 'wh-1' },
      { category: 'MULTI_SUPPLIER', entityType: 'Supplier', entityId: 'sup-1' },
    ]);
    const b = computeDatasetChecksum([
      { category: 'MULTI_SUPPLIER', entityType: 'Supplier', entityId: 'sup-1' },
      { category: 'MULTI_WAREHOUSE', entityType: 'Warehouse', entityId: 'wh-1' },
    ]);
    expect(a).toBe(b);
  });

  it('produces a different checksum when a real entry changes', () => {
    const a = computeDatasetChecksum([{ category: 'MULTI_WAREHOUSE', entityType: 'Warehouse', entityId: 'wh-1' }]);
    const b = computeDatasetChecksum([{ category: 'MULTI_WAREHOUSE', entityType: 'Warehouse', entityId: 'wh-2' }]);
    expect(a).not.toBe(b);
  });

  it('treats the same real entity under two different categories as two distinct, non-colliding entries', () => {
    const checksum = computeDatasetChecksum([
      { category: 'MULTI_SUPPLIER', entityType: 'Supplier', entityId: 'sup-1' },
      { category: 'VARYING_LEAD_TIME', entityType: 'Supplier', entityId: 'sup-1' },
    ]);
    const singleCategoryChecksum = computeDatasetChecksum([{ category: 'MULTI_SUPPLIER', entityType: 'Supplier', entityId: 'sup-1' }]);
    expect(checksum).not.toBe(singleCategoryChecksum);
  });
});

describe('validateDatasetIntegrity', () => {
  it('passes a real, well-formed dataset with a matching checksum and every required category present', () => {
    const dataset = buildValidDataset();
    const result = validateDatasetIntegrity(dataset);
    expect(result.valid).toBe(true);
    expect(result.checksumMatches).toBe(true);
    expect(result.missingCategories).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('fails when the stored checksum does not match the recomputed one (tamper detection)', () => {
    const dataset = buildValidDataset({ checksum: 'deliberately-wrong-checksum' });
    const result = validateDatasetIntegrity(dataset);
    expect(result.valid).toBe(false);
    expect(result.checksumMatches).toBe(false);
    expect(result.issues.some((i) => i.includes('Checksum mismatch'))).toBe(true);
  });

  it('fails when a required scenario category is entirely missing from the coverage map', () => {
    const dataset = buildValidDataset();
    const { STOCKOUT_RISK: _STOCKOUT_RISK, ...coverageWithoutStockout } = dataset.coverage;
    const broken = { ...dataset, coverage: coverageWithoutStockout as typeof dataset.coverage };
    const result = validateDatasetIntegrity(broken);
    expect(result.valid).toBe(false);
    expect(result.missingCategories).toContain('STOCKOUT_RISK');
  });

  it('reports (but does not invalidate on) categories with honest zero real coverage', () => {
    const dataset = buildValidDataset();
    const coverageWithHonestGap = { ...dataset.coverage, STOCKOUT_RISK: 0 };
    const withGap = { ...dataset, coverage: coverageWithHonestGap };
    const result = validateDatasetIntegrity(withGap);
    expect(result.zeroCoverageCategories).toContain('STOCKOUT_RISK');
    expect(result.valid).toBe(true);
  });

  it('fails when the dataset version does not match the required "v<N>" format', () => {
    const dataset = buildValidDataset();
    const broken = { ...dataset, datasetVersion: 'version-one' };
    broken.checksum = computeDatasetChecksum(broken.entries);
    const result = validateDatasetIntegrity(broken);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('does not match'))).toBe(true);
  });

  it('fails when the dataset has zero entries', () => {
    const dataset = buildValidDataset({ entries: [] });
    dataset.checksum = computeDatasetChecksum([]);
    const result = validateDatasetIntegrity(dataset);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('zero entries'))).toBe(true);
  });

  it('fails when the same category+entityType+entityId entry is listed more than once (real duplicate)', () => {
    const dup = { category: 'MULTI_WAREHOUSE' as Dgx2ScenarioCategory, entityType: 'Warehouse' as const, entityId: 'wh-1', evidence: 'x' };
    const dataset = buildValidDataset({ entries: [dup, dup] });
    dataset.checksum = computeDatasetChecksum(dataset.entries);
    const result = validateDatasetIntegrity(dataset);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('duplicate'))).toBe(true);
  });
});
