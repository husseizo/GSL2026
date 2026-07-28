import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { SupplierAnalyticsService } from './supplier-analytics.service';

@Controller('supplier-analytics')
@UseGuards(PermissionsGuard)
export class SupplierAnalyticsController {
  constructor(private readonly analytics: SupplierAnalyticsService) {}

  @Post('recalculate')
  @RequirePermissions('supplierAnalytics.read')
  recalculate() {
    return this.analytics.recalculate();
  }

  @Get('metrics')
  @RequirePermissions('supplierAnalytics.read')
  listMetrics() {
    return this.analytics.listMetrics();
  }

  @Get('scorecard/:supplierId')
  @RequirePermissions('supplierAnalytics.read')
  getScorecard(@Param('supplierId') supplierId: string) {
    return this.analytics.getScorecard(supplierId);
  }

  @Get('late-purchase-orders')
  @RequirePermissions('supplierAnalytics.read')
  listLatePurchaseOrders() {
    return this.analytics.listLatePurchaseOrders();
  }
}
