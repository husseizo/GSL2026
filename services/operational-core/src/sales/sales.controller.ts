import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { FileDropAdapter } from '../integration/adapters/file-drop.adapter';
import { IntegrationService } from '../integration/integration.service';
import { LegacySalesDocumentRaw, SalesDocumentSyncHandler } from './handlers/sales-document-sync.handler';
import { SalesService } from './sales.service';

@Controller('sales')
@UseGuards(PermissionsGuard)
export class SalesController {
  constructor(
    private readonly sales: SalesService,
    private readonly integration: IntegrationService,
    private readonly salesHandler: SalesDocumentSyncHandler,
    private readonly config: ConfigService,
  ) {}

  @Post('sync')
  @RequirePermissions('sales.import')
  sync() {
    const dir = this.config.get<string>('SALES_SYNC_DIR', './sample-data/legacy-sales');
    // Distinct source name from the vehicle sync ('LEGACY_POS') — the
    // integration engine keys its cursor by sourceSystem name alone, so two
    // feeds sharing a name would corrupt each other's replay position even
    // though they read different directories.
    const adapter = new FileDropAdapter<LegacySalesDocumentRaw>('LEGACY_POS_SALES', 'SALES_DOCUMENT', dir);
    return this.integration.runSync(adapter, this.salesHandler);
  }

  @Get()
  @RequirePermissions('sales.read')
  list(@Query() query: PaginationQueryDto, @Query('customerId') customerId?: string) {
    return this.sales.list({ ...query, customerId });
  }

  @Get('by-document-number/:documentNumber')
  @RequirePermissions('sales.read')
  findByDocumentNumber(@Param('documentNumber') documentNumber: string) {
    return this.sales.findByDocumentNumber(documentNumber);
  }

  @Get('by-item')
  @RequirePermissions('sales.read')
  searchByItem(@Query('partId') partId?: string, @Query('lubricantProductId') lubricantProductId?: string) {
    return this.sales.searchByItem(partId, lubricantProductId);
  }

  @Get('by-vehicle/:vehicleId')
  @RequirePermissions('sales.read')
  searchByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.sales.searchByVehicle(vehicleId);
  }

  @Get(':id')
  @RequirePermissions('sales.read')
  findById(@Param('id') id: string) {
    return this.sales.findById(id);
  }
}
