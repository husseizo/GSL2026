import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function makeContext(headers: Record<string, string>, body: unknown = {}) {
  // Mimics Express's real chainable res.status(code) — it mutates
  // statusCode and returns `this`, which is what the interceptor's
  // response.status(...) call relies on.
  const response = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => ({ headers, method: 'POST', body }), getResponse: () => response }),
    } as unknown as ExecutionContext,
    response,
  };
}

describe('API Platform (integration, real Postgres + real Redis + real DGX)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let interceptor: IdempotencyInterceptor;
  let health: HealthController;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    interceptor = new IdempotencyInterceptor(prisma);
    redis = new RedisService();
    health = new HealthController(prisma, redis, new DgxClientService());
  });

  afterAll(async () => {
    await prisma.$disconnect();
    // Real fix (DGX Prototype 1.5): this real ioredis connection was never
    // closed, which kept the Jest worker process alive indefinitely after
    // every test in this file passed — the process reported success but
    // never exited, looking identical to a hang. Discovered while
    // diagnosing an hours-long "stuck" catalogue-ai integration run that
    // turned out to have the exact same root cause in a different file
    // (catalogue-rag.integration-spec.ts) — see docs/ai-tuning/decision-log.md.
    await redis.onModuleDestroy();
  });

  it('passes a request through untouched when no Idempotency-Key header is present', async () => {
    const { context } = makeContext({});
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    const result$ = await interceptor.intercept(context, handler);
    const result = await new Promise((resolve) => result$.subscribe(resolve));
    expect(result).toEqual({ ok: true });
  });

  it('a repeated request with the same Idempotency-Key returns the first real stored response without re-executing the handler', async () => {
    const key = `idem-test-${Date.now()}`;
    let handlerCallCount = 0;
    const handler: CallHandler = {
      handle: () => {
        handlerCallCount += 1;
        return of({ orderId: 'created-once' });
      },
    };

    const { context: firstContext } = makeContext({ 'idempotency-key': key }, { amount: 100 });
    const first$ = await interceptor.intercept(firstContext, handler);
    await new Promise((resolve) => first$.subscribe(resolve));
    expect(handlerCallCount).toBe(1);

    const { context: secondContext } = makeContext({ 'idempotency-key': key }, { amount: 100 });
    const second$ = await interceptor.intercept(secondContext, handler);
    const secondResult = await new Promise((resolve) => second$.subscribe(resolve));

    expect(handlerCallCount).toBe(1); // handler never called a second time
    expect(secondResult).toEqual({ orderId: 'created-once' });

    const stored = await prisma.idempotencyKey.findUniqueOrThrow({ where: { key } });
    expect(stored.completedAt).not.toBeNull();
  });

  it('rejects a repeated Idempotency-Key used with a different request body', async () => {
    const key = `idem-conflict-${Date.now()}`;
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    const { context: firstContext } = makeContext({ 'idempotency-key': key }, { amount: 100 });
    const first$ = await interceptor.intercept(firstContext, handler);
    await new Promise((resolve) => first$.subscribe(resolve));

    const { context: secondContext, response } = makeContext({ 'idempotency-key': key }, { amount: 999 });
    const second$ = await interceptor.intercept(secondContext, handler);
    const result: any = await new Promise((resolve) => second$.subscribe(resolve));

    expect(response.statusCode).toBe(409);
    expect(result.error.code).toBe('IdempotencyKeyConflict');
  });

  it('health() reports real, independently-checked dependency status', async () => {
    const result = await health.health();
    expect(result.dependencies.database.ok).toBe(true);
    expect(typeof result.dependencies.redis.ok).toBe('boolean');
    expect(typeof result.dependencies.dgx.ok).toBe('boolean');
  }, 15_000);
});
