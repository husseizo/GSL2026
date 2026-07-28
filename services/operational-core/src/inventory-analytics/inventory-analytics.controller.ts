import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AbcClass, MovementClass } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { InventoryAnalyticsService } from './inventory-analytics.service';

@Controller('inventory-analytics')
@UseGuards(PermissionsGuard)
export class InventoryAnalyticsController {
  constructor(private readonly analytics: InventoryAnalyticsService) {}

  @Post('recalculate')
  @RequirePermissions('inventory.adjust')
  recalculate() {
    return this.analytics.recalculate();
  }

  @Get('metrics')
  @RequirePermissions('inventory.read')
  getMetrics(
    @Query('partId') partId?: string,
    @Query('lubricantProductId') lubricantProductId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.analytics.getMetrics({ partId, lubricantProductId, warehouseId: warehouseId ?? undefined });
  }

  @Get('classification')
  @RequirePermissions('inventory.read')
  getClassification(@Query('movementClass') movementClass?: MovementClass, @Query('abcClass') abcClass?: AbcClass) {
    return this.analytics.getClassification({ movementClass, abcClass });
  }
}
