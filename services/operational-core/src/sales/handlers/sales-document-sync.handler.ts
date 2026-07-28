import { Injectable } from '@nestjs/common';
import {
  DataQualitySeverity,
  InventoryMovementType,
  ItemType,
  MovementDirection,
  SalesDocumentStatus,
  SalesDocumentType,
} from '@prisma/client';
import { DataQualityService } from '../../common/data-quality/data-quality.service';
import { stableChecksum } from '../../integration/checksum';
import { EntitySyncHandler, ValidationResult } from '../../integration/entity-sync-handler.interface';
import { InventoryLedgerService } from '../../inventory/inventory-ledger.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface LegacySalesLineRaw {
  line_number: number;
  item_code?: string;
  item_type?: 'PART' | 'LUBRICANT' | 'LABOUR' | 'SERVICE' | 'MISCELLANEOUS';
  description?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_amount?: number;
  warehouse_code?: string;
  vin?: string;
  cost_at_sale?: number;
}

export interface LegacySalesDocumentRaw {
  document_number: string;
  external_document_number?: string;
  document_type: string;
  customer_code?: string;
  branch_code?: string;
  warehouse_code?: string;
  salesperson_external_id?: string;
  document_date: string;
  currency?: string;
  lines: LegacySalesLineRaw[];
}

interface NormalizedSalesLine {
  lineNumber: number;
  itemType: ItemType;
  partId?: string;
  lubricantProductId?: string;
  unresolvedItemCode?: string;
  originalDescription?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  costAtSale?: number;
  warehouseId?: string;
  vehicleId?: string;
  checksum: string;
}

export interface NormalizedSalesDocument {
  documentNumber: string;
  externalDocumentNumber?: string;
  documentType: SalesDocumentType;
  customerId?: string;
  unresolvedCustomerRef?: string;
  branchId?: string;
  warehouseId?: string;
  salespersonExternalId?: string;
  documentDate: string;
  currency: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  lines: NormalizedSalesLine[];
}

// Document types where stock actually leaves/returns at import time — a
// QUOTATION or open SALES_ORDER doesn't move inventory. See
// docs/architecture/phase-2-commercial-foundation.md §2.4.
const ISSUING_TYPES = new Set<SalesDocumentType>([
  SalesDocumentType.INVOICE,
  SalesDocumentType.DELIVERY,
  SalesDocumentType.COUNTER_SALE,
]);
const RETURNING_TYPES = new Set<SalesDocumentType>([SalesDocumentType.RETURN]);

@Injectable()
export class SalesDocumentSyncHandler implements EntitySyncHandler<LegacySalesDocumentRaw, NormalizedSalesDocument> {
  readonly entityType = 'SALES_DOCUMENT' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  validate(raw: LegacySalesDocumentRaw): ValidationResult {
    if (!raw.document_number?.trim()) return { valid: false, error: 'document_number is required' };
    if (!raw.document_type?.trim()) return { valid: false, error: 'document_type is required' };
    if (!raw.document_date) return { valid: false, error: 'document_date is required' };
    if (!Array.isArray(raw.lines) || raw.lines.length === 0) return { valid: false, error: 'at least one line is required' };
    if (!(raw.document_type in SalesDocumentType)) {
      return { valid: false, error: `unknown document_type "${raw.document_type}"` };
    }
    return { valid: true };
  }

  async normalize(raw: LegacySalesDocumentRaw): Promise<NormalizedSalesDocument> {
    const [customer, branch, warehouse] = await Promise.all([
      raw.customer_code ? this.prisma.customer.findUnique({ where: { customerCode: raw.customer_code } }) : null,
      raw.branch_code ? this.prisma.branch.findFirst({ where: { code: raw.branch_code } }) : null,
      raw.warehouse_code ? this.prisma.warehouse.findFirst({ where: { code: raw.warehouse_code } }) : null,
    ]);

    if (raw.customer_code && !customer) {
      await this.dataQuality.record({
        checkName: 'unresolved_customer_reference',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'SalesDocument',
        message: `Customer code "${raw.customer_code}" on sale ${raw.document_number} did not resolve — preserved as unresolvedCustomerRef`,
        context: { documentNumber: raw.document_number, customerCode: raw.customer_code },
      });
    }

    const lines = await Promise.all(
      raw.lines.map((line) => this.normalizeLine(raw.document_number, line, warehouse?.id)),
    );
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const discountTotal = lines.reduce((sum, l) => sum + l.discountAmount, 0);
    const taxTotal = lines.reduce((sum, l) => sum + l.taxAmount, 0);

    return {
      documentNumber: raw.document_number,
      externalDocumentNumber: raw.external_document_number,
      documentType: raw.document_type as SalesDocumentType,
      customerId: customer?.id,
      unresolvedCustomerRef: !customer && raw.customer_code ? raw.customer_code : undefined,
      branchId: branch?.id,
      warehouseId: warehouse?.id,
      salespersonExternalId: raw.salesperson_external_id,
      documentDate: raw.document_date,
      currency: raw.currency ?? 'TZS',
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal: subtotal - discountTotal + taxTotal,
      lines,
    };
  }

  private async normalizeLine(
    documentNumber: string,
    line: LegacySalesLineRaw,
    documentWarehouseId?: string,
  ): Promise<NormalizedSalesLine> {
    const findings = this.dataQuality.checkQuantityAndPrice({
      entityType: 'SalesDocumentLine',
      quantity: line.quantity,
      unitPrice: line.unit_price,
    });
    await Promise.all(findings.map((f) => this.dataQuality.record(f)));

    const [part, lineWarehouse, vehicle] = await Promise.all([
      line.item_code
        ? this.prisma.part.findFirst({ where: { OR: [{ internalItemCode: line.item_code }, { oemNumber: line.item_code }] } })
        : null,
      line.warehouse_code ? this.prisma.warehouse.findFirst({ where: { code: line.warehouse_code } }) : null,
      line.vin ? this.prisma.vehicle.findUnique({ where: { vin: line.vin.toUpperCase() } }) : null,
    ]);
    const lubricant = part || !line.item_code ? null : await this.prisma.lubricantProduct.findFirst({ where: { internalCode: line.item_code } });

    let itemType: ItemType = ItemType.UNKNOWN;
    if (part) itemType = ItemType.PART;
    else if (lubricant) itemType = ItemType.LUBRICANT;
    else if (line.item_type) itemType = line.item_type as ItemType;

    if (line.item_code && !part && !lubricant) {
      await this.dataQuality.record({
        checkName: 'missing_item_resolution',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'SalesDocumentLine',
        message: `Item code "${line.item_code}" on sale ${documentNumber} line ${line.line_number} did not resolve to a part or lubricant`,
        context: { documentNumber, lineNumber: line.line_number, itemCode: line.item_code },
      });
    }

    const quantity = line.quantity;
    const unitPrice = line.unit_price;
    const discountAmount = line.discount_amount ?? 0;
    const taxAmount = line.tax_amount ?? 0;

    const normalizedLine = {
      lineNumber: line.line_number,
      itemType,
      partId: part?.id,
      lubricantProductId: lubricant?.id,
      unresolvedItemCode: !part && !lubricant ? line.item_code : undefined,
      originalDescription: line.description,
      quantity,
      unitPrice,
      discountAmount,
      taxAmount,
      lineTotal: quantity * unitPrice - discountAmount + taxAmount,
      costAtSale: line.cost_at_sale,
      warehouseId: lineWarehouse?.id ?? documentWarehouseId,
      vehicleId: vehicle?.id,
    };

    return { ...normalizedLine, checksum: stableChecksum(normalizedLine) };
  }

  checksum(normalized: NormalizedSalesDocument): string {
    return stableChecksum(normalized);
  }

  async getExistingChecksum(sourceSystem: string, sourceRecordId: string): Promise<string | null> {
    const existing = await this.prisma.salesDocument.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
    });
    return existing?.checksum ?? null;
  }

  async upsert(params: {
    sourceSystem: string;
    sourceRecordId: string;
    recordVersion?: string;
    checksum: string;
    normalized: NormalizedSalesDocument;
  }): Promise<void> {
    const { sourceSystem, sourceRecordId, recordVersion, checksum, normalized } = params;

    await this.prisma.$transaction(async (tx) => {
      const document = await tx.salesDocument.upsert({
        where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
        create: {
          documentNumber: normalized.documentNumber,
          externalDocumentNumber: normalized.externalDocumentNumber,
          documentType: normalized.documentType,
          status: SalesDocumentStatus.FULFILLED,
          customerId: normalized.customerId,
          unresolvedCustomerRef: normalized.unresolvedCustomerRef,
          branchId: normalized.branchId,
          warehouseId: normalized.warehouseId,
          salespersonExternalId: normalized.salespersonExternalId,
          documentDate: new Date(normalized.documentDate),
          currency: normalized.currency,
          subtotal: normalized.subtotal,
          discountTotal: normalized.discountTotal,
          taxTotal: normalized.taxTotal,
          grandTotal: normalized.grandTotal,
          outstandingAmount: 0,
          paidAmount: normalized.grandTotal,
          sourceSystem,
          sourceRecordId,
          externalId: normalized.documentNumber,
          syncedAt: new Date(),
          recordVersion,
          checksum,
        },
        update: {
          customerId: normalized.customerId,
          unresolvedCustomerRef: normalized.unresolvedCustomerRef,
          branchId: normalized.branchId,
          warehouseId: normalized.warehouseId,
          documentDate: new Date(normalized.documentDate),
          currency: normalized.currency,
          subtotal: normalized.subtotal,
          discountTotal: normalized.discountTotal,
          taxTotal: normalized.taxTotal,
          grandTotal: normalized.grandTotal,
          syncedAt: new Date(),
          recordVersion,
          checksum,
        },
      });

      for (const line of normalized.lines) {
        const existingLine = await tx.salesDocumentLine.findUnique({
          where: { salesDocumentId_lineNumber: { salesDocumentId: document.id, lineNumber: line.lineNumber } },
        });

        if (existingLine?.checksum === line.checksum) continue; // unchanged — no-op

        if (existingLine) {
          // A genuine source correction to an already-posted line. We do NOT
          // silently re-post or adjust the ledger for it — that would be an
          // untraceable inventory change. A human resolves it via an explicit
          // InventoryAdjustment. See docs/architecture/data-quality-phase-2.md.
          await tx.salesDocumentLine.update({
            where: { id: existingLine.id },
            data: { ...lineUpdateData(line), checksum: line.checksum },
          });
          await this.dataQuality.record({
            checkName: 'sales_line_changed_after_posting',
            severity: DataQualitySeverity.MANUAL_REVIEW,
            entityType: 'SalesDocumentLine',
            entityId: existingLine.id,
            message: `Sales line ${document.documentNumber}/${line.lineNumber} changed after its inventory movement was already posted — ledger was NOT auto-adjusted`,
            context: { documentId: document.id, lineNumber: line.lineNumber },
          });
          continue;
        }

        const created = await tx.salesDocumentLine.create({
          data: {
            salesDocumentId: document.id,
            ...lineUpdateData(line),
            sourceSystem,
            sourceRecordId: `${sourceRecordId}:${line.lineNumber}`,
            checksum: line.checksum,
          },
        });

        const canPostInventory = (line.partId || line.lubricantProductId) && line.warehouseId;
        if (canPostInventory && ISSUING_TYPES.has(normalized.documentType)) {
          await this.ledger.postMovement(
            {
              itemType: line.itemType,
              partId: line.partId,
              lubricantProductId: line.lubricantProductId,
              warehouseId: line.warehouseId!,
              quantity: line.quantity,
              direction: MovementDirection.OUT,
              movementType: InventoryMovementType.SALE_ISSUE,
              referenceType: 'SalesDocumentLine',
              referenceId: created.id,
              sourceSystem,
              sourceRecordId: `${sourceRecordId}:${line.lineNumber}`,
              occurredAt: new Date(normalized.documentDate),
              unitCost: line.costAtSale,
            },
            tx,
          );
        } else if (canPostInventory && RETURNING_TYPES.has(normalized.documentType)) {
          await this.ledger.postMovement(
            {
              itemType: line.itemType,
              partId: line.partId,
              lubricantProductId: line.lubricantProductId,
              warehouseId: line.warehouseId!,
              quantity: line.quantity,
              direction: MovementDirection.IN,
              movementType: InventoryMovementType.CUSTOMER_RETURN,
              referenceType: 'SalesDocumentLine',
              referenceId: created.id,
              sourceSystem,
              sourceRecordId: `${sourceRecordId}:${line.lineNumber}`,
              occurredAt: new Date(normalized.documentDate),
              unitCost: line.costAtSale,
            },
            tx,
          );
        }
      }
    });
  }
}

function lineUpdateData(line: NormalizedSalesLine) {
  return {
    itemType: line.itemType,
    partId: line.partId,
    lubricantProductId: line.lubricantProductId,
    unresolvedItemCode: line.unresolvedItemCode,
    originalDescription: line.originalDescription,
    lineNumber: line.lineNumber,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
    costAtSale: line.costAtSale,
    warehouseId: line.warehouseId,
    vehicleId: line.vehicleId,
  };
}
