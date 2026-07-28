import { Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { PartSyncHandler } from '../handlers/part-sync.handler';
import { IntegrationService } from '../integration.service';
import { OdooAdapter } from './odoo.adapter';
import { SapBusinessOneAdapter } from './sap-business-one.adapter';

// Real adapters, configured entirely from environment variables — if
// SAP_B1_BASE_URL/ODOO_BASE_URL aren't set (true in this sandbox, since no
// real SAP B1/Odoo instance exists here), health() honestly reports
// unreachable rather than fabricating a live connection. See
// docs/architecture/integration-adapters.md.
@ApiTags('integration-adapters')
@Controller('integration/adapters')
@UseGuards(PermissionsGuard)
export class IntegrationAdaptersController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly partSyncHandler: PartSyncHandler,
  ) {}

  @Get('sap-business-one/health')
  @RequirePermissions('integration.manage')
  async sapHealth() {
    const adapter = this.getSapAdapter();
    return adapter.health();
  }

  @Get('sap-business-one/metadata')
  @RequirePermissions('integration.manage')
  async sapMetadata() {
    return this.getSapAdapter().getMetadata();
  }

  @Post('sap-business-one/sync')
  @RequirePermissions('integration.manage')
  async sapSync() {
    return this.integrationService.runSync(this.getSapAdapter(), this.partSyncHandler);
  }

  @Get('odoo/health')
  @RequirePermissions('integration.manage')
  async odooHealth() {
    return this.getOdooAdapter().health();
  }

  @Get('odoo/metadata')
  @RequirePermissions('integration.manage')
  async odooMetadata() {
    return this.getOdooAdapter().getMetadata();
  }

  @Post('odoo/sync')
  @RequirePermissions('integration.manage')
  async odooSync() {
    return this.integrationService.runSync(this.getOdooAdapter(), this.partSyncHandler);
  }

  private getSapAdapter(): SapBusinessOneAdapter {
    if (!process.env.SAP_B1_BASE_URL) {
      throw new NotFoundException('SAP Business One adapter is not configured — set SAP_B1_BASE_URL/SAP_B1_COMPANY_DB/SAP_B1_USERNAME/SAP_B1_PASSWORD');
    }
    return new SapBusinessOneAdapter({
      baseUrl: process.env.SAP_B1_BASE_URL,
      companyDb: process.env.SAP_B1_COMPANY_DB ?? '',
      username: process.env.SAP_B1_USERNAME ?? '',
      password: process.env.SAP_B1_PASSWORD ?? '',
    });
  }

  private getOdooAdapter(): OdooAdapter {
    if (!process.env.ODOO_BASE_URL) {
      throw new NotFoundException('Odoo adapter is not configured — set ODOO_BASE_URL/ODOO_DATABASE/ODOO_USERNAME/ODOO_PASSWORD');
    }
    return new OdooAdapter({
      baseUrl: process.env.ODOO_BASE_URL,
      database: process.env.ODOO_DATABASE ?? '',
      username: process.env.ODOO_USERNAME ?? '',
      password: process.env.ODOO_PASSWORD ?? '',
    });
  }
}
