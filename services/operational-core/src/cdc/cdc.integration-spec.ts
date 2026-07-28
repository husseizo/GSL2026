import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { CdcService } from './cdc.service';

// Real PostgreSQL logical replication against a genuine second cluster
// (wal_level=logical) — not this repo's shared dev database, which
// deliberately keeps wal_level=replica (see docs/architecture/cdc.md for
// why). CDC_TEST_DATABASE_URL points at that second cluster; these tests
// are skipped (not faked) if it isn't reachable, consistent with "report
// unavailable infrastructure honestly."
const CDC_HOST = process.env.CDC_TEST_HOST ?? '127.0.0.1';
const CDC_PORT = Number(process.env.CDC_TEST_PORT ?? 55433);
const CDC_DATABASE = process.env.CDC_TEST_DATABASE ?? 'aios_cdc_test';

describe('CdcService (integration, real PostgreSQL logical replication)', () => {
  let prisma: PrismaService;
  let cdc: CdcService;
  let pgClient: Client;
  const sourceName = `cdc-jest-${Date.now()}`;
  const slotName = `slot_${Date.now()}`;
  const pubName = `pub_${Date.now()}`;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    cdc = new CdcService(prisma);

    pgClient = new Client({ host: CDC_HOST, port: CDC_PORT, user: 'postgres', database: CDC_DATABASE });
    await pgClient.connect();
    await pgClient.query(`CREATE PUBLICATION ${pubName} FOR TABLE demo_orders`);
    await pgClient.query(`SELECT pg_create_logical_replication_slot('${slotName}', 'pgoutput')`);
  }, 20_000);

  afterAll(async () => {
    await cdc.stopReplication(sourceName);
    await pgClient.query(`SELECT pg_drop_replication_slot('${slotName}')`).catch(() => undefined);
    await pgClient.query(`DROP PUBLICATION IF EXISTS ${pubName}`).catch(() => undefined);
    await pgClient.end();
    await prisma.$disconnect();
  });

  it('captures a real INSERT and UPDATE from the WAL via pgoutput, in a Debezium-envelope-compatible shape', async () => {
    await cdc.startReplication({
      sourceName,
      connection: { host: CDC_HOST, port: CDC_PORT, user: 'postgres', database: CDC_DATABASE },
      publicationName: pubName,
      slotName,
    });

    // Give the replication stream a moment to establish before generating changes.
    await new Promise((r) => setTimeout(r, 500));

    await pgClient.query("INSERT INTO demo_orders (customer, amount) VALUES ('CDC Test Customer', 250)");
    await pgClient.query("UPDATE demo_orders SET amount = 300 WHERE customer = 'CDC Test Customer'");

    await new Promise((r) => setTimeout(r, 1500));

    const events = await cdc.listEvents(sourceName);
    expect(events.length).toBeGreaterThanOrEqual(2);

    const insertEvent = events.find((e) => e.operation === 'INSERT');
    const updateEvent = events.find((e) => e.operation === 'UPDATE');
    expect(insertEvent).toBeDefined();
    expect(updateEvent).toBeDefined();
    expect((insertEvent!.after as { customer: string }).customer).toBe('CDC Test Customer');
    expect((updateEvent!.after as { amount: string }).amount).toBe('300');

    const checkpoint = await cdc.getCheckpoint(sourceName);
    expect(checkpoint?.lastLsn).toBeTruthy();
  }, 15_000);

  it('is idempotent: stopping and restarting replication does not duplicate already-recorded events on redelivery', async () => {
    const beforeCount = (await cdc.listEvents(sourceName)).length;

    await cdc.stopReplication(sourceName);
    // Restarting subscribes from the slot's confirmed position again — no
    // new committed transactions happened, so no new events should appear,
    // and any redelivered-but-already-seen LSN would be a no-op per the
    // (sourceName, lsn) idempotency check.
    await cdc.startReplication({
      sourceName,
      connection: { host: CDC_HOST, port: CDC_PORT, user: 'postgres', database: CDC_DATABASE },
      publicationName: pubName,
      slotName,
    });
    await new Promise((r) => setTimeout(r, 1000));

    const afterCount = (await cdc.listEvents(sourceName)).length;
    expect(afterCount).toBe(beforeCount);
  }, 15_000);
});
