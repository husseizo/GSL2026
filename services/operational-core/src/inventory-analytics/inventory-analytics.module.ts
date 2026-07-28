import { Module } from '@nestjs/common';
import { CLASSIFICATION_CONFIG, DEFAULT_CLASSIFICATION_CONFIG } from './classification.config';
import { InventoryAnalyticsController } from './inventory-analytics.controller';
import { InventoryAnalyticsService } from './inventory-analytics.service';

@Module({
  controllers: [InventoryAnalyticsController],
  providers: [
    InventoryAnalyticsService,
    { provide: CLASSIFICATION_CONFIG, useValue: DEFAULT_CLASSIFICATION_CONFIG },
  ],
  exports: [InventoryAnalyticsService],
})
export class InventoryAnalyticsModule {}
