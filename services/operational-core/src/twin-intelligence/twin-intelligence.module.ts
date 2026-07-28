import { Module } from '@nestjs/common';
import { VehicleLifecycleModule } from '../vehicle-lifecycle/vehicle-lifecycle.module';
import { TwinIntelligenceController } from './twin-intelligence.controller';

@Module({
  imports: [VehicleLifecycleModule],
  controllers: [TwinIntelligenceController],
})
export class TwinIntelligenceModule {}
