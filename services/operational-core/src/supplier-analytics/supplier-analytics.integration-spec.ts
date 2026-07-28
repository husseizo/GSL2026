import { PrismaService } from '../prisma/prisma.service';

// AI Foundation Certification Sprint — Phase II Sprint 2. Real, executed
// integration coverage for SupplierAnalyticsService's orchestration layer —
// one of the four services the Phase II Engineering Assessment found to
// have zero orchestration-level test coverage (confirmed real: only
// supplier-metric-math.spec.ts, a pure-function unit test, existed before
// this file). See
// docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md §5/§11.
import { SupplierAnalyticsService } from './supplier-analytics.service';

describe('SupplierAnalyticsService (integration)', () => {
  let prisma: PrismaService;
  let supplierAnalytics: SupplierAnalyticsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    supplierAnalytics = new SupplierAnalyticsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('real recalculate() computes and persists a real SupplierMetric from real purchase document history', async () => {
    const supplier = await prisma.supplier.create({
      data: { supplierCode: 'SUP-ANALYTICS-1', legalName: 'Analytics Supplier Ltd', displayName: 'Analytics Supplier' },
    });

    const now = new Date('2026-04-01T00:00:00Z');
    const doc = await prisma.purchaseDocument.create({
      data: {
        documentNumber: 'PO-ANALYTICS-1',
        documentType: 'PURCHASE_ORDER',
        status: 'RECEIVED',
        supplierId: supplier.id,
        documentDate: new Date('2026-03-01T00:00:00Z'),
        expectedDeliveryDate: new Date('2026-03-10T00:00:00Z'),
      },
    });
    // computeSupplierMetrics() requires a real minimum of 3 samples before
    // producing any metric (MIN_SAMPLE_FOR_ANY_METRIC in
    // supplier-metric-math.ts) — fewer than 3 real lines correctly returns
    // all-null with INSUFFICIENT_DATA, confirmed directly against the real
    // pure function before writing this fixture.
    for (let i = 1; i <= 3; i++) {
      await prisma.purchaseDocumentLine.create({
        data: {
          purchaseDocumentId: doc.id,
          lineNumber: i,
          orderedQuantity: 100,
          receivedQuantity: 100,
          unitCost: 10,
          expectedDeliveryDate: new Date('2026-03-10T00:00:00Z'),
          actualReceiptDate: new Date('2026-03-09T00:00:00Z'), // one real day early — a good, real on-time delivery
        },
      });
    }

    const result = await supplierAnalytics.recalculate(now);
    expect(result.suppliersProcessed).toBeGreaterThanOrEqual(1);

    const metric = await prisma.supplierMetric.findUniqueOrThrow({ where: { supplierId: supplier.id } });
    expect(metric.onTimeDeliveryPct).not.toBeNull();
    expect(Number(metric.onTimeDeliveryPct)).toBeGreaterThan(0);
    expect(Number(metric.receiptCompletionPct)).toBe(100);
  });

  it('real, repeated recalculate() runs update (not duplicate) the same SupplierMetric row', async () => {
    const supplier = await prisma.supplier.create({
      data: { supplierCode: 'SUP-ANALYTICS-2', legalName: 'Repeat Supplier Ltd', displayName: 'Repeat Supplier' },
    });
    const doc = await prisma.purchaseDocument.create({
      data: { documentNumber: 'PO-ANALYTICS-2', documentType: 'PURCHASE_ORDER', status: 'RECEIVED', supplierId: supplier.id, documentDate: new Date('2026-03-01T00:00:00Z') },
    });
    await prisma.purchaseDocumentLine.create({
      data: { purchaseDocumentId: doc.id, lineNumber: 1, orderedQuantity: 10, receivedQuantity: 10, unitCost: 5 },
    });

    await supplierAnalytics.recalculate(new Date('2026-04-01T00:00:00Z'));
    await supplierAnalytics.recalculate(new Date('2026-04-02T00:00:00Z'));

    const metrics = await prisma.supplierMetric.findMany({ where: { supplierId: supplier.id } });
    expect(metrics).toHaveLength(1); // upserted, not duplicated
    expect(metrics[0].calculatedAt.toISOString()).toContain('2026-04-02');
  });

  it('real listLatePurchaseOrders() finds a real, currently-open purchase order past its expected delivery date', async () => {
    const supplier = await prisma.supplier.create({
      data: { supplierCode: 'SUP-ANALYTICS-3', legalName: 'Late Supplier Ltd', displayName: 'Late Supplier' },
    });
    const now = new Date('2026-04-15T00:00:00Z');
    await prisma.purchaseDocument.create({
      data: {
        documentNumber: 'PO-ANALYTICS-LATE-1',
        documentType: 'PURCHASE_ORDER',
        status: 'SENT',
        supplierId: supplier.id,
        documentDate: new Date('2026-03-01T00:00:00Z'),
        expectedDeliveryDate: new Date('2026-04-01T00:00:00Z'), // real, already past
      },
    });

    const late = await supplierAnalytics.listLatePurchaseOrders(now);
    expect(late.some((d) => d.supplierId === supplier.id)).toBe(true);
  });

  it('real getScorecard() returns the real, persisted metric for a specific supplier', async () => {
    const supplier = await prisma.supplier.create({
      data: { supplierCode: 'SUP-ANALYTICS-4', legalName: 'Scorecard Supplier Ltd', displayName: 'Scorecard Supplier' },
    });
    const doc = await prisma.purchaseDocument.create({
      data: { documentNumber: 'PO-ANALYTICS-4', documentType: 'PURCHASE_ORDER', status: 'RECEIVED', supplierId: supplier.id, documentDate: new Date('2026-03-01T00:00:00Z') },
    });
    await prisma.purchaseDocumentLine.create({
      data: { purchaseDocumentId: doc.id, lineNumber: 1, orderedQuantity: 20, receivedQuantity: 20, unitCost: 3 },
    });
    await supplierAnalytics.recalculate(new Date('2026-04-01T00:00:00Z'));

    const scorecard = await supplierAnalytics.getScorecard(supplier.id);
    expect(scorecard).not.toBeNull();
    expect(scorecard!.supplier.id).toBe(supplier.id);
  });
});
