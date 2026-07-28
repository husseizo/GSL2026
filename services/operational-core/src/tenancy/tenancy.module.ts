import { Module } from '@nestjs/common';
import { OrganizationConfigurationController } from './organization-configuration.controller';
import { OrganizationConfigurationService } from './organization-configuration.service';
import { TenantContextService } from './tenant-context.service';

@Module({
  controllers: [OrganizationConfigurationController],
  providers: [OrganizationConfigurationService, TenantContextService],
  exports: [OrganizationConfigurationService, TenantContextService],
})
export class TenancyModule {}
