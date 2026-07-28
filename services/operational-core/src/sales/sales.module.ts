import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesDocumentSyncHandler } from './handlers/sales-document-sync.handler';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [IntegrationModule, InventoryModule],
  controllers: [SalesController],
  providers: [SalesService, SalesDocumentSyncHandler],
  exports: [SalesService],
})
export class SalesModule {}
