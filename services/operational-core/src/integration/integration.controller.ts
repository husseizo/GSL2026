import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { FileDropAdapter } from './adapters/file-drop.adapter';
import { ResolveDeadLetterDto } from './dto/resolve-dead-letter.dto';
import { LegacyPartRaw, PartSyncHandler } from './handlers/part-sync.handler';
import { LegacyVehicleRaw, VehicleSyncHandler } from './handlers/vehicle-sync.handler';
import { IntegrationService } from './integration.service';

// Phase 1 only wires FileDropAdapter (a mock CDC/export source) — see
// docs/architecture/02-integration-contracts.md §5/§6 for why, and what a
// real adapter swap would look like.
//
// Platform Remediation PEP-3 (WP-3.1, see
// docs/governance/DGX3_PLATFORM_REMEDIATION_TECHNICAL_SPECIFICATION_1.md
// §4, PRTS-003): migrated from RolesGuard/@Roles (direct x-user-role
// header read, never consulting a verified actor) to
// PermissionsGuard/@RequirePermissions. Each permission below is an exact
// match to this endpoint's pre-migration @Roles(...) list — no role
// gains or loses access.
@Controller('integration')
@UseGuards(PermissionsGuard)
export class IntegrationController {
  constructor(
    private readonly integration: IntegrationService,
    private readonly vehicleHandler: VehicleSyncHandler,
    private readonly partHandler: PartSyncHandler,
    private readonly config: ConfigService,
  ) {}

  @Post('sync/vehicles')
  @RequirePermissions('integration.sync')
  syncVehicles() {
    const dir = this.config.get<string>('VEHICLE_SYNC_DIR', './sample-data/legacy-vehicles');
    const adapter = new FileDropAdapter<LegacyVehicleRaw>('LEGACY_POS', 'VEHICLE', dir);
    return this.integration.runSync(adapter, this.vehicleHandler);
  }

  @Post('sync/parts')
  @RequirePermissions('integration.sync')
  syncParts() {
    const dir = this.config.get<string>('PART_SYNC_DIR', './sample-data/legacy-parts');
    const adapter = new FileDropAdapter<LegacyPartRaw>('LEGACY_ERP', 'PART', dir);
    return this.integration.runSync(adapter, this.partHandler);
  }

  @Get('dead-letters')
  @RequirePermissions('integration.deadLetters.read')
  listDeadLetters(@Query('entityType') entityType?: 'VEHICLE' | 'PART') {
    return this.integration.listDeadLetters(entityType);
  }

  @Patch('dead-letters/:id/resolve')
  @RequirePermissions('integration.deadLetters.resolve')
  resolveDeadLetter(@Param('id') id: string, @Body() dto: ResolveDeadLetterDto) {
    return this.integration.resolveDeadLetter(id, dto.resolvedById, dto.resolution);
  }
}
