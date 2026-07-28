import { PrismaService } from '../prisma/prisma.service';
import { createWarehouseFixture } from '../test-helpers/db-fixtures';
import { BranchGatewayService } from './branch-gateway.service';

describe('BranchGatewayService (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let gateway: BranchGatewayService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    gateway = new BranchGatewayService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enqueues a small message uncompressed and a large message compressed', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'bg-1');

    const small = await gateway.enqueue(branch.id, 'JOB_UPDATE', { jobId: '1' }, 5);
    expect(small.compressed).toBe(false);

    const large = await gateway.enqueue(branch.id, 'BULK_SYNC', { data: 'x'.repeat(5000) }, 5);
    expect(large.compressed).toBe(true);

    const stored = await prisma.branchOutboxMessage.findUniqueOrThrow({ where: { id: large.id } });
    expect((stored.payload as { compressed: string }).compressed).toBeDefined();
  });

  it('dequeueNext respects priority order (lower number = higher priority)', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'bg-2');
    await gateway.enqueue(branch.id, 'LOW', { x: 1 }, 9);
    await gateway.enqueue(branch.id, 'HIGH', { x: 2 }, 1);

    const next = await gateway.dequeueNext(branch.id);
    expect(next?.messageType).toBe('HIGH');
  });

  it('processQueue delivers real messages via the injected deliverer and marks them SENT', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'bg-3');
    await gateway.enqueue(branch.id, 'TYPE_A', { a: 1 });
    await gateway.enqueue(branch.id, 'TYPE_B', { b: 2 });

    const delivered: unknown[] = [];
    const result = await gateway.processQueue(branch.id, async (payload) => {
      delivered.push(payload);
    });

    expect(result.sent).toBe(2);
    expect(result.remaining).toBe(0);
    expect(delivered).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('processQueue retries on failure and eventually marks FAILED after exhausting retries, replay() re-queues it', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'bg-4');
    const { id: messageId } = await gateway.enqueue(branch.id, 'ALWAYS_FAILS', { x: 1 });

    // Drive it through all 5 attempts by calling processQueue repeatedly —
    // each call stops after one retryable failure, so we call it enough
    // times to exhaust the real MAX_DELIVERY_ATTEMPTS.
    for (let i = 0; i < 5; i++) {
      await gateway.processQueue(branch.id, async () => {
        throw new Error('simulated delivery failure');
      });
    }

    const failedMessage = await prisma.branchOutboxMessage.findUniqueOrThrow({ where: { id: messageId } });
    expect(failedMessage.status).toBe('FAILED');
    expect(failedMessage.attempts).toBeGreaterThanOrEqual(5);
    expect(failedMessage.lastError).toContain('simulated delivery failure');

    await gateway.replay(messageId);
    const replayed = await prisma.branchOutboxMessage.findUniqueOrThrow({ where: { id: messageId } });
    expect(replayed.status).toBe('PENDING');
    expect(replayed.attempts).toBe(0);
  });

  it('detects a tampered payload via signature verification and marks the message FAILED without ever calling the deliverer', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'bg-5');
    const { id } = await gateway.enqueue(branch.id, 'TAMPER_TEST', { amount: 100 });

    // Simulate tampering: mutate the stored payload without updating the signature.
    await prisma.branchOutboxMessage.update({ where: { id }, data: { payload: { amount: 999999 } } });

    let delivererCalled = false;
    await gateway.processQueue(branch.id, async () => {
      delivererCalled = true;
    });

    expect(delivererCalled).toBe(false);
    const message = await prisma.branchOutboxMessage.findUniqueOrThrow({ where: { id } });
    expect(message.status).toBe('FAILED');
    expect(message.lastError).toContain('Signature verification failed');
  });

  it('records and retrieves branch health pings with a real queue-depth snapshot', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'bg-6');
    await gateway.enqueue(branch.id, 'PENDING_MSG', { x: 1 });

    await gateway.recordHealthPing(branch.id, true, 42);
    const health = await gateway.getLatestHealth(branch.id);

    expect(health?.isOnline).toBe(true);
    expect(health?.latencyMs).toBe(42);
    expect(health?.queueDepth).toBe(1);
  });
});
