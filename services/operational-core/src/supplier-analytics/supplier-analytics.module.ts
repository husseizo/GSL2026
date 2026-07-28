import { Module } from '@nestjs/common';
import { SupplierAnalyticsController } from './supplier-analytics.controller';
import { SupplierAnalyticsService } from './supplier-analytics.service';

@Module({
  controllers: [SupplierAnalyticsController],
  providers: [SupplierAnalyticsService],
  exports: [SupplierAnalyticsService],
})
export class SupplierAnalyticsModule {}
