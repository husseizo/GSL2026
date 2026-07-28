import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LostSaleStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { RecordManualLostSaleDto } from './dto/record-manual-lost-sale.dto';
import { LostSalesEngineService } from './lost-sales-engine.service';
import { LostSalesService } from './lost-sales.service';

@Controller('lost-sales')
@UseGuards(PermissionsGuard)
export class LostSalesController {
  constructor(
    private readonly lostSales: LostSalesService,
    private readonly engine: LostSalesEngineService,
  ) {}

  @Post('detect')
  @RequirePermissions('lostSales.review')
  detect(@Body('since') since?: string) {
    return this.engine.detect(since ? new Date(since) : undefined);
  }

  @Post('manual')
  @RequirePermissions('lostSales.review')
  recordManual(@Body() dto: RecordManualLostSaleDto) {
    return this.engine.recordManual(dto);
  }

  @Get()
  @RequirePermissions('lostSales.read')
  list(@Query('status') status?: LostSaleStatus, @Query('partId') partId?: string, @Query('lubricantProductId') lubricantProductId?: string) {
    return this.lostSales.list({ status, partId, lubricantProductId });
  }

  @Get('summary')
  @RequirePermissions('lostSales.read')
  summary() {
    return this.lostSales.summary();
  }

  @Get(':id')
  @RequirePermissions('lostSales.read')
  getById(@Param('id') id: string) {
    return this.lostSales.getById(id);
  }

  @Patch(':id/confirm')
  @RequirePermissions('lostSales.review')
  confirm(@Param('id') id: string, @Body('resolvedById') resolvedById: string, @Body('resolutionReason') resolutionReason?: string) {
    return this.lostSales.confirm(id, resolvedById, resolutionReason);
  }

  @Patch(':id/dismiss')
  @RequirePermissions('lostSales.review')
  dismiss(@Param('id') id: string, @Body('resolvedById') resolvedById: string, @Body('resolutionReason') resolutionReason?: string) {
    return this.lostSales.dismiss(id, resolvedById, resolutionReason);
  }

  @Patch(':id/convert')
  @RequirePermissions('lostSales.review')
  convert(@Param('id') id: string, @Body('resolvedById') resolvedById: string, @Body('resolutionReason') resolutionReason?: string) {
    return this.lostSales.convert(id, resolvedById, resolutionReason);
  }
}
