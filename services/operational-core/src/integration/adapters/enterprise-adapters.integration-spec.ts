import nock from 'nock';
import { PartSyncHandler } from '../handlers/part-sync.handler';
import { IntegrationService } from '../integration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OdooAdapter } from './odoo.adapter';
import { SapBusinessOneAdapter } from './sap-business-one.adapter';

// Proves the spec's "no adapter may directly modify Operational Core
// tables — everything passes through Integration Services" end to end:
// the adapters below only ever call fetch() against a mocked SAP B1/Odoo
// endpoint; every Part row that ends up in real Postgres does so via
// IntegrationService.runSync() + the existing, unmodified PartSyncHandler.
describe('Enterprise adapters -> IntegrationService -> real Postgres (integration)', () => {
  let prisma: PrismaService;
  let integrationService: IntegrationService;
  let partSyncHandler: PartSyncHandler;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    integrationService = new IntegrationService(prisma);
    partSyncHandler = new PartSyncHandler(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(() => nock.cleanAll());

  it('syncs a real Part row from a mocked SAP Business One Items feed', async () => {
    const baseUrl = 'http://sap-b1-integration-test.local';
    nock(baseUrl).post('/b1s/v1/Login').reply(200, {}, { 'set-cookie': 'B1SESSION=abc' });
    nock(baseUrl)
      .get('/b1s/v1/Items')
      .query(true)
      .reply(200, { value: [{ ItemCode: 'SAP-OEM-1', ItemName: 'SAP Sourced Alternator', ItmsGrpNam: 'Electrical', UpdateDate: '2026-02-01' }] });

    const adapter = new SapBusinessOneAdapter({ baseUrl, companyDb: 'TESTDB', username: 'u', password: 'p' });
    const summary = await integrationService.runSync(adapter, partSyncHandler);

    expect(summary.recordsUpserted).toBe(1);
    const part = await prisma.part.findUniqueOrThrow({ where: { sourceSystem_sourceRecordId: { sourceSystem: 'SAP_BUSINESS_ONE', sourceRecordId: 'SAP-OEM-1' } } });
    expect(part.productName).toBe('SAP Sourced Alternator');
  });

  it('syncs a real Part row from a mocked Odoo product.template feed', async () => {
    const baseUrl = 'http://odoo-integration-test.local';
    nock(baseUrl)
      .post('/jsonrpc', (body) => body.params?.method === 'login')
      .reply(200, { jsonrpc: '2.0', id: 1, result: 7 });
    nock(baseUrl)
      .post('/jsonrpc', (body) => body.params?.method === 'execute_kw')
      .reply(200, {
        jsonrpc: '2.0',
        id: 2,
        result: [{ id: 55, default_code: 'ODOO-OEM-1', name: 'Odoo Sourced Radiator', categ_id: [3, 'Cooling'], write_date: '2026-02-01 00:00:00' }],
      });

    const adapter = new OdooAdapter({ baseUrl, database: 'testdb', username: 'admin', password: 'p' });
    const summary = await integrationService.runSync(adapter, partSyncHandler);

    expect(summary.recordsUpserted).toBe(1);
    const part = await prisma.part.findUniqueOrThrow({ where: { sourceSystem_sourceRecordId: { sourceSystem: 'ODOO', sourceRecordId: '55' } } });
    expect(part.productName).toBe('Odoo Sourced Radiator');
  });

  it('replaying the same SAP B1 batch again is idempotent (no duplicate Part rows, no re-upsert)', async () => {
    const baseUrl = 'http://sap-b1-replay-test.local';
    const mockLogin = () => nock(baseUrl).post('/b1s/v1/Login').reply(200, {}, { 'set-cookie': 'B1SESSION=abc' });
    const mockItems = () =>
      nock(baseUrl)
        .get('/b1s/v1/Items')
        .query(true)
        .reply(200, { value: [{ ItemCode: 'SAP-REPLAY-1', ItemName: 'Replay Test Part', UpdateDate: '2026-02-01' }] });

    mockLogin();
    mockItems();
    const adapter1 = new SapBusinessOneAdapter({ baseUrl, companyDb: 'TESTDB', username: 'u', password: 'p' });
    const firstRun = await integrationService.runSync(adapter1, partSyncHandler);
    expect(firstRun.recordsUpserted).toBe(1);

    mockLogin();
    mockItems();
    const adapter2 = new SapBusinessOneAdapter({ baseUrl, companyDb: 'TESTDB', username: 'u', password: 'p' });
    const secondRun = await integrationService.runSync(adapter2, partSyncHandler);
    expect(secondRun.recordsUpserted).toBe(0);
    expect(secondRun.recordsSkipped).toBe(1);
  });
});
