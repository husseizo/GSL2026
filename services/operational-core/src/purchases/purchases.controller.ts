import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { FileDropAdapter } from '../integration/adapters/file-drop.adapter';
import { IntegrationService } from '../integration/integration.service';
import { RecordGoodsReceiptDto } from './dto/record-goods-receipt.dto';
import { GoodsReceiptsService } from './goods-receipts.service';
import { LegacyPurchaseDocumentRaw, PurchaseDocumentSyncHandler } from './handlers/purchase-document-sync.handler';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(PermissionsGuard)
export class PurchasesController {
  constructor(
    private readonly purchases: PurchasesService,
    private readonly goodsReceipts: GoodsReceiptsService,
    private readonly integration: IntegrationService,
    private readonly purchaseHandler: PurchaseDocumentSyncHandler,
    private readonly config: ConfigService,
  ) {}

  @Post('sync')
  @RequirePermissions('purchases.import')
  sync() {
    const dir = this.config.get<string>('PURCHASE_SYNC_DIR', './sample-data/legacy-purchases');
    // Distinct source name from the part sync ('LEGACY_ERP') — see the
    // matching comment in sales.controller.ts.
    const adapter = new FileDropAdapter<LegacyPurchaseDocumentRaw>('LEGACY_ERP_PURCHASES', 'PURCHASE_DOCUMENT', dir);
    return this.integration.runSync(adapter, this.purchaseHandler);
  }

  @Get()
  @RequirePermissions('purchases.read')
  list(@Query() query: PaginationQueryDto, @Query('supplierId') supplierId?: string) {
    return this.purchases.list({ ...query, supplierId });
  }

  @Get('by-item')
  @RequirePermissions('purchases.read')
  searchByItem(@Query('partId') partId?: string, @Query('lubricantProductId') lubricantProductId?: string) {
    return this.purchases.searchByItem(partId, lubricantProductId);
  }

  @Get(':id')
  @RequirePermissions('purchases.read')
  findById(@Param('id') id: string) {
    return this.purchases.findById(id);
  }

  @Post(':id/goods-receipts')
  @RequirePermissions('purchases.import')
  recordGoodsReceipt(@Param('id') id: string, @Body() dto: RecordGoodsReceiptDto) {
    return this.goodsReceipts.recordReceipt(id, dto);
  }
}
