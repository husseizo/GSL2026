import { Global, Module } from '@nestjs/common';
import { DataQualityService } from './data-quality.service';

@Global()
@Module({
  providers: [DataQualityService],
  exports: [DataQualityService],
})
export class DataQualityModule {}
