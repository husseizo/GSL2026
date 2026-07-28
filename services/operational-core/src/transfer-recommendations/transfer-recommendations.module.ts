import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { TransferRecommendationsController } from './transfer-recommendations.controller';
import { TransferRecommendationsService } from './transfer-recommendations.service';

@Module({
  imports: [ObservabilityModule],
  controllers: [TransferRecommendationsController],
  providers: [TransferRecommendationsService],
  exports: [TransferRecommendationsService],
})
export class TransferRecommendationsModule {}
