import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
@UseGuards(PermissionsGuard)
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Post()
  @RequirePermissions('purchases.import')
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliers.create(dto);
  }

  @Get()
  @RequirePermissions('purchases.read')
  search(@Query() query: PaginationQueryDto) {
    return this.suppliers.search(query);
  }

  @Get(':id')
  @RequirePermissions('purchases.read')
  findById(@Param('id') id: string) {
    return this.suppliers.findById(id);
  }
}
