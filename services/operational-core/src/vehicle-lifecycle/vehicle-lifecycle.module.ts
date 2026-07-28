import { Module } from '@nestjs/common';
import { VehicleDigitalTwinService } from './digital-twin.service';
import { RepeatRepairService } from './repeat-repair.service';
import { VehicleLifecycleController, RepeatRepairController, RepeatRepairFlagsController } from './vehicle-lifecycle.controller';
import { VehicleTimelineService } from './vehicle-timeline.service';

@Module({
  controllers: [VehicleLifecycleController, RepeatRepairController, RepeatRepairFlagsController],
  providers: [VehicleDigitalTwinService, VehicleTimelineService, RepeatRepairService],
  exports: [VehicleDigitalTwinService, VehicleTimelineService, RepeatRepairService],
})
export class VehicleLifecycleModule {}
