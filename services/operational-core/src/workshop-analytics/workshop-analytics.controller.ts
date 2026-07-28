import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { WorkshopAnalyticsService } from './workshop-analytics.service';

@Controller('workshop-analytics')
@UseGuards(PermissionsGuard)
export class WorkshopAnalyticsController {
  constructor(private readonly analytics: WorkshopAnalyticsService) {}

  @Get('dashboard')
  @RequirePermissions('jobcard.read')
  getDashboard(@Query('branchId') branchId?: string) {
    return this.analytics.getDashboard(branchId);
  }

  @Get('average-repair-duration')
  @RequirePermissions('jobcard.read')
  getAverageRepairDurationHours(@Query('branchId') branchId?: string) {
    return this.analytics.getAverageRepairDurationHours(branchId);
  }

  @Get('labour-revenue')
  @RequirePermissions('labour.read')
  getLabourRevenue(@Query('branchId') branchId?: string) {
    return this.analytics.getLabourRevenue(branchId);
  }

  @Get('technicians/:technicianId/utilization')
  @RequirePermissions('technician.read')
  getTechnicianUtilization(@Param('technicianId') technicianId: string, @Query('sinceDays') sinceDays?: string) {
    return this.analytics.getTechnicianUtilization(technicianId, sinceDays ? Number(sinceDays) : undefined);
  }

  @Get('common-repairs')
  @RequirePermissions('labour.read')
  getMostCommonRepairs(@Query('branchId') branchId?: string) {
    return this.analytics.getMostCommonRepairs(branchId);
  }

  @Get('parts-consumed')
  @RequirePermissions('inventory.read')
  getPartsConsumed(@Query('branchId') branchId?: string) {
    return this.analytics.getPartsConsumed(branchId);
  }

  @Get('lubricants-consumed')
  @RequirePermissions('inventory.read')
  getLubricantsConsumed(@Query('branchId') branchId?: string) {
    return this.analytics.getLubricantsConsumed(branchId);
  }

  @Get('delayed-jobs')
  @RequirePermissions('jobcard.read')
  getDelayedJobs(@Query('branchId') branchId?: string) {
    return this.analytics.getDelayedJobs(branchId);
  }
}
