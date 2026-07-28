import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// Real health checks — each one actually exercises the dependency it
// reports on (a real SELECT 1, a real Redis PING, a real DGX /v1/health
// call) rather than always returning "ok". See docs/architecture/api-platform.md.
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dgxClient: DgxClientService,
  ) {}

  @Get()
  async health() {
    const [db, redisOk, dgx] = await Promise.all([this.checkDb(), this.redis.ping(), this.checkDgx()]);

    const overall = db.ok && redisOk && dgx.ok ? 'ok' : 'degraded';
    return {
      status: overall,
      timestamp: new Date().toISOString(),
      dependencies: { database: db, redis: { ok: redisOk }, dgx },
    };
  }

  @Get('db')
  async db() {
    return this.checkDb();
  }

  @Get('redis')
  async redisHealth() {
    return { ok: await this.redis.ping() };
  }

  @Get('dgx')
  async dgxHealth() {
    return this.checkDgx();
  }

  private async checkDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  private async checkDgx(): Promise<{ ok: boolean; details?: unknown; error?: string }> {
    try {
      const details = await this.dgxClient.health();
      return { ok: details.ollamaReachable, details };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
