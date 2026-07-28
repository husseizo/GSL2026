import { Module } from '@nestjs/common';
import { LubricantsController } from './lubricants.controller';
import { LubricantsService } from './lubricants.service';

@Module({
  controllers: [LubricantsController],
  providers: [LubricantsService],
  exports: [LubricantsService],
})
export class LubricantsModule {}
