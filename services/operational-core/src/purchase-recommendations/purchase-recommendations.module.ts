import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { AiPurchasingSignalsService } from './ai-purchasing-signals.service';
import { PurchaseRecommendationsController } from './purchase-recommendations.controller';
import { PurchaseRecommendationsService } from './purchase-recommendations.service';

@Module({
  imports: [ObservabilityModule],
  controllers: [PurchaseRecommendationsController],
  providers: [PurchaseRecommendationsService, AiPurchasingSignalsService],
  exports: [PurchaseRecommendationsService],
})
export class PurchaseRecommendationsModule {}
