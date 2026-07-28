import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ItemType, ReservationStatus, StockTransferStatus } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination/pagination.dto';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { AdjustmentsService } from './adjustments.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ReservationsService } from './reservations.service';
import { TransfersService } from './transfers.service';

@Controller('inventory')
@UseGuards(PermissionsGuard)
export class InventoryController {
  constructor(
    private readonly ledger: InventoryLedgerService,
    private readonly reservations: ReservationsService,
    private readonly transfers: TransfersService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  @Get('balance')
  @RequirePermissions('inventory.read')
  getBalance(
    @Query('itemType') itemType: ItemType,
    @Query('warehouseId') warehouseId: string,
    @Query('partId') partId?: string,
    @Query('lubricantProductId') lubricantProductId?: string,
  ) {
    return this.ledger.getBalance({ itemType, partId, lubricantProductId }, warehouseId);
  }

  @Get('balance/across-warehouses')
  @RequirePermissions('inventory.read')
  getBalancesAcrossWarehouses(
    @Query('itemType') itemType: ItemType,
    @Query('partId') partId?: string,
    @Query('lubricantProductId') lubricantProductId?: string,
  ) {
    return this.ledger.getBalancesAcrossWarehouses({ itemType, partId, lubricantProductId });
  }

  @Get('movements')
  @RequirePermissions('inventory.read')
  listMovements(
    @Query() query: PaginationQueryDto,
    @Query('itemType') itemType?: ItemType,
    @Query('partId') partId?: string,
    @Query('lubricantProductId') lubricantProductId?: string,
  ) {
    return this.ledger.listMovements(
      { itemType: itemType as ItemType, partId, lubricantProductId, warehouseId: query.warehouseId },
      query,
    );
  }

  @Post('reservations')
  @RequirePermissions('inventory.adjust')
  reserve(@Body() dto: CreateReservationDto) {
    return this.reservations.reserve(dto);
  }

  @Get('reservations')
  @RequirePermissions('inventory.read')
  listReservations(@Query('warehouseId') warehouseId?: string, @Query('status') status?: ReservationStatus) {
    return this.reservations.list({ warehouseId, status });
  }

  @Post('reservations/:id/release')
  @RequirePermissions('inventory.adjust')
  releaseReservation(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.reservations.release(id, reason);
  }

  @Post('reservations/:id/consume')
  @RequirePermissions('inventory.adjust')
  consumeReservation(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.reservations.consume(id, reason);
  }

  @Post('transfers')
  @RequirePermissions('inventory.adjust')
  createTransfer(@Body() dto: CreateStockTransferDto) {
    return this.transfers.create(dto);
  }

  @Get('transfers')
  @RequirePermissions('inventory.read')
  listTransfers(@Query('status') status?: StockTransferStatus) {
    return this.transfers.list({ status });
  }

  @Get('transfers/:id')
  @RequirePermissions('inventory.read')
  getTransfer(@Param('id') id: string) {
    return this.transfers.findById(id);
  }

  @Post('transfers/:id/approve')
  @RequirePermissions('inventory.adjust')
  approveTransfer(@Param('id') id: string) {
    return this.transfers.approve(id);
  }

  @Post('transfers/:id/receive')
  @RequirePermissions('inventory.adjust')
  receiveTransfer(@Param('id') id: string) {
    return this.transfers.receive(id);
  }

  @Post('transfers/:id/cancel')
  @RequirePermissions('inventory.adjust')
  cancelTransfer(@Param('id') id: string) {
    return this.transfers.cancel(id);
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  createAdjustment(@Body() dto: CreateAdjustmentDto) {
    return this.adjustments.create(dto);
  }

  @Get('adjustments')
  @RequirePermissions('inventory.read')
  listAdjustments(@Query('warehouseId') warehouseId?: string) {
    return this.adjustments.list({ warehouseId });
  }

  @Post('adjustments/:id/approve')
  @RequirePermissions('inventory.adjust')
  approveAdjustment(@Param('id') id: string, @Body('approvedById') approvedById: string) {
    return this.adjustments.approve(id, approvedById);
  }
}
