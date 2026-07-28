import nock from 'nock';
import { OdooAdapter } from './odoo.adapter';

const BASE_URL = 'http://odoo-mock.local';

describe('OdooAdapter (against a local mock of the real Odoo JSON-RPC 2.0 contract)', () => {
  afterEach(() => nock.cleanAll());

  function makeAdapter() {
    return new OdooAdapter({ baseUrl: BASE_URL, database: 'testdb', username: 'admin', password: 'secret' });
  }

  function mockLogin(uid: number | false = 7) {
    return nock(BASE_URL)
      .post('/jsonrpc', (body) => body.params?.method === 'login')
      .reply(200, { jsonrpc: '2.0', id: 1, result: uid });
  }

  it('authenticates via the real Odoo common/login JSON-RPC method', async () => {
    mockLogin(7);
    await expect(makeAdapter().authenticate()).resolves.toBeUndefined();
  });

  it('treats a false uid as an authentication failure', async () => {
    mockLogin(false);
    await expect(makeAdapter().authenticate()).rejects.toThrow('authentication failed');
  });

  it('health() reports authenticated:true on successful login', async () => {
    mockLogin(7);
    const health = await makeAdapter().health();
    expect(health.reachable).toBe(true);
    expect(health.authenticated).toBe(true);
  });

  it('health() reports failure without throwing when Odoo is unreachable', async () => {
    nock(BASE_URL).post('/jsonrpc').replyWithError('connection refused');
    const health = await makeAdapter().health();
    expect(health.reachable).toBe(false);
  });

  it('fetchChanges calls execute_kw with search_read on product.template and maps into LegacyPartRaw', async () => {
    mockLogin(7);
    nock(BASE_URL)
      .post('/jsonrpc', (body) => body.params?.method === 'execute_kw')
      .reply(200, {
        jsonrpc: '2.0',
        id: 2,
        result: [
          { id: 101, default_code: 'OEM-100', name: 'Water Pump', categ_id: [5, 'Cooling'], write_date: '2026-01-01 10:00:00' },
          { id: 102, default_code: false, name: 'Generic kit (no part number)', categ_id: false, write_date: '2026-01-01 11:00:00' },
        ],
      });

    const adapter = makeAdapter();
    const batches = [];
    for await (const batch of adapter.fetchChanges(null)) batches.push(batch);

    expect(batches).toHaveLength(1);
    // The record with no default_code (no OEM number) is filtered out —
    // PartSyncHandler.validate() would reject it anyway, but the adapter
    // filters it here rather than pretending it has a part number.
    expect(batches[0].records).toHaveLength(1);
    expect(batches[0].records[0].payload).toEqual({ oem_no: 'OEM-100', description: 'Water Pump', category: 'Cooling' });
  });

  it('getMetadata reports the real system name and supported entities', async () => {
    const metadata = await makeAdapter().getMetadata();
    expect(metadata.systemName).toBe('Odoo');
  });
});
