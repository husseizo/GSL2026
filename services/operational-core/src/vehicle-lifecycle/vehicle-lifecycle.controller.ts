import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RepeatRepairStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { VehicleDigitalTwinService } from './digital-twin.service';
import { RepeatRepairService } from './repeat-repair.service';
import { VehicleTimelineService } from './vehicle-timeline.service';

@Controller('vehicles/:vehicleId')
@UseGuards(PermissionsGuard)
export class VehicleLifecycleController {
  constructor(
    private readonly digitalTwin: VehicleDigitalTwinService,
    private readonly timeline: VehicleTimelineService,
    private readonly repeatRepair: RepeatRepairService,
  ) {}

  @Get('digital-twin')
  @RequirePermissions('timeline.read')
  getDigitalTwin(@Param('vehicleId') vehicleId: string) {
    return this.digitalTwin.getDigitalTwin(vehicleId);
  }

  @Get('timeline')
  @RequirePermissions('timeline.read')
  getTimeline(@Param('vehicleId') vehicleId: string) {
    return this.timeline.getTimeline(vehicleId);
  }

  @Get('repeat-repair-flags')
  @RequirePermissions('jobcard.read')
  listRepeatRepairFlags(@Param('vehicleId') vehicleId: string) {
    return this.repeatRepair.listForVehicle(vehicleId);
  }
}

@Controller('garage-jobs/:jobId/repeat-repair')
@UseGuards(PermissionsGuard)
export class RepeatRepairController {
  constructor(private readonly repeatRepair: RepeatRepairService) {}

  @Post('detect')
  @RequirePermissions('jobcard.manage')
  detect(@Param('jobId') jobId: string) {
    return this.repeatRepair.detectForJob(jobId);
  }
}

@Controller('repeat-repair-flags')
@UseGuards(PermissionsGuard)
export class RepeatRepairFlagsController {
  constructor(private readonly repeatRepair: RepeatRepairService) {}

  @Patch(':id/resolve')
  @RequirePermissions('jobcard.manage')
  resolve(@Param('id') id: string, @Body() body: { status: RepeatRepairStatus; resolvedById?: string; note?: string }) {
    return this.repeatRepair.resolve(id, body.status, body.resolvedById, body.note);
  }
}
