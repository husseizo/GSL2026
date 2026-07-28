import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { GarageInventoryController } from './garage-inventory.controller';
import { GarageInventoryService } from './garage-inventory.service';

@Module({
  imports: [InventoryModule],
  controllers: [GarageInventoryController],
  providers: [GarageInventoryService],
  exports: [GarageInventoryService],
})
export class GarageInventoryModule {}
