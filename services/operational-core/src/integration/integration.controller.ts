import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Roles } from '../common/rbac/roles.decorator';
import { RolesGuard } from '../common/rbac/roles.guard';
import { FileDropAdapter } from './adapters/file-drop.adapter';
import { ResolveDeadLetterDto } from './dto/resolve-dead-letter.dto';
import { LegacyPartRaw, PartSyncHandler } from './handlers/part-sync.handler';
import { LegacyVehicleRaw, VehicleSyncHandler } from './handlers/vehicle-sync.handler';
import { IntegrationService } from './integration.service';

// Phase 1 only wires FileDropAdapter (a mock CDC/export source) — see
// docs/architecture/02-integration-contracts.md §5/§6 for why, and what a
// real adapter swap would look like.
@Controller('integration')
@UseGuards(RolesGuard)
export class IntegrationController {
  constructor(
    private readonly integration: IntegrationService,
    private readonly vehicleHandler: VehicleSyncHandler,
    private readonly partHandler: PartSyncHandler,
    private readonly config: ConfigService,
  ) {}

  @Post('sync/vehicles')
  @Roles(Role.SYSTEM_ADMINISTRATOR)
  syncVehicles() {
    const dir = this.config.get<string>('VEHICLE_SYNC_DIR', './sample-data/legacy-vehicles');
    const adapter = new FileDropAdapter<LegacyVehicleRaw>('LEGACY_POS', 'VEHICLE', dir);
    return this.integration.runSync(adapter, this.vehicleHandler);
  }

  @Post('sync/parts')
  @Roles(Role.SYSTEM_ADMINISTRATOR)
  syncParts() {
    const dir = this.config.get<string>('PART_SYNC_DIR', './sample-data/legacy-parts');
    const adapter = new FileDropAdapter<LegacyPartRaw>('LEGACY_ERP', 'PART', dir);
    return this.integration.runSync(adapter, this.partHandler);
  }

  @Get('dead-letters')
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.DATA_QUALITY_REVIEWER)
  listDeadLetters(@Query('entityType') entityType?: 'VEHICLE' | 'PART') {
    return this.integration.listDeadLetters(entityType);
  }

  @Patch('dead-letters/:id/resolve')
  @Roles(Role.SYSTEM_ADMINISTRATOR, Role.DATA_QUALITY_REVIEWER)
  resolveDeadLetter(@Param('id') id: string, @Body() dto: ResolveDeadLetterDto) {
    return this.integration.resolveDeadLetter(id, dto.resolvedById, dto.resolution);
  }
}
