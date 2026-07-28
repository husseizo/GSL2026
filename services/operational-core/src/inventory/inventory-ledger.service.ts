import { Injectable, BadRequestException } from '@nestjs/common';
import { DataQualitySeverity, InventoryBalance, InventoryMovementType, ItemType, MovementDirection, Prisma } from '@prisma/client';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { PaginationQueryDto, paginate, toSkipTake } from '../common/pagination/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { computeAvailable, computeBalanceDelta, expectedDirection } from './balance-effects';
import { computeItemKey } from './item-key';

export interface ItemKey {
  itemType: ItemType;
  partId?: string;
  lubricantProductId?: string;
}

export interface PostMovementInput extends ItemKey {
  warehouseId: string;
  quantity: number;
  direction: MovementDirection;
  movementType: InventoryMovementType;
  referenceType?: string;
  referenceId?: string;
  sourceSystem?: string;
  sourceRecordId?: string;
  occurredAt: Date;
  unitCost?: number;
  batchNumber?: string;
  reason?: string;
  createdByActor?: string;
  correlationId?: string;
}

// The single choke point for every inventory-affecting event in the system —
// sales issue, purchase receipt, transfer, adjustment, damage, reservation.
// Nothing else writes to InventoryBalance directly. See
// docs/architecture/inventory-ledger.md.
@Injectable()
export class InventoryLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
  ) {}

  // Accepts an optional caller-owned transaction client so services that
  // already run inside a $transaction (reservations, transfers) don't nest a
  // second transaction on the base client — nesting two independent
  // transactions on overlapping rows risks a Postgres lock-wait deadlock.
  async postMovement(input: PostMovementInput, existingTx?: Prisma.TransactionClient) {
    if (input.quantity <= 0) {
      throw new BadRequestException(`Movement quantity must be positive, got ${input.quantity}`);
    }
    const fixed = expectedDirection(input.movementType);
    if (fixed && fixed !== input.direction) {
      throw new BadRequestException(
        `Movement type ${input.movementType} must have direction ${fixed}, got ${input.direction}`,
      );
    }

    // Idempotency: replaying the same imported movement is a no-op, exactly
    // like Phase 1's integration engine.
    if (input.sourceSystem && input.sourceRecordId) {
      const existing = await (existingTx ?? this.prisma).inventoryMovement.findUnique({
        where: { sourceSystem_sourceRecordId: { sourceSystem: input.sourceSystem, sourceRecordId: input.sourceRecordId } },
      });
      if (existing) return existing;
    }

    const run = async (tx: Prisma.TransactionClient) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          itemType: input.itemType,
          partId: input.partId,
          lubricantProductId: input.lubricantProductId,
          warehouseId: input.warehouseId,
          quantity: input.quantity,
          direction: input.direction,
          movementType: input.movementType,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          sourceSystem: input.sourceSystem,
          sourceRecordId: input.sourceRecordId,
          occurredAt: input.occurredAt,
          unitCost: input.unitCost,
          batchNumber: input.batchNumber,
          reason: input.reason,
          createdByActor: input.createdByActor,
          correlationId: input.correlationId,
        },
      });

      const balance = await this.getOrCreateBalance(tx, input);
      const delta = computeBalanceDelta(input.movementType, input.direction, input.quantity);
      const newOnHand = toNumber(balance.onHand) + delta.onHand;

      const hasNegativeStockIssue = newOnHand < 0;
      if (hasNegativeStockIssue) {
        await this.dataQuality.record({
          checkName: 'negative_available_stock',
          severity: DataQualitySeverity.RECOVERABLE,
          entityType: 'InventoryBalance',
          entityId: balance.id,
          message: `Movement ${movement.id} (${input.movementType}) would drive onHand negative (${newOnHand}) for warehouse ${input.warehouseId}`,
          context: { movementId: movement.id, resultingOnHand: newOnHand },
        });
      }

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          onHand: newOnHand,
          reserved: toNumber(balance.reserved) + delta.reserved,
          damaged: toNumber(balance.damaged) + delta.damaged,
          quarantined: toNumber(balance.quarantined) + delta.quarantined,
          hasNegativeStockIssue: hasNegativeStockIssue || balance.hasNegativeStockIssue,
          lastMovementAt: input.occurredAt,
        },
      });

      return movement;
    };

    return existingTx ? run(existingTx) : this.prisma.$transaction(run);
  }

  private async getOrCreateBalance(tx: Prisma.TransactionClient, key: ItemKey & { warehouseId: string }) {
    const itemKey = computeItemKey(key.partId, key.lubricantProductId);
    const existing = await tx.inventoryBalance.findUnique({
      where: { itemKey_warehouseId: { itemKey, warehouseId: key.warehouseId } },
    });
    if (existing) return existing;
    return tx.inventoryBalance.create({
      data: {
        itemType: key.itemType,
        partId: key.partId,
        lubricantProductId: key.lubricantProductId,
        itemKey,
        warehouseId: key.warehouseId,
      },
    });
  }

  async getBalance(key: ItemKey, warehouseId: string) {
    const itemKey = computeItemKey(key.partId, key.lubricantProductId);
    const balance = await this.prisma.inventoryBalance.findUnique({
      where: { itemKey_warehouseId: { itemKey, warehouseId } },
    });
    if (!balance) {
      return {
        itemType: key.itemType,
        partId: key.partId ?? null,
        lubricantProductId: key.lubricantProductId ?? null,
        warehouseId,
        onHand: 0,
        reserved: 0,
        incoming: 0,
        inTransit: 0,
        damaged: 0,
        quarantined: 0,
        available: 0,
        hasNegativeStockIssue: false,
      };
    }
    return toPlainBalance(balance);
  }

  async getBalancesAcrossWarehouses(key: ItemKey) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { itemType: key.itemType, partId: key.partId, lubricantProductId: key.lubricantProductId },
      include: { warehouse: true },
    });
    return balances.map((balance) => ({ ...toPlainBalance(balance), warehouse: balance.warehouse }));
  }

  async listMovements(
    filter: ItemKey & { warehouseId?: string },
    query: PaginationQueryDto,
  ) {
    const where: Prisma.InventoryMovementWhereInput = {
      itemType: filter.itemType,
      partId: filter.partId,
      lubricantProductId: filter.lubricantProductId,
      warehouseId: filter.warehouseId,
      occurredAt:
        query.dateFrom || query.dateTo
          ? { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined }
          : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({ where, ...toSkipTake(query), orderBy: { occurredAt: 'desc' } }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return paginate(data, total, query);
  }
}

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function toBalanceNumbers(balance: {
  onHand: Prisma.Decimal | number;
  reserved: Prisma.Decimal | number;
  damaged: Prisma.Decimal | number;
  quarantined: Prisma.Decimal | number;
}) {
  return {
    onHand: toNumber(balance.onHand),
    reserved: toNumber(balance.reserved),
    damaged: toNumber(balance.damaged),
    quarantined: toNumber(balance.quarantined),
  };
}

// Every Decimal column converted to a plain number — callers (API responses,
// the recommendation engines) must never receive a mix of numbers and
// Decimal-as-string fields, which is exactly the bug this fixes: `available`
// used to be a real number while its sibling fields silently weren't.
function toPlainBalance(balance: InventoryBalance) {
  const numbers = toBalanceNumbers(balance);
  return {
    ...balance,
    onHand: numbers.onHand,
    reserved: numbers.reserved,
    incoming: toNumber(balance.incoming),
    inTransit: toNumber(balance.inTransit),
    damaged: numbers.damaged,
    quarantined: numbers.quarantined,
    available: computeAvailable(numbers),
  };
}
