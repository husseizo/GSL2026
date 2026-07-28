import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationService } from '../integration/integration.service';
import { AdapterHealth, AdapterMetadata, EnterpriseSourceAdapter } from '../integration/adapters/enterprise-source-adapter.interface';
import { RawChangeBatch, SyncCursor } from '../integration/adapters/source-adapter.interface';
import { StagingService } from './staging.service';
import { ImportService } from './import.service';
import { CustomerMatchingService } from './matching/customer-matching.service';
import { LubricantMatchingService } from './matching/lubricant-matching.service';
import { PartConsolidationMatchingService } from './matching/part-consolidation-matching.service';
import { ManualReviewService } from './manual-review.service';
import { ReconciliationService } from './reconciliation.service';

// A controllable fake source — never connects to a live SAP/Odoo system.
// Proves the staging -> matching -> import -> reconciliation pipeline
// against real Postgres without touching any live production database, per
// the phase's critical safety rule (no automated test may reach a real
// external source). See docs/data-consolidation/staging-model.md.
class FakeCustomerAdapter implements EnterpriseSourceAdapter<Record<string, unknown> & { sourceRecordKey: string }> {
  readonly sourceSystem = 'FAKE_TEST_SOURCE';
  readonly entityType = 'CUSTOMER' as const;
  constructor(private rows: { CardCode: string; CardName: string; Phone1?: string; IsActive?: boolean }[]) {}

  async health(): Promise<AdapterHealth> {
    return { reachable: true, authenticated: true };
  }
  async authenticate(): Promise<void> {}
  async getMetadata(): Promise<AdapterMetadata> {
    return { systemName: 'Fake', supportedEntities: ['CUSTOMER'] };
  }
  async *fetchChanges(_cursor: SyncCursor): AsyncIterable<RawChangeBatch<Record<string, unknown> & { sourceRecordKey: string }>> {
    yield {
      cursor: new Date().toISOString(),
      records: this.rows.map((row) => ({
        sourceRecordId: row.CardCode,
        operation: 'UPSERT' as const,
        payload: { ...row, IsActive: row.IsActive ?? true, sourceRecordKey: row.CardCode },
        sourceTimestamp: new Date(),
      })),
    };
  }
}

describe('Data Consolidation pipeline (integration, real Postgres, fake source)', () => {
  let prisma: PrismaService;
  let staging: StagingService;
  let importService: ImportService;
  let manualReview: ManualReviewService;
  let reconciliation: ReconciliationService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const integrationService = new IntegrationService(prisma);
    staging = new StagingService(prisma, integrationService);
    manualReview = new ManualReviewService(prisma);
    reconciliation = new ReconciliationService(prisma);
    importService = new ImportService(
      prisma,
      new CustomerMatchingService(prisma),
      new LubricantMatchingService(prisma),
      new PartConsolidationMatchingService(prisma),
      manualReview,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stages, imports, and reconciles a real batch end to end, then proves idempotency on re-run', async () => {
    const feedName = `TEST_CUSTOMERS_${Date.now()}`;
    const adapter = new FakeCustomerAdapter([
      { CardCode: 'T001', CardName: 'Test Garage One', Phone1: '+255700000001' },
      { CardCode: 'T002', CardName: 'Test Garage Two', Phone1: '+255700000002' },
    ]);

    const batch1 = await staging.stageBatch(adapter, feedName, { sourceSystem: 'FAKE_TEST_SOURCE', sourceDatabase: 'fake', sourceSchema: 'fake', sourceTable: 'fake_customers' });
    expect(batch1.recordsStaged).toBe(2);
    expect(batch1.recordsFetched).toBe(2);

    const import1 = await importService.importLubricantsCustomers(feedName);
    expect(import1.importedCount).toBe(2);
    expect(import1.manualReviewCount).toBe(0);

    const createdCustomers = await prisma.customer.findMany({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS', sourceRecordId: { in: ['T001', 'T002'] } } });
    expect(createdCustomers).toHaveLength(2);

    const report = await reconciliation.reconcile(batch1.syncRunId, 'CUSTOMER', {
      sourceCount: 2,
      extractedCount: batch1.recordsFetched,
      stagedCount: batch1.recordsStaged,
      validCount: 2,
      importedCount: import1.importedCount,
      updatedCount: import1.updatedCount,
      duplicateCount: 0,
      deadLetterCount: 0,
      manualReviewCount: import1.manualReviewCount,
      skippedCount: 0,
      targetCount: createdCustomers.length,
    });
    expect(report.variance).toBe(0);

    // Re-run the identical batch — proves idempotency: no new staged rows,
    // nothing left to (re-)import.
    const batch2 = await staging.stageBatch(adapter, feedName, { sourceSystem: 'FAKE_TEST_SOURCE', sourceDatabase: 'fake', sourceSchema: 'fake', sourceTable: 'fake_customers' });
    expect(batch2.recordsStaged).toBe(0);
    expect(batch2.recordsUnchanged).toBe(2);

    const import2 = await importService.importLubricantsCustomers(feedName);
    expect(import2.stagedCount).toBe(0);
    expect(import2.importedCount).toBe(0);
  }, 30_000);

  it('routes a possible-match customer to manual review instead of auto-merging', async () => {
    const feedName = `TEST_CUSTOMERS_POSSIBLE_MATCH_${Date.now()}`;

    // First, create a real existing customer with a distinctive name.
    const existingCustomerAdapter = new FakeCustomerAdapter([{ CardCode: 'EXIST01', CardName: 'Unique Test Name Ltd', Phone1: '+255711111111' }]);
    await staging.stageBatch(existingCustomerAdapter, `${feedName}_seed`, { sourceSystem: 'FAKE_TEST_SOURCE', sourceDatabase: 'fake', sourceSchema: 'fake', sourceTable: 'fake_customers' });
    await importService.importLubricantsCustomers(`${feedName}_seed`);

    // Now stage a DIFFERENT source record with the same normalized name but
    // no phone/tax-number overlap — a name-only signal, which must never be
    // auto-merged.
    const possibleMatchAdapter = new FakeCustomerAdapter([{ CardCode: 'NEWSRC01', CardName: 'Unique Test Name Ltd', Phone1: undefined }]);
    await staging.stageBatch(possibleMatchAdapter, feedName, { sourceSystem: 'FAKE_TEST_SOURCE', sourceDatabase: 'fake', sourceSchema: 'fake', sourceTable: 'fake_customers' });

    const result = await importService.importLubricantsCustomers(feedName);
    expect(result.manualReviewCount).toBe(1);
    expect(result.importedCount).toBe(0);

    const reviews = await manualReview.list('CUSTOMER_MATCH', 'PENDING');
    expect(reviews.some((r) => r.evidence && JSON.stringify(r.evidence).includes('Unique Test Name Ltd'))).toBe(true);
  }, 30_000);

  it('imports lubricant products via normalizeLubricantsProduct and never fabricates a brand', async () => {
    const feedName = `TEST_PRODUCTS_${Date.now()}`;
    const adapter = new FakeProductAdapter([{ ItemCode: 'LUB001', ItemName: 'Molygen Motor Protect 500ml', PriceList_1: 93220.34, WarehouseCode: '01' }]);

    await staging.stageBatch(adapter, feedName, { sourceSystem: 'FAKE_TEST_SOURCE', sourceDatabase: 'fake', sourceSchema: 'fake', sourceTable: 'fake_products' });
    const result = await importService.importLubricantsProducts(feedName);
    expect(result.importedCount).toBe(1);

    const product = await prisma.lubricantProduct.findFirst({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS', sourceRecordId: 'LUB001' } });
    expect(product?.brand).toBe('UNKNOWN');
    expect(Number(product?.defaultSellingPrice)).toBeCloseTo(93220.34);
  }, 30_000);

  it('consolidates two AutoHub parts sharing a real OEM number into one canonical Part, HIGH_CONFIDENCE, no manual review', async () => {
    const feedName = `TEST_PARTS_${Date.now()}`;
    const adapter = new FakePartAdapter([
      { item_code: 'VAG-A', article_number: null, canonical_oem_number: '059903133R', name: 'Oil Filter', part_group: 'Engine', sell_price_tzs: '15000', supplier_name: 'VAG' },
      { item_code: 'VAG-B', article_number: null, canonical_oem_number: '059903133R', name: 'Oil Filter (re-catalogued)', part_group: 'Engine', sell_price_tzs: '15500', supplier_name: 'VAG' },
    ]);

    await staging.stageBatch(adapter, feedName, { sourceSystem: 'FAKE_TEST_SOURCE', sourceDatabase: 'fake', sourceSchema: 'fake', sourceTable: 'fake_parts' });
    const result = await importService.importAutoHubParts(feedName);

    expect(result.importedCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.manualReviewCount).toBe(0);

    const parts = await prisma.part.findMany({ where: { oemNumber: '059903133R' } });
    expect(parts).toHaveLength(1);
    const refs = await prisma.partExternalReference.findMany({ where: { partId: parts[0].id } });
    expect(refs.map((r) => r.sourceRecordId).sort()).toEqual(['VAG-A', 'VAG-B']);
  }, 30_000);

  it('reconciles financial totals using Decimal arithmetic, not floating point', async () => {
    const batch = await prisma.syncRun.create({ data: { sourceId: (await prisma.integrationSource.create({ data: { name: `TEST_FIN_${Date.now()}`, adapterType: 'test' } })).id } });
    const report = await reconciliation.reconcile(
      batch.id,
      'SALES_DOCUMENT',
      { sourceCount: 3, extractedCount: 3, stagedCount: 3, validCount: 3, importedCount: 3, updatedCount: 0, duplicateCount: 0, deadLetterCount: 0, manualReviewCount: 0, skippedCount: 0, targetCount: 3 },
      { sourceTotal: new Prisma.Decimal('1000000.10'), targetTotal: new Prisma.Decimal('1000000.10') },
    );
    expect(report.financialDifference?.toString()).toBe('0');
  }, 15_000);
});

class FakeProductAdapter implements EnterpriseSourceAdapter<Record<string, unknown> & { sourceRecordKey: string }> {
  readonly sourceSystem = 'FAKE_TEST_SOURCE';
  readonly entityType = 'LUBRICANT' as const;
  constructor(private rows: { ItemCode: string; ItemName: string; PriceList_1?: number; WarehouseCode: string }[]) {}
  async health(): Promise<AdapterHealth> {
    return { reachable: true, authenticated: true };
  }
  async authenticate(): Promise<void> {}
  async getMetadata(): Promise<AdapterMetadata> {
    return { systemName: 'Fake', supportedEntities: ['LUBRICANT'] };
  }
  async *fetchChanges(_cursor: SyncCursor): AsyncIterable<RawChangeBatch<Record<string, unknown> & { sourceRecordKey: string }>> {
    yield {
      cursor: new Date().toISOString(),
      records: this.rows.map((row) => ({ sourceRecordId: row.ItemCode, operation: 'UPSERT' as const, payload: { ...row, IsActive: true, sourceRecordKey: row.ItemCode }, sourceTimestamp: new Date() })),
    };
  }
}

class FakePartAdapter implements EnterpriseSourceAdapter<Record<string, unknown> & { sourceRecordKey: string }> {
  readonly sourceSystem = 'FAKE_TEST_SOURCE';
  readonly entityType = 'PART' as const;
  constructor(private rows: { item_code: string; article_number: string | null; canonical_oem_number: string | null; name: string; part_group: string | null; sell_price_tzs: string | null; supplier_name: string | null }[]) {}
  async health(): Promise<AdapterHealth> {
    return { reachable: true, authenticated: true };
  }
  async authenticate(): Promise<void> {}
  async getMetadata(): Promise<AdapterMetadata> {
    return { systemName: 'Fake', supportedEntities: ['PART'] };
  }
  async *fetchChanges(_cursor: SyncCursor): AsyncIterable<RawChangeBatch<Record<string, unknown> & { sourceRecordKey: string }>> {
    for (const row of this.rows) {
      yield { cursor: new Date().toISOString(), records: [{ sourceRecordId: row.item_code, operation: 'UPSERT' as const, payload: { ...row, sourceRecordKey: row.item_code }, sourceTimestamp: new Date() }] };
    }
  }
}
