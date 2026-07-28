import { RedisService } from './redis.service';

// Real Redis (redis-memory-server — a genuine Redis binary, not a mock),
// started for this session via scripts/start-dev-redis.js. See
// docs/architecture/redis.md.
describe('RedisService (integration, real Redis)', () => {
  let redis: RedisService;

  beforeAll(() => {
    redis = new RedisService();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
  });

  it('pings the real server successfully', async () => {
    expect(await redis.ping()).toBe(true);
  });

  it('cacheSet/cacheGet round-trips a real value with a TTL', async () => {
    await redis.cacheSet('test:cache:1', { hello: 'world' }, 30);
    const value = await redis.cacheGet<{ hello: string }>('test:cache:1');
    expect(value).toEqual({ hello: 'world' });
  });

  it('cacheGet returns null for a missing key', async () => {
    expect(await redis.cacheGet('test:cache:does-not-exist')).toBeNull();
  });

  it('cacheDelete removes a cached value', async () => {
    await redis.cacheSet('test:cache:2', 'value', 30);
    await redis.cacheDelete('test:cache:2');
    expect(await redis.cacheGet('test:cache:2')).toBeNull();
  });

  it('acquireLock prevents a second concurrent acquisition, releaseLock frees it', async () => {
    const token1 = await redis.acquireLock('test-resource', 5000);
    expect(token1).not.toBeNull();

    const token2 = await redis.acquireLock('test-resource', 5000);
    expect(token2).toBeNull(); // already held

    const released = await redis.releaseLock('test-resource', token1!);
    expect(released).toBe(true);

    const token3 = await redis.acquireLock('test-resource', 5000);
    expect(token3).not.toBeNull(); // free again after release
  });

  it('releaseLock refuses to release a lock held by a different token', async () => {
    const token = await redis.acquireLock('test-resource-2', 5000);
    expect(token).not.toBeNull();
    const releasedByWrongToken = await redis.releaseLock('test-resource-2', 'not-the-real-token');
    expect(releasedByWrongToken).toBe(false);
  });

  it('isWithinRateLimit allows requests under the limit and blocks past it', async () => {
    const key = `test-rate-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(await redis.isWithinRateLimit(key, 5, 60)).toBe(true);
    }
    expect(await redis.isWithinRateLimit(key, 5, 60)).toBe(false);
  });

  it('queue push/pop is real and FIFO-ordered (list-backed)', async () => {
    const queueName = `test-queue-${Date.now()}`;
    await redis.pushToQueue(queueName, { id: 1 });
    await redis.pushToQueue(queueName, { id: 2 });
    expect(await redis.queueLength(queueName)).toBe(2);

    const first = await redis.popFromQueue<{ id: number }>(queueName);
    const second = await redis.popFromQueue<{ id: number }>(queueName);
    expect(first).toEqual({ id: 1 });
    expect(second).toEqual({ id: 2 });
    expect(await redis.popFromQueue(queueName)).toBeNull();
  });
});
