import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { RedisModule } from '../redis/redis.module';
import { ApiRateLimitGuard } from './api-rate-limit.guard';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { HealthController } from './health.controller';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { RequestLoggingMiddleware } from './request-logging.middleware';

@Module({
  imports: [RedisModule, AiGatewayModule],
  controllers: [HealthController],
  providers: [IdempotencyInterceptor, { provide: APP_GUARD, useClass: ApiRateLimitGuard }],
  exports: [IdempotencyInterceptor],
})
export class ApiPlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
