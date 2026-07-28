import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/rbac/roles.decorator';
import { RolesGuard } from '../common/rbac/roles.guard';
import { CorrectVehicleAttributeDto } from './dto/correct-vehicle-attribute.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(RolesGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.BRANCH_MANAGER, Role.PARTS_MANAGER)
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  @Get()
  list(@Query('brand') brand?: string, @Query('model') model?: string) {
    return this.vehicles.list({ brand, model });
  }

  @Get('vin/:vin')
  async findByVin(@Param('vin') vin: string) {
    const vehicle = await this.vehicles.findByVin(vin);
    if (!vehicle) {
      throw new NotFoundException(`No vehicle with VIN ${vin}`);
    }
    return vehicle;
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const vehicle = await this.vehicles.findById(id);
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    return vehicle;
  }

  // Corrections are their own endpoint (not PATCH-the-whole-record) so every
  // change is forced through the append-only history path.
  @Patch(':id/attribute-correction')
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.BRANCH_MANAGER, Role.PARTS_MANAGER)
  correctAttribute(@Param('id') id: string, @Body() dto: CorrectVehicleAttributeDto) {
    return this.vehicles.correctAttribute(id, dto);
  }
}
