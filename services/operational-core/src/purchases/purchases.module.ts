import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { InventoryModule } from '../inventory/inventory.module';
import { GoodsReceiptsService } from './goods-receipts.service';
import { PurchaseDocumentSyncHandler } from './handlers/purchase-document-sync.handler';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [IntegrationModule, InventoryModule],
  controllers: [PurchasesController],
  providers: [PurchasesService, GoodsReceiptsService, PurchaseDocumentSyncHandler],
  exports: [PurchasesService, GoodsReceiptsService],
})
export class PurchasesModule {}
