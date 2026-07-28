import { Module } from '@nestjs/common';
import { QualityControlModule } from '../quality-control/quality-control.module';
import { GarageJobsController } from './garage-jobs.controller';
import { GarageJobsService } from './garage-jobs.service';

@Module({
  imports: [QualityControlModule],
  controllers: [GarageJobsController],
  providers: [GarageJobsService],
  exports: [GarageJobsService],
})
export class GarageJobsModule {}
