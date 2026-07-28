import { Module } from '@nestjs/common';
import { DEFAULT_LOST_SALES_CONFIG, LOST_SALES_CONFIG } from './lost-sales.config';
import { LostSalesController } from './lost-sales.controller';
import { LostSalesEngineService } from './lost-sales-engine.service';
import { LostSalesService } from './lost-sales.service';

@Module({
  controllers: [LostSalesController],
  providers: [
    LostSalesService,
    LostSalesEngineService,
    { provide: LOST_SALES_CONFIG, useValue: DEFAULT_LOST_SALES_CONFIG },
  ],
  exports: [LostSalesService, LostSalesEngineService],
})
export class LostSalesModule {}
