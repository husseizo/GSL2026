import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { VehicleDigitalTwinService } from '../vehicle-lifecycle/digital-twin.service';

// Thin slices of the same Digital Twin the vehicle-lifecycle module already
// computes — no separate aggregation, no separate scoring path. See
// docs/architecture/digital-twin-intelligence.md.
@Controller('ai')
@UseGuards(PermissionsGuard)
export class TwinIntelligenceController {
  constructor(private readonly digitalTwin: VehicleDigitalTwinService) {}

  @Get('vehicle-health/:vehicleId')
  @RequirePermissions('ai.vehicleHealth')
  async vehicleHealth(@Param('vehicleId') vehicleId: string) {
    const twin = await this.digitalTwin.getDigitalTwin(vehicleId);
    return {
      vehicleId: twin.vehicleId,
      healthScore: twin.healthScore,
      maintenanceRiskScore: twin.maintenanceRiskScore,
      systemRisks: twin.systemRisks,
      serviceComplianceScore: twin.serviceComplianceScore,
      warrantyRiskScore: twin.warrantyRiskScore,
      confidence: twin.aiConfidenceScore,
      generatedAt: twin.generatedAt,
    };
  }

  @Get('predict-maintenance/:vehicleId')
  @RequirePermissions('ai.vehicleHealth')
  async predictMaintenance(@Param('vehicleId') vehicleId: string) {
    const twin = await this.digitalTwin.getDigitalTwin(vehicleId);
    return {
      vehicleId: twin.vehicleId,
      predictedMaintenance: twin.predictedMaintenance,
      predictedFutureParts: twin.predictedFutureParts,
      predictedLubricantNeeds: twin.predictedLubricantNeeds,
      confidence: twin.aiConfidenceScore,
      generatedAt: twin.generatedAt,
    };
  }
}
