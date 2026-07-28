import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, ItemType, MovementDirection, PurchaseDocumentStatus } from '@prisma/client';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecordGoodsReceiptDto } from './dto/record-goods-receipt.dto';

// Stock only actually arrives in the ledger here — importing a PurchaseDocument
// (see handlers/purchase-document-sync.handler.ts) never posts inventory
// movements on its own, matching the real-world PO vs GRN distinction. See
// docs/architecture/phase-2-commercial-foundation.md §2.5.
@Injectable()
export class GoodsReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  recordReceipt(purchaseDocumentId: string, dto: RecordGoodsReceiptDto) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.purchaseDocument.findUnique({ where: { id: purchaseDocumentId }, include: { lines: true } });
      if (!document) throw new NotFoundException(`Purchase document ${purchaseDocumentId} not found`);

      const receipt = await tx.goodsReceipt.create({
        data: {
          purchaseDocumentId,
          receiptNumber: dto.receiptNumber,
          warehouseId: dto.warehouseId,
          receivedAt: new Date(),
        },
      });

      for (const line of dto.lines) {
        const poLine = line.purchaseDocumentLineId
          ? document.lines.find((l) => l.id === line.purchaseDocumentLineId)
          : undefined;
        if (line.purchaseDocumentLineId && !poLine) {
          throw new BadRequestException(`Purchase document line ${line.purchaseDocumentLineId} not found on this PO`);
        }

        const itemType: ItemType =
          poLine?.itemType ?? (line.partId ? ItemType.PART : line.lubricantProductId ? ItemType.LUBRICANT : ItemType.UNKNOWN);
        const partId = poLine?.partId ?? line.partId;
        const lubricantProductId = poLine?.lubricantProductId ?? line.lubricantProductId;

        await tx.goodsReceiptLine.create({
          data: {
            goodsReceiptId: receipt.id,
            purchaseDocumentLineId: line.purchaseDocumentLineId,
            partId,
            lubricantProductId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            batchNumber: line.batchNumber,
          },
        });

        await this.ledger.postMovement(
          {
            itemType,
            partId,
            lubricantProductId,
            warehouseId: dto.warehouseId,
            quantity: line.quantity,
            direction: MovementDirection.IN,
            movementType: InventoryMovementType.PURCHASE_RECEIPT,
            referenceType: 'GoodsReceipt',
            referenceId: receipt.id,
            occurredAt: new Date(),
            unitCost: line.unitCost,
            batchNumber: line.batchNumber,
          },
          tx,
        );

        if (poLine) {
          await tx.purchaseDocumentLine.update({
            where: { id: poLine.id },
            data: { receivedQuantity: { increment: line.quantity }, actualReceiptDate: new Date() },
          });
        }
      }

      const refreshedLines = await tx.purchaseDocumentLine.findMany({ where: { purchaseDocumentId } });
      const fullyReceived = refreshedLines.every((l) => Number(l.receivedQuantity) >= Number(l.orderedQuantity));
      const anyReceived = refreshedLines.some((l) => Number(l.receivedQuantity) > 0);
      await tx.purchaseDocument.update({
        where: { id: purchaseDocumentId },
        data: {
          status: fullyReceived
            ? PurchaseDocumentStatus.RECEIVED
            : anyReceived
              ? PurchaseDocumentStatus.PARTIALLY_RECEIVED
              : document.status,
        },
      });

      return tx.goodsReceipt.findUnique({ where: { id: receipt.id }, include: { lines: true } });
    });
  }
}
