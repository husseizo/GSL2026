import { Module } from '@nestjs/common';
import { AdjustmentsService } from './adjustments.service';
import { InventoryController } from './inventory.controller';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ReservationsService } from './reservations.service';
import { TransfersService } from './transfers.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryLedgerService, ReservationsService, TransfersService, AdjustmentsService],
  exports: [InventoryLedgerService, ReservationsService, TransfersService, AdjustmentsService],
})
export class InventoryModule {}
