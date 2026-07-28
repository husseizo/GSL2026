import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementDirection, InventoryMovementType, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

// Reserving stock increases the `reserved` bucket without touching `onHand` —
// it narrows `available` (onHand - reserved - quarantined - damaged) so the
// same unit can't be promised to two customers. See
// docs/architecture/inventory-ledger.md.
@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  reserve(dto: CreateReservationDto) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.create({
        data: {
          itemType: dto.itemType,
          partId: dto.partId,
          lubricantProductId: dto.lubricantProductId,
          warehouseId: dto.warehouseId,
          quantity: dto.quantity,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        },
      });

      await this.ledger.postMovement(
        {
          itemType: dto.itemType,
          partId: dto.partId,
          lubricantProductId: dto.lubricantProductId,
          warehouseId: dto.warehouseId,
          quantity: dto.quantity,
          direction: MovementDirection.IN,
          movementType: InventoryMovementType.RESERVATION,
          referenceType: 'StockReservation',
          referenceId: reservation.id,
          occurredAt: new Date(),
        },
        tx,
      );

      return reservation;
    });
  }

  list(filter: { warehouseId?: string; status?: ReservationStatus }) {
    return this.prisma.stockReservation.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
    });
  }

  release(id: string, reason?: string) {
    return this.transitionReservation(id, ReservationStatus.RELEASED, reason);
  }

  consume(id: string, reason?: string) {
    return this.transitionReservation(id, ReservationStatus.CONSUMED, reason);
  }

  private transitionReservation(id: string, status: ReservationStatus, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findUnique({ where: { id } });
      if (!reservation) throw new NotFoundException(`Reservation ${id} not found`);
      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException(`Reservation ${id} is not ACTIVE (currently ${reservation.status})`);
      }

      const updated = await tx.stockReservation.update({
        where: { id },
        data: { status, releasedAt: new Date() },
      });

      await this.ledger.postMovement(
        {
          itemType: reservation.itemType,
          partId: reservation.partId ?? undefined,
          lubricantProductId: reservation.lubricantProductId ?? undefined,
          warehouseId: reservation.warehouseId,
          quantity: Number(reservation.quantity),
          direction: MovementDirection.OUT,
          movementType: InventoryMovementType.RESERVATION_RELEASE,
          referenceType: 'StockReservation',
          referenceId: id,
          occurredAt: new Date(),
          reason,
        },
        tx,
      );

      return updated;
    });
  }
}
