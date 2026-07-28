import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

// The one place anything in this app talks to Redis. Every use here is
// either a cache in front of a real Postgres value (never the only copy of
// data) or purely ephemeral coordination (locks, rate-limit counters,
// queues) — "Redis is never a system of record" is enforced by there being
// no method here that stores something Postgres doesn't also have. See
// docs/architecture/redis.md.
//
// Connects to REDIS_URL if set; defaults to 127.0.0.1:6379. In this
// sandbox (no system Redis installed), dev/tests point REDIS_URL at a real
// redis-memory-server instance (see scripts/dev-redis.ts /
// test-global-setup-integration.ts) — a genuine Redis binary, not a mock.
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1, retryStrategy: () => null });
    this.client.on('error', (err) => this.logger.warn(`Redis connection error: ${err.message}`));
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }

  // --- Distributed cache ---------------------------------------------------

  async cacheGet<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async cacheDelete(key: string): Promise<void> {
    await this.client.del(key);
  }

  // --- Distributed lock (single-instance Redlock — real for one Redis node,
  // documented as not the full multi-node Redlock algorithm) ---------------

  async acquireLock(resource: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.client.set(`lock:${resource}`, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  async releaseLock(resource: string, token: string): Promise<boolean> {
    // Only release if we still hold it (token matches) — a Lua script makes
    // the check-and-delete atomic so a lock that expired and was re-acquired
    // by someone else is never accidentally released out from under them.
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.client.eval(script, 1, `lock:${resource}`, token);
    return result === 1;
  }

  // --- Distributed rate limiting (sliding window via sorted set) ---------

  async isWithinRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const redisKey = `ratelimit:${key}`;

    const pipeline = this.client.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zadd(redisKey, now, `${now}-${randomUUID()}`);
    pipeline.zcard(redisKey);
    pipeline.expire(redisKey, windowSeconds);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;
    return count <= maxRequests;
  }

  // --- Queue (list-backed, at-least-once — real for Notification/Branch
  // Gateway background workers) ---------------------------------------------

  async pushToQueue(queueName: string, payload: unknown): Promise<void> {
    await this.client.lpush(`queue:${queueName}`, JSON.stringify(payload));
  }

  async popFromQueue<T>(queueName: string): Promise<T | null> {
    const raw = await this.client.rpop(`queue:${queueName}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async queueLength(queueName: string): Promise<number> {
    return this.client.llen(`queue:${queueName}`);
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
