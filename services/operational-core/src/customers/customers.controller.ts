import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import type { Request } from 'express';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { getRequestActor } from '../common/permissions/request-actor';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { LinkVehicleDto } from './dto/link-vehicle.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@UseGuards(PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @RequirePermissions('customer.manage')
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Get()
  @RequirePermissions('customer.read')
  search(@Query() query: PaginationQueryDto, @Query('customerType') customerType?: CustomerType) {
    return this.customers.search({ ...query, customerType });
  }

  @Get(':id')
  @RequirePermissions('customer.read')
  getProfile(@Param('id') id: string) {
    return this.customers.getProfile(id);
  }

  @Patch(':id')
  @RequirePermissions('customer.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @Req() req: Request) {
    const actor = getRequestActor(req);
    return this.customers.update(id, dto, { userId: actor.userId, role: actor.role });
  }

  @Post(':id/vehicles')
  @RequirePermissions('customer.manage')
  linkVehicle(@Param('id') id: string, @Body() dto: LinkVehicleDto) {
    return this.customers.linkVehicle(id, dto);
  }

  @Get(':id/sales-history')
  @RequirePermissions('customer.read')
  listSalesHistory(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.customers.listSalesHistory(id, query);
  }
}
