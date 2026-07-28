import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { OrganizationConfigurationService, UpsertOrganizationConfigurationDto } from './organization-configuration.service';

@ApiTags('tenancy')
@Controller('organizations/:organizationId/configuration')
@UseGuards(PermissionsGuard)
export class OrganizationConfigurationController {
  constructor(private readonly config: OrganizationConfigurationService) {}

  @Get()
  @RequirePermissions('organization.read')
  get(@Param('organizationId') organizationId: string) {
    return this.config.getOrThrow(organizationId);
  }

  @Put()
  @RequirePermissions('organization.manage')
  upsert(@Param('organizationId') organizationId: string, @Body() dto: UpsertOrganizationConfigurationDto) {
    return this.config.upsert(organizationId, dto);
  }
}
