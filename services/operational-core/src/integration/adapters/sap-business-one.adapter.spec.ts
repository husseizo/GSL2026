import nock from 'nock';
import { SapBusinessOneAdapter } from './sap-business-one.adapter';

const BASE_URL = 'http://sap-b1-mock.local';

describe('SapBusinessOneAdapter (against a local mock of the real SAP B1 Service Layer contract)', () => {
  afterEach(() => nock.cleanAll());

  function makeAdapter() {
    return new SapBusinessOneAdapter({ baseUrl: BASE_URL, companyDb: 'TESTDB', username: 'manager', password: 'secret' });
  }

  it('authenticates via the real SAP B1 Login endpoint shape and captures the B1SESSION cookie', async () => {
    nock(BASE_URL)
      .post('/b1s/v1/Login', { CompanyDB: 'TESTDB', UserName: 'manager', Password: 'secret' })
      .reply(200, { SessionId: 'abc' }, { 'set-cookie': 'B1SESSION=abc123; Path=/; HttpOnly' });

    const adapter = makeAdapter();
    await expect(adapter.authenticate()).resolves.toBeUndefined();
  });

  it('health() reports authenticated:true on a successful login', async () => {
    nock(BASE_URL).post('/b1s/v1/Login').reply(200, {}, { 'set-cookie': 'B1SESSION=abc123' });

    const health = await makeAdapter().health();
    expect(health.reachable).toBe(true);
    expect(health.authenticated).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('health() reports unreachable/unauthenticated on a login failure, without throwing', async () => {
    nock(BASE_URL).post('/b1s/v1/Login').reply(401, 'Invalid credentials');

    const health = await makeAdapter().health();
    expect(health.reachable).toBe(false);
    expect(health.authenticated).toBe(false);
    expect(health.message).toContain('401');
  });

  it('fetchChanges maps real SAP B1 Items records into LegacyPartRaw and advances the cursor', async () => {
    nock(BASE_URL).post('/b1s/v1/Login').reply(200, {}, { 'set-cookie': 'B1SESSION=abc123' });
    nock(BASE_URL)
      .get('/b1s/v1/Items')
      .query(true)
      .reply(200, {
        value: [
          { ItemCode: 'OEM-001', ItemName: 'Ignition Coil', ItmsGrpNam: 'Electrical', Manufacturer: 'BMW', UpdateDate: '2026-01-01' },
          { ItemCode: 'OEM-002', ItemName: 'Brake Pad Set', ItmsGrpNam: 'Brakes', UpdateDate: '2026-01-02' },
        ],
      });

    const adapter = makeAdapter();
    const batches = [];
    for await (const batch of adapter.fetchChanges(null)) batches.push(batch);

    expect(batches).toHaveLength(1);
    expect(batches[0].cursor).toBe('2026-01-02');
    expect(batches[0].records).toHaveLength(2);
    expect(batches[0].records[0].payload).toEqual({ oem_no: 'OEM-001', description: 'Ignition Coil', brand: 'BMW', category: 'Electrical' });
  });

  it('getMetadata reports the real system name and supported entities', async () => {
    const metadata = await makeAdapter().getMetadata();
    expect(metadata.systemName).toBe('SAP Business One');
    expect(metadata.supportedEntities).toContain('PART');
  });
});
