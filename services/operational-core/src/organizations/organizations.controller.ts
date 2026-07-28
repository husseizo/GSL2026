import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @RequirePermissions('organization.manage')
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizations.create(dto);
  }

  @Get()
  @RequirePermissions('organization.read')
  list() {
    return this.organizations.list();
  }

  @Get(':id')
  @RequirePermissions('organization.read')
  findById(@Param('id') id: string) {
    return this.organizations.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizations.update(id, dto);
  }

  @Patch(':id/activate')
  @RequirePermissions('organization.manage')
  activate(@Param('id') id: string) {
    return this.organizations.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('organization.manage')
  deactivate(@Param('id') id: string) {
    return this.organizations.setActive(id, false);
  }
}
