import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { DashboardDataService } from './dashboard-data';
import { generateDashboardHtml } from './report-generator';
import { CertificationDashboardDataService } from './certification-data';
import { generateCertificationDashboardHtml } from './certification-dashboard';

@Controller('ai/dashboard')
@UseGuards(PermissionsGuard)
export class DashboardController {
  constructor(
    private readonly dashboardData: DashboardDataService,
    private readonly certificationDashboardData: CertificationDashboardDataService,
  ) {}

  @Get('data')
  @RequirePermissions('ai.evaluations.read')
  async data() {
    return this.dashboardData.buildDashboardData();
  }

  @Get('html')
  @RequirePermissions('ai.evaluations.read')
  @Header('Content-Type', 'text/html')
  async html() {
    const data = await this.dashboardData.buildDashboardData();
    return generateDashboardHtml(data);
  }

  // AI Foundation Certification Sprint (spec §20) — the official
  // certification view, separate from the general AI Quality dashboard
  // above since it answers a narrower question (are the mandatory
  // Retrieval Quality Gates passing right now, reproducibly).
  @Get('certification/data')
  @RequirePermissions('ai.evaluations.read')
  async certificationData() {
    return this.certificationDashboardData.buildCertificationDashboardData();
  }

  @Get('certification/html')
  @RequirePermissions('ai.evaluations.read')
  @Header('Content-Type', 'text/html')
  async certificationHtml() {
    const data = await this.certificationDashboardData.buildCertificationDashboardData();
    return generateCertificationDashboardHtml(data);
  }
}
