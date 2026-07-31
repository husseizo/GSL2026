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
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { CorrectVehicleAttributeDto } from './dto/correct-vehicle-attribute.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehiclesService } from './vehicles.service';

// Platform Remediation PEP-3 (WP-3.3, see
// docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
// §4, PRTS-003): migrated from RolesGuard/@Roles (direct x-user-role
// header read, never consulting a verified actor) to
// PermissionsGuard/@RequirePermissions. Each permission below is an exact
// match to that endpoint's pre-migration @Roles(...) list — no role
// gains or loses access. The three GET endpoints below remain
// undecorated (open today) — tightening them is an explicit, separate,
// out-of-scope future decision (Technical Specification §5).
@Controller('vehicles')
@UseGuards(PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  @RequirePermissions('vehicle.create')
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
  @RequirePermissions('vehicle.correct')
  correctAttribute(@Param('id') id: string, @Body() dto: CorrectVehicleAttributeDto) {
    return this.vehicles.correctAttribute(id, dto);
  }
}
