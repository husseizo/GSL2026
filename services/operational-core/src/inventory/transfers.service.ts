import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, MovementDirection, StockTransferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

// A transfer is never posted to the ledger automatically — creating one only
// records intent (DRAFT). Stock actually leaves the source warehouse on
// approve() (TRANSFER_OUT) and lands at the destination on receive()
// (TRANSFER_IN), so a transfer that's approved but not yet received doesn't
// silently double-count stock at both ends.
@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  create(dto: CreateStockTransferDto) {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new BadRequestException('Source and destination warehouse must differ');
    }
    return this.prisma.stockTransfer.create({
      data: {
        transferNumber: dto.transferNumber,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        reason: dto.reason,
        lines: { create: dto.lines },
      },
      include: { lines: true },
    });
  }

  list(filter: { status?: StockTransferStatus }) {
    return this.prisma.stockTransfer.findMany({ where: filter, include: { lines: true }, orderBy: { requestedAt: 'desc' } });
  }

  async findById(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({ where: { id }, include: { lines: true } });
    if (!transfer) throw new NotFoundException(`Stock transfer ${id} not found`);
    return transfer;
  }

  approve(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { lines: true } });
      if (!transfer) throw new NotFoundException(`Stock transfer ${id} not found`);
      if (transfer.status !== StockTransferStatus.DRAFT) {
        throw new BadRequestException(`Transfer ${id} must be DRAFT to approve (currently ${transfer.status})`);
      }

      for (const line of transfer.lines) {
        await this.ledger.postMovement(
          {
            itemType: line.itemType,
            partId: line.partId ?? undefined,
            lubricantProductId: line.lubricantProductId ?? undefined,
            warehouseId: transfer.sourceWarehouseId,
            quantity: Number(line.quantity),
            direction: MovementDirection.OUT,
            movementType: InventoryMovementType.TRANSFER_OUT,
            referenceType: 'StockTransfer',
            referenceId: transfer.id,
            occurredAt: new Date(),
            reason: transfer.reason ?? undefined,
          },
          tx,
        );
      }

      return tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.IN_TRANSIT, approvedAt: new Date() },
        include: { lines: true },
      });
    });
  }

  receive(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({ where: { id }, include: { lines: true } });
      if (!transfer) throw new NotFoundException(`Stock transfer ${id} not found`);
      if (transfer.status !== StockTransferStatus.IN_TRANSIT) {
        throw new BadRequestException(`Transfer ${id} must be IN_TRANSIT to receive (currently ${transfer.status})`);
      }

      for (const line of transfer.lines) {
        await this.ledger.postMovement(
          {
            itemType: line.itemType,
            partId: line.partId ?? undefined,
            lubricantProductId: line.lubricantProductId ?? undefined,
            warehouseId: transfer.destinationWarehouseId,
            quantity: Number(line.quantity),
            direction: MovementDirection.IN,
            movementType: InventoryMovementType.TRANSFER_IN,
            referenceType: 'StockTransfer',
            referenceId: transfer.id,
            occurredAt: new Date(),
            reason: transfer.reason ?? undefined,
          },
          tx,
        );
      }

      return tx.stockTransfer.update({
        where: { id },
        data: { status: StockTransferStatus.RECEIVED, receivedAt: new Date() },
        include: { lines: true },
      });
    });
  }

  cancel(id: string) {
    return this.prisma.stockTransfer.update({ where: { id }, data: { status: StockTransferStatus.CANCELLED } });
  }
}
