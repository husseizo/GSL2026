import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
@UseGuards(PermissionsGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Post()
  @RequirePermissions('organization.manage')
  create(@Body() dto: CreateBranchDto) {
    return this.branches.create(dto);
  }

  @Get()
  @RequirePermissions('organization.read')
  list(@Query('organizationId') organizationId?: string) {
    return this.branches.list({ organizationId });
  }

  @Get(':id')
  @RequirePermissions('organization.read')
  findById(@Param('id') id: string) {
    return this.branches.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('organization.manage')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branches.update(id, dto);
  }

  @Patch(':id/activate')
  @RequirePermissions('organization.manage')
  activate(@Param('id') id: string) {
    return this.branches.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('organization.manage')
  deactivate(@Param('id') id: string) {
    return this.branches.setActive(id, false);
  }
}
