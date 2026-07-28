import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataQualitySeverity, GarageJobLineType, InventoryMovementType, ItemType, MovementDirection } from '@prisma/client';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { ReservationsService } from '../inventory/reservations.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReservePartDto } from './dto/reserve-part.dto';

// The Phase 3 core architectural rule, enforced in code: garage operations
// never touch InventoryBalance directly. Every method here is a thin
// orchestration over Phase 2's ReservationsService/InventoryLedgerService —
// no new inventory-mutating logic exists in this file. See
// docs/architecture/garage-architecture.md §"Core architectural rule".
//
// "Return" reuses the existing ADJUSTMENT_IN movement type rather than
// introducing a new one — an unused part going back to the shelf from a job
// is exactly what ADJUSTMENT_IN already models (stock added back through a
// non-sale, non-purchase, non-transfer path). See decision-log-phase3.md.
@Injectable()
export class GarageInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: ReservationsService,
    private readonly ledger: InventoryLedgerService,
    private readonly dataQuality: DataQualityService,
  ) {}

  async reservePart(jobId: string, dto: ReservePartDto) {
    await this.getJobOrThrow(jobId);
    await this.checkDuplicateReservation(jobId, dto);

    const reservation = await this.reservations.reserve({
      itemType: dto.itemType,
      partId: dto.partId,
      lubricantProductId: dto.lubricantProductId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
      referenceType: 'GarageJob',
      referenceId: jobId,
    });

    const line = await this.prisma.garageJobLine.create({
      data: {
        jobId,
        lineType: dto.itemType === ItemType.LUBRICANT ? GarageJobLineType.LUBRICANT : GarageJobLineType.PART,
        description: dto.description,
        partId: dto.partId,
        lubricantProductId: dto.lubricantProductId,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice ?? 0,
        lineTotal: dto.quantity * (dto.unitPrice ?? 0),
        reservationId: reservation.id,
      },
    });

    await this.prisma.jobTimeline.create({
      data: {
        jobId,
        eventType: 'PART_RESERVED',
        description: `Reserved ${dto.quantity} x ${dto.description}`,
        metadata: { reservationId: reservation.id, jobLineId: line.id },
      },
    });

    return { reservation, line };
  }

  async issue(jobLineId: string) {
    const line = await this.getLineOrThrow(jobLineId);
    if (!line.reservationId) {
      throw new BadRequestException(`Job line ${jobLineId} has no linked reservation to issue`);
    }
    const reservation = await this.prisma.stockReservation.findUnique({ where: { id: line.reservationId } });
    if (!reservation) throw new NotFoundException(`Reservation ${line.reservationId} not found`);

    await this.reservations.consume(reservation.id, `Issued to job ${line.jobId}`);

    const movement = await this.ledger.postMovement({
      itemType: reservation.itemType,
      partId: reservation.partId ?? undefined,
      lubricantProductId: reservation.lubricantProductId ?? undefined,
      warehouseId: reservation.warehouseId,
      quantity: Number(reservation.quantity),
      direction: MovementDirection.OUT,
      movementType: InventoryMovementType.GARAGE_ISSUE,
      referenceType: 'GarageJobLine',
      referenceId: line.id,
      occurredAt: new Date(),
    });

    await this.prisma.jobTimeline.create({
      data: {
        jobId: line.jobId,
        eventType: 'PART_ISSUED',
        description: `Issued ${reservation.quantity} unit(s)`,
        metadata: { movementId: movement.id, jobLineId: line.id },
      },
    });

    return movement;
  }

  async returnUnused(jobLineId: string, quantity: number, reason?: string) {
    const line = await this.getLineOrThrow(jobLineId);
    if (!line.reservationId) {
      throw new BadRequestException(`Job line ${jobLineId} has no linked reservation — cannot determine item/warehouse for return`);
    }
    const reservation = await this.prisma.stockReservation.findUnique({ where: { id: line.reservationId } });
    if (!reservation) throw new NotFoundException(`Reservation ${line.reservationId} not found`);

    const movement = await this.ledger.postMovement({
      itemType: reservation.itemType,
      partId: reservation.partId ?? undefined,
      lubricantProductId: reservation.lubricantProductId ?? undefined,
      warehouseId: reservation.warehouseId,
      quantity,
      direction: MovementDirection.IN,
      movementType: InventoryMovementType.ADJUSTMENT_IN,
      referenceType: 'GarageJobLine',
      referenceId: line.id,
      occurredAt: new Date(),
      reason: reason ?? `Unused part returned from job ${line.jobId}`,
    });

    await this.prisma.jobTimeline.create({
      data: {
        jobId: line.jobId,
        eventType: 'PART_RETURNED',
        description: `Returned ${quantity} unit(s)`,
        metadata: { movementId: movement.id, jobLineId: line.id },
      },
    });

    return movement;
  }

  async releaseReservation(jobLineId: string, reason?: string) {
    const line = await this.getLineOrThrow(jobLineId);
    if (!line.reservationId) {
      throw new BadRequestException(`Job line ${jobLineId} has no linked reservation to release`);
    }
    await this.reservations.release(line.reservationId, reason);
    await this.prisma.jobTimeline.create({
      data: { jobId: line.jobId, eventType: 'RESERVATION_RELEASED', description: reason ?? 'Reservation released', metadata: { jobLineId: line.id } },
    });
  }

  private async getJobOrThrow(jobId: string) {
    const job = await this.prisma.garageJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Garage job ${jobId} not found`);
    return job;
  }

  private async getLineOrThrow(jobLineId: string) {
    const line = await this.prisma.garageJobLine.findUnique({ where: { id: jobLineId } });
    if (!line) throw new NotFoundException(`Job line ${jobLineId} not found`);
    return line;
  }

  // Data quality §20: "duplicate reservations" — flagged, not blocked, since
  // a job genuinely needing two units reserved separately (e.g. two
  // different invoices) is legitimate; a supervisor reviews the flag.
  private async checkDuplicateReservation(jobId: string, dto: ReservePartDto) {
    const existing = await this.prisma.stockReservation.findFirst({
      where: {
        referenceType: 'GarageJob',
        referenceId: jobId,
        partId: dto.partId ?? null,
        lubricantProductId: dto.lubricantProductId ?? null,
        warehouseId: dto.warehouseId,
        status: 'ACTIVE',
      },
    });
    if (existing) {
      await this.dataQuality.record({
        checkName: 'duplicate_reservation',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'StockReservation',
        entityId: existing.id,
        message: `Job ${jobId} already has an active reservation ${existing.id} for this item at warehouse ${dto.warehouseId}`,
        context: { jobId, partId: dto.partId, lubricantProductId: dto.lubricantProductId, warehouseId: dto.warehouseId },
      });
    }
  }
}
