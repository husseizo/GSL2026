import { DataQualityService } from '../../common/data-quality/data-quality.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LegacyPurchaseDocumentRaw, PurchaseDocumentSyncHandler } from './purchase-document-sync.handler';

describe('PurchaseDocumentSyncHandler (integration)', () => {
  let prisma: PrismaService;
  let handler: PurchaseDocumentSyncHandler;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    handler = new PurchaseDocumentSyncHandler(prisma, new DataQualityService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function rawDoc(overrides: Partial<LegacyPurchaseDocumentRaw> = {}): LegacyPurchaseDocumentRaw {
    return {
      document_number: 'PO-TEST-1',
      document_type: 'PURCHASE_ORDER',
      document_date: '2026-01-01T00:00:00Z',
      lines: [{ line_number: 1, item_code: 'OEM-PO-1', ordered_quantity: 10, unit_cost: 50 }],
      ...overrides,
    };
  }

  async function syncOnce(sourceRecordId: string, raw: LegacyPurchaseDocumentRaw) {
    const normalized = await handler.normalize(raw);
    const checksum = handler.checksum(normalized);
    const existingChecksum = await handler.getExistingChecksum('TEST_ERP', sourceRecordId);
    if (existingChecksum === checksum) return { skipped: true };
    await handler.upsert({ sourceSystem: 'TEST_ERP', sourceRecordId, checksum, normalized });
    return { skipped: false };
  }

  it('is idempotent at the document and line level', async () => {
    const raw = rawDoc({ document_number: 'PO-IDEMPOTENT-1' });
    const first = await syncOnce('po-idempotent-1', raw);
    expect(first.skipped).toBe(false);

    const lineCountBefore = await prisma.purchaseDocumentLine.count();
    const second = await syncOnce('po-idempotent-1', raw);
    expect(second.skipped).toBe(true);
    const lineCountAfter = await prisma.purchaseDocumentLine.count();
    expect(lineCountAfter).toBe(lineCountBefore);

    const docCount = await prisma.purchaseDocument.count({ where: { documentNumber: 'PO-IDEMPOTENT-1' } });
    expect(docCount).toBe(1);
  });

  it('applies a source update (changed unit cost) without duplicating the document', async () => {
    const sourceRecordId = 'po-update-1';
    await syncOnce(sourceRecordId, rawDoc({ document_number: 'PO-UPDATE-1', lines: [{ line_number: 1, item_code: 'OEM-PO-2', ordered_quantity: 10, unit_cost: 50 }] }));
    const result = await syncOnce(sourceRecordId, rawDoc({ document_number: 'PO-UPDATE-1', lines: [{ line_number: 1, item_code: 'OEM-PO-2', ordered_quantity: 10, unit_cost: 65 }] }));
    expect(result.skipped).toBe(false);

    const docCount = await prisma.purchaseDocument.count({ where: { documentNumber: 'PO-UPDATE-1' } });
    expect(docCount).toBe(1);

    const doc = await prisma.purchaseDocument.findFirst({ where: { documentNumber: 'PO-UPDATE-1' } });
    const line = await prisma.purchaseDocumentLine.findFirst({ where: { purchaseDocumentId: doc!.id } });
    expect(Number(line!.unitCost)).toBe(65);
  });
});
