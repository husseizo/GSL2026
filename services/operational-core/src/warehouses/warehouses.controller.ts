import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@Controller('warehouses')
@UseGuards(PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Post()
  @RequirePermissions('warehouse.manage')
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
  }

  @Get()
  @RequirePermissions('warehouse.read')
  list(@Query('branchId') branchId?: string) {
    return this.warehouses.list({ branchId });
  }

  @Get(':id')
  @RequirePermissions('warehouse.read')
  findById(@Param('id') id: string) {
    return this.warehouses.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('warehouse.manage')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  @Patch(':id/activate')
  @RequirePermissions('warehouse.manage')
  activate(@Param('id') id: string) {
    return this.warehouses.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @RequirePermissions('warehouse.manage')
  deactivate(@Param('id') id: string) {
    return this.warehouses.setActive(id, false);
  }
}
