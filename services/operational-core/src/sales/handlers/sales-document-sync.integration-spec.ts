import { DataQualityService } from '../../common/data-quality/data-quality.service';
import { InventoryLedgerService } from '../../inventory/inventory-ledger.service';
import { createWarehouseFixture } from '../../test-helpers/db-fixtures';
import { PrismaService } from '../../prisma/prisma.service';
import { LegacySalesDocumentRaw, SalesDocumentSyncHandler } from './sales-document-sync.handler';

describe('SalesDocumentSyncHandler (integration)', () => {
  let prisma: PrismaService;
  let handler: SalesDocumentSyncHandler;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const dataQuality = new DataQualityService(prisma);
    const ledger = new InventoryLedgerService(prisma, dataQuality);
    handler = new SalesDocumentSyncHandler(prisma, dataQuality, ledger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function rawDoc(overrides: Partial<LegacySalesDocumentRaw> = {}): LegacySalesDocumentRaw {
    return {
      document_number: 'INV-TEST-1',
      document_type: 'INVOICE',
      document_date: '2026-01-10T00:00:00Z',
      currency: 'TZS',
      lines: [{ line_number: 1, quantity: 2, unit_price: 1000 }],
      ...overrides,
    };
  }

  async function syncOnce(sourceRecordId: string, raw: LegacySalesDocumentRaw) {
    const validation = handler.validate(raw);
    expect(validation.valid).toBe(true);
    const normalized = await handler.normalize(raw);
    const checksum = handler.checksum(normalized);
    const existingChecksum = await handler.getExistingChecksum('TEST_POS', sourceRecordId);
    if (existingChecksum === checksum) return { skipped: true };
    await handler.upsert({ sourceSystem: 'TEST_POS', sourceRecordId, checksum, normalized });
    return { skipped: false };
  }

  it('is idempotent at the document and line level — replay is a no-op', async () => {
    const raw = rawDoc({ document_number: 'INV-IDEMPOTENT-1' });
    const first = await syncOnce('sale-idempotent-1', raw);
    expect(first.skipped).toBe(false);

    const docCountBefore = await prisma.salesDocument.count({ where: { documentNumber: 'INV-IDEMPOTENT-1' } });
    const lineCountBefore = await prisma.salesDocumentLine.count();

    const second = await syncOnce('sale-idempotent-1', raw); // identical replay
    expect(second.skipped).toBe(true);

    const docCountAfter = await prisma.salesDocument.count({ where: { documentNumber: 'INV-IDEMPOTENT-1' } });
    const lineCountAfter = await prisma.salesDocumentLine.count();
    expect(docCountAfter).toBe(docCountBefore);
    expect(lineCountAfter).toBe(lineCountBefore);
  });

  it('applies a source update when the checksum changes, without duplicating the document', async () => {
    const sourceRecordId = 'sale-update-1';
    await syncOnce(sourceRecordId, rawDoc({ document_number: 'INV-UPDATE-1', lines: [{ line_number: 1, quantity: 2, unit_price: 1000 }] }));

    const before = await prisma.salesDocument.findUnique({ where: { sourceSystem_sourceRecordId: { sourceSystem: 'TEST_POS', sourceRecordId } } });
    expect(before).not.toBeNull();

    // Corrected quantity -> different checksum -> should update in place, not create a second document.
    const result = await syncOnce(sourceRecordId, rawDoc({ document_number: 'INV-UPDATE-1', lines: [{ line_number: 1, quantity: 5, unit_price: 1000 }] }));
    expect(result.skipped).toBe(false);

    const documentsWithThisNumber = await prisma.salesDocument.count({ where: { documentNumber: 'INV-UPDATE-1' } });
    expect(documentsWithThisNumber).toBe(1);

    const line = await prisma.salesDocumentLine.findFirst({ where: { salesDocumentId: before!.id, lineNumber: 1 } });
    expect(Number(line!.quantity)).toBe(5);
  });

  it('posts an inventory SALE_ISSUE movement for a resolved, warehouse-scoped line on an issuing document type', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'sales-inv-1');
    const part = await prisma.part.create({
      data: { oemNumber: 'OEM-SALES-INV-1', productName: 'Sales Test Part', standardizedProductName: 'sales test part' },
    });

    await syncOnce('sale-inventory-1', {
      document_number: 'INV-INVENTORY-1',
      document_type: 'INVOICE',
      document_date: '2026-01-15T00:00:00Z',
      warehouse_code: `WH-sales-inv-1`,
      lines: [{ line_number: 1, item_code: part.oemNumber, quantity: 3, unit_price: 5000 }],
    });

    const movement = await prisma.inventoryMovement.findFirst({ where: { partId: part.id, warehouseId: warehouse.id } });
    expect(movement).not.toBeNull();
    expect(movement!.movementType).toBe('SALE_ISSUE');
    expect(Number(movement!.quantity)).toBe(3);
  });

  it('does not post an inventory movement for a QUOTATION (non-issuing document type)', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'sales-quo-1');
    const part = await prisma.part.create({
      data: { oemNumber: 'OEM-SALES-QUO-1', productName: 'Quote Test Part', standardizedProductName: 'quote test part' },
    });

    await syncOnce('sale-quotation-1', {
      document_number: 'QUO-TEST-1',
      document_type: 'QUOTATION',
      document_date: '2026-01-16T00:00:00Z',
      warehouse_code: 'WH-sales-quo-1',
      lines: [{ line_number: 1, item_code: part.oemNumber, quantity: 3, unit_price: 5000 }],
    });

    const movement = await prisma.inventoryMovement.findFirst({ where: { partId: part.id, warehouseId: warehouse.id } });
    expect(movement).toBeNull();
  });
});
