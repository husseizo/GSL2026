import { Module } from '@nestjs/common';
import { PurchaseRecommendationsModule } from '../purchase-recommendations/purchase-recommendations.module';
import { TransferRecommendationsModule } from '../transfer-recommendations/transfer-recommendations.module';
import { WorkshopInventoryRequestsController } from './workshop-inventory-requests.controller';
import { WorkshopInventoryRequestsService } from './workshop-inventory-requests.service';

@Module({
  imports: [PurchaseRecommendationsModule, TransferRecommendationsModule],
  controllers: [WorkshopInventoryRequestsController],
  providers: [WorkshopInventoryRequestsService],
  exports: [WorkshopInventoryRequestsService],
})
export class WorkshopInventoryRequestsModule {}
