import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdjustmentDirection, InventoryMovementType, MovementDirection } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { InventoryLedgerService } from './inventory-ledger.service';

// Two-step: create() only records the request (no ledger effect yet);
// approve() is what actually posts the movement. This mirrors the spec's
// approval-before-execution principle for stock adjustments the same way it
// applies to purchase recommendations — see docs/architecture/phase-2-commercial-foundation.md §12.
@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly audit: AuditService,
  ) {}

  create(dto: CreateAdjustmentDto) {
    return this.prisma.inventoryAdjustment.create({ data: dto });
  }

  list(filter: { warehouseId?: string }) {
    return this.prisma.inventoryAdjustment.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
  }

  approve(id: string, approvedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.inventoryAdjustment.findUnique({ where: { id } });
      if (!adjustment) throw new NotFoundException(`Adjustment ${id} not found`);
      if (adjustment.movementId) {
        throw new BadRequestException(`Adjustment ${id} was already approved`);
      }

      const movement = await this.ledger.postMovement(
        {
          itemType: adjustment.itemType,
          partId: adjustment.partId ?? undefined,
          lubricantProductId: adjustment.lubricantProductId ?? undefined,
          warehouseId: adjustment.warehouseId,
          quantity: Number(adjustment.quantity),
          direction: adjustment.direction === AdjustmentDirection.IN ? MovementDirection.IN : MovementDirection.OUT,
          movementType:
            adjustment.direction === AdjustmentDirection.IN
              ? InventoryMovementType.ADJUSTMENT_IN
              : InventoryMovementType.ADJUSTMENT_OUT,
          referenceType: 'InventoryAdjustment',
          referenceId: adjustment.id,
          occurredAt: new Date(),
          reason: adjustment.reason,
        },
        tx,
      );

      const updated = await tx.inventoryAdjustment.update({
        where: { id },
        data: { approvedById, movementId: movement.id },
      });

      await this.audit.log({
        action: 'INVENTORY_ADJUSTMENT_APPROVED',
        actorId: approvedById,
        entityType: 'InventoryAdjustment',
        entityId: id,
        beforeState: adjustment,
        afterState: updated,
      });

      return updated;
    });
  }
}
