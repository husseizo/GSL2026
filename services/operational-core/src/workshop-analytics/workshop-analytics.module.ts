import { Module } from '@nestjs/common';
import { WorkshopAnalyticsController } from './workshop-analytics.controller';
import { WorkshopAnalyticsService } from './workshop-analytics.service';

@Module({
  controllers: [WorkshopAnalyticsController],
  providers: [WorkshopAnalyticsService],
  exports: [WorkshopAnalyticsService],
})
export class WorkshopAnalyticsModule {}
