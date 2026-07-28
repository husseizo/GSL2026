import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';
import { ObservabilityController } from './observability.controller';

@Module({
  controllers: [ObservabilityController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
