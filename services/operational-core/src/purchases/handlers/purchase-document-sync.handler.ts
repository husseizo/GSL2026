import { Injectable } from '@nestjs/common';
import { DataQualitySeverity, ItemType, PurchaseDocumentStatus, PurchaseDocumentType } from '@prisma/client';
import { stableChecksum } from '../../integration/checksum';
import { EntitySyncHandler, ValidationResult } from '../../integration/entity-sync-handler.interface';
import { DataQualityService } from '../../common/data-quality/data-quality.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface LegacyPurchaseLineRaw {
  line_number: number;
  item_code: string;
  item_type?: 'PART' | 'LUBRICANT';
  ordered_quantity: number;
  unit_cost: number;
  currency?: string;
  tax_amount?: number;
  discount_amount?: number;
  expected_delivery_date?: string;
  supplier_item_code?: string;
}

export interface LegacyPurchaseDocumentRaw {
  document_number: string;
  external_document_number?: string;
  document_type: string;
  supplier_code?: string;
  branch_code?: string;
  warehouse_code?: string;
  document_date: string;
  expected_delivery_date?: string;
  currency?: string;
  lines: LegacyPurchaseLineRaw[];
}

interface NormalizedPurchaseLine {
  lineNumber: number;
  itemType: ItemType;
  partId?: string;
  lubricantProductId?: string;
  unresolvedItemCode?: string;
  orderedQuantity: number;
  unitCost: number;
  currency: string;
  taxAmount: number;
  discountAmount: number;
  expectedDeliveryDate?: string;
  supplierItemCode?: string;
  checksum: string;
}

export interface NormalizedPurchaseDocument {
  documentNumber: string;
  externalDocumentNumber?: string;
  documentType: PurchaseDocumentType;
  supplierId?: string;
  branchId?: string;
  warehouseId?: string;
  documentDate: string;
  expectedDeliveryDate?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: NormalizedPurchaseLine[];
}

// Resolves item/supplier/branch/warehouse codes to IDs — the reason this
// handler's normalize() is async (see entity-sync-handler.interface.ts).
// Unresolved references are preserved (unresolvedItemCode) rather than
// rejecting the document — see docs/architecture/phase-2-commercial-foundation.md §2.2.
@Injectable()
export class PurchaseDocumentSyncHandler
  implements EntitySyncHandler<LegacyPurchaseDocumentRaw, NormalizedPurchaseDocument>
{
  readonly entityType = 'PURCHASE_DOCUMENT' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
  ) {}

  validate(raw: LegacyPurchaseDocumentRaw): ValidationResult {
    if (!raw.document_number?.trim()) return { valid: false, error: 'document_number is required' };
    if (!raw.document_type?.trim()) return { valid: false, error: 'document_type is required' };
    if (!raw.document_date) return { valid: false, error: 'document_date is required' };
    if (!Array.isArray(raw.lines) || raw.lines.length === 0) return { valid: false, error: 'at least one line is required' };
    if (!(raw.document_type in PurchaseDocumentType)) {
      return { valid: false, error: `unknown document_type "${raw.document_type}"` };
    }
    return { valid: true };
  }

  async normalize(raw: LegacyPurchaseDocumentRaw): Promise<NormalizedPurchaseDocument> {
    const [supplier, branch, warehouse] = await Promise.all([
      raw.supplier_code ? this.prisma.supplier.findUnique({ where: { supplierCode: raw.supplier_code } }) : null,
      raw.branch_code ? this.prisma.branch.findFirst({ where: { code: raw.branch_code } }) : null,
      raw.warehouse_code ? this.prisma.warehouse.findFirst({ where: { code: raw.warehouse_code } }) : null,
    ]);

    if (raw.supplier_code && !supplier) {
      await this.dataQuality.record({
        checkName: 'unresolved_supplier_reference',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'PurchaseDocument',
        message: `Supplier code "${raw.supplier_code}" on PO ${raw.document_number} did not resolve to a known supplier`,
        context: { documentNumber: raw.document_number, supplierCode: raw.supplier_code },
      });
    }

    const lines = await Promise.all(raw.lines.map((line) => this.normalizeLine(raw.document_number, line)));
    const subtotal = lines.reduce((sum, l) => sum + l.orderedQuantity * l.unitCost - l.discountAmount, 0);
    const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);

    return {
      documentNumber: raw.document_number,
      externalDocumentNumber: raw.external_document_number,
      documentType: raw.document_type as PurchaseDocumentType,
      supplierId: supplier?.id,
      branchId: branch?.id,
      warehouseId: warehouse?.id,
      documentDate: raw.document_date,
      expectedDeliveryDate: raw.expected_delivery_date,
      currency: raw.currency ?? 'USD',
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal,
      lines,
    };
  }

  private async normalizeLine(documentNumber: string, line: LegacyPurchaseLineRaw): Promise<NormalizedPurchaseLine> {
    const findings = this.dataQuality.checkQuantityAndPrice({
      entityType: 'PurchaseDocumentLine',
      quantity: line.ordered_quantity,
      unitPrice: line.unit_cost,
    });
    await Promise.all(findings.map((f) => this.dataQuality.record(f)));

    const part = await this.prisma.part.findFirst({
      where: { OR: [{ internalItemCode: line.item_code }, { oemNumber: line.item_code }] },
    });
    const lubricant = part ? null : await this.prisma.lubricantProduct.findFirst({ where: { internalCode: line.item_code } });

    let itemType: ItemType = ItemType.UNKNOWN;
    if (part) itemType = ItemType.PART;
    else if (lubricant) itemType = ItemType.LUBRICANT;
    else if (line.item_type) itemType = line.item_type as ItemType;

    if (!part && !lubricant) {
      await this.dataQuality.record({
        checkName: 'missing_item_resolution',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'PurchaseDocumentLine',
        message: `Item code "${line.item_code}" on PO ${documentNumber} line ${line.line_number} did not resolve to a part or lubricant`,
        context: { documentNumber, lineNumber: line.line_number, itemCode: line.item_code },
      });
    }

    const normalizedLine = {
      lineNumber: line.line_number,
      itemType,
      partId: part?.id,
      lubricantProductId: lubricant?.id,
      unresolvedItemCode: !part && !lubricant ? line.item_code : undefined,
      orderedQuantity: line.ordered_quantity,
      unitCost: line.unit_cost,
      currency: line.currency ?? 'USD',
      taxAmount: line.tax_amount ?? 0,
      discountAmount: line.discount_amount ?? 0,
      expectedDeliveryDate: line.expected_delivery_date,
      supplierItemCode: line.supplier_item_code,
    };

    return { ...normalizedLine, checksum: stableChecksum(normalizedLine) };
  }

  checksum(normalized: NormalizedPurchaseDocument): string {
    return stableChecksum(normalized);
  }

  async getExistingChecksum(sourceSystem: string, sourceRecordId: string): Promise<string | null> {
    const existing = await this.prisma.purchaseDocument.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
    });
    return existing?.checksum ?? null;
  }

  async upsert(params: {
    sourceSystem: string;
    sourceRecordId: string;
    recordVersion?: string;
    checksum: string;
    normalized: NormalizedPurchaseDocument;
  }): Promise<void> {
    const { sourceSystem, sourceRecordId, recordVersion, checksum, normalized } = params;

    await this.prisma.$transaction(async (tx) => {
      const document = await tx.purchaseDocument.upsert({
        where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
        create: {
          documentNumber: normalized.documentNumber,
          externalDocumentNumber: normalized.externalDocumentNumber,
          documentType: normalized.documentType,
          status: PurchaseDocumentStatus.APPROVED,
          supplierId: normalized.supplierId,
          branchId: normalized.branchId,
          warehouseId: normalized.warehouseId,
          documentDate: new Date(normalized.documentDate),
          expectedDeliveryDate: normalized.expectedDeliveryDate ? new Date(normalized.expectedDeliveryDate) : undefined,
          currency: normalized.currency,
          subtotal: normalized.subtotal,
          taxTotal: normalized.taxTotal,
          grandTotal: normalized.grandTotal,
          sourceSystem,
          sourceRecordId,
          externalId: normalized.documentNumber,
          syncedAt: new Date(),
          recordVersion,
          checksum,
        },
        update: {
          status: PurchaseDocumentStatus.APPROVED,
          supplierId: normalized.supplierId,
          branchId: normalized.branchId,
          warehouseId: normalized.warehouseId,
          documentDate: new Date(normalized.documentDate),
          expectedDeliveryDate: normalized.expectedDeliveryDate ? new Date(normalized.expectedDeliveryDate) : undefined,
          currency: normalized.currency,
          subtotal: normalized.subtotal,
          taxTotal: normalized.taxTotal,
          grandTotal: normalized.grandTotal,
          syncedAt: new Date(),
          recordVersion,
          checksum,
        },
      });

      // Idempotency at line level: only rewrite a line whose own checksum
      // changed, not the whole set, so a "source update" that touched one
      // line doesn't need to rewrite every sibling line.
      for (const line of normalized.lines) {
        const existingLine = await tx.purchaseDocumentLine.findUnique({
          where: { purchaseDocumentId_lineNumber: { purchaseDocumentId: document.id, lineNumber: line.lineNumber } },
        });
        if (existingLine?.checksum === line.checksum) continue;

        await tx.purchaseDocumentLine.upsert({
          where: { purchaseDocumentId_lineNumber: { purchaseDocumentId: document.id, lineNumber: line.lineNumber } },
          create: {
            purchaseDocumentId: document.id,
            lineNumber: line.lineNumber,
            itemType: line.itemType,
            partId: line.partId,
            lubricantProductId: line.lubricantProductId,
            unresolvedItemCode: line.unresolvedItemCode,
            orderedQuantity: line.orderedQuantity,
            unitCost: line.unitCost,
            currency: line.currency,
            taxAmount: line.taxAmount,
            discountAmount: line.discountAmount,
            expectedDeliveryDate: line.expectedDeliveryDate ? new Date(line.expectedDeliveryDate) : undefined,
            supplierItemCode: line.supplierItemCode,
            sourceSystem,
            sourceRecordId: `${sourceRecordId}:${line.lineNumber}`,
            checksum: line.checksum,
          },
          update: {
            itemType: line.itemType,
            partId: line.partId,
            lubricantProductId: line.lubricantProductId,
            unresolvedItemCode: line.unresolvedItemCode,
            orderedQuantity: line.orderedQuantity,
            unitCost: line.unitCost,
            currency: line.currency,
            taxAmount: line.taxAmount,
            discountAmount: line.discountAmount,
            expectedDeliveryDate: line.expectedDeliveryDate ? new Date(line.expectedDeliveryDate) : undefined,
            supplierItemCode: line.supplierItemCode,
            checksum: line.checksum,
          },
        });
      }
    });
  }
}
