import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../common/permissions/permissions.decorator';
import { AuditService } from '../common/audit/audit.service';
import { computeItemKey, computeWarehouseKey } from '../inventory/item-key';
import { PrismaService } from '../prisma/prisma.service';
import { createCustomerFixture, createPartFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { AiPurchasingSignalsService } from './ai-purchasing-signals.service';
import { PurchaseRecommendationsController } from './purchase-recommendations.controller';
import { PurchaseRecommendationsService } from './purchase-recommendations.service';

// AI Foundation Certification Sprint — Phase II Sprint 1. Real, executed
// integration coverage for PurchaseRecommendationsService's orchestration
// layer (real Postgres, real service-layer flow) — the gap the Phase II
// Engineering Assessment found: only pure math functions had test coverage
// before this file. See docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md
// and docs/adr/ADR-0001-warehouse-capacity.md.
describe('PurchaseRecommendationsService (integration) — Sprint 1 Safety Gates', () => {
  let prisma: PrismaService;
  let audit: AuditService;
  let purchaseRecs: PurchaseRecommendationsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    audit = new AuditService(prisma);
    const aiSignals = new AiPurchasingSignalsService(prisma);
    purchaseRecs = new PurchaseRecommendationsService(prisma, audit, aiSignals);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('generates a real recommendation from real inventory metric + planning profile data (real recommendation flow)', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'prs-flow-1');
    const part = await createPartFixture(prisma, 'prs-flow-1');
    const itemKey = computeItemKey(part.id, null);

    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: warehouse.id,
        itemKey,
        warehouseKey: computeWarehouseKey(warehouse.id),
        availableStock: 1,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
        stockOutRisk: 'HIGH',
      },
    });

    await purchaseRecs.generate();

    const rec = await prisma.purchaseRecommendation.findFirstOrThrow({ where: { partId: part.id, warehouseId: warehouse.id } });
    expect(rec.status).toBe('PENDING');
    expect(['BUY_NOW', 'BUY_SOON']).toContain(rec.action);
  });

  it('Safety Gate: never recommends a purchase against a real, confirmed-inactive supplier', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'prs-supplier-1');
    const part = await createPartFixture(prisma, 'prs-supplier-1');
    const itemKey = computeItemKey(part.id, null);

    const supplier = await prisma.supplier.create({
      data: { supplierCode: 'SUP-INACTIVE-1', legalName: 'Inactive Supplier Ltd', displayName: 'Inactive Supplier', isActive: false, defaultLeadTimeDays: 14 },
    });
    await prisma.itemPlanningProfile.create({
      data: { itemKey, itemType: 'PART', partId: part.id, defaultSupplierId: supplier.id, safetyStock: 0, targetCoverageDays: 30, maxCoverageDays: 90 },
    });
    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: warehouse.id,
        itemKey,
        warehouseKey: computeWarehouseKey(warehouse.id),
        availableStock: 0,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
        stockOutRisk: 'HIGH',
      },
    });

    await purchaseRecs.generate();

    const rec = await prisma.purchaseRecommendation.findFirstOrThrow({ where: { partId: part.id, warehouseId: warehouse.id } });
    expect(rec.action).toBe('REVIEW_DATA');
    expect(Number(rec.suggestedQuantity)).toBe(0);
    const evidence = rec.evidence as { supplierRejected?: boolean };
    expect(evidence.supplierRejected).toBe(true);
  });

  it('control: recommends normally when the real supplier is active', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'prs-supplier-2');
    const part = await createPartFixture(prisma, 'prs-supplier-2');
    const itemKey = computeItemKey(part.id, null);

    const supplier = await prisma.supplier.create({
      data: { supplierCode: 'SUP-ACTIVE-1', legalName: 'Active Supplier Ltd', displayName: 'Active Supplier', isActive: true, defaultLeadTimeDays: 14 },
    });
    await prisma.itemPlanningProfile.create({
      data: { itemKey, itemType: 'PART', partId: part.id, defaultSupplierId: supplier.id, safetyStock: 0, targetCoverageDays: 30, maxCoverageDays: 90 },
    });
    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: warehouse.id,
        itemKey,
        warehouseKey: computeWarehouseKey(warehouse.id),
        availableStock: 0,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
        stockOutRisk: 'HIGH',
      },
    });

    await purchaseRecs.generate();

    const rec = await prisma.purchaseRecommendation.findFirstOrThrow({ where: { partId: part.id, warehouseId: warehouse.id } });
    expect(rec.action).not.toBe('REVIEW_DATA');
    const evidence = rec.evidence as { supplierRejected?: boolean };
    expect(evidence.supplierRejected).toBe(false);
  });

  it('Safety Gate: never recommends a quantity that would exceed a real, known warehouse capacity', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'prs-capacity-1');
    await prisma.warehouse.update({ where: { id: warehouse.id }, data: { capacity: 10 } });
    const part = await createPartFixture(prisma, 'prs-capacity-1');
    const itemKey = computeItemKey(part.id, null);

    await prisma.itemPlanningProfile.create({
      data: { itemKey, itemType: 'PART', partId: part.id, safetyStock: 0, targetCoverageDays: 90, maxCoverageDays: 365 },
    });
    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: warehouse.id,
        itemKey,
        warehouseKey: computeWarehouseKey(warehouse.id),
        availableStock: 0,
        avgDailyDemand: 5,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'FAST_MOVING',
        stockOutRisk: 'HIGH',
      },
    });

    await purchaseRecs.generate();

    const rec = await prisma.purchaseRecommendation.findFirstOrThrow({ where: { partId: part.id, warehouseId: warehouse.id } });
    expect(Number(rec.suggestedQuantity)).toBeLessThanOrEqual(10);
    const evidence = rec.evidence as { warehouseCapacityExceeded?: boolean };
    expect(evidence.warehouseCapacityExceeded).toBe(true);
  });

  it('real audit verification: approve() writes a real, retrievable AuditLog row', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'prs-audit-1');
    const part = await createPartFixture(prisma, 'prs-audit-1');
    const itemKey = computeItemKey(part.id, null);

    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: warehouse.id,
        itemKey,
        warehouseKey: computeWarehouseKey(warehouse.id),
        availableStock: 0,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
        stockOutRisk: 'HIGH',
      },
    });
    await purchaseRecs.generate();
    const rec = await prisma.purchaseRecommendation.findFirstOrThrow({ where: { partId: part.id, warehouseId: warehouse.id } });

    const approver = await createCustomerFixture(prisma, `prs-audit-approver-${Date.now()}`);
    await purchaseRecs.approve(rec.id, approver.id, 'approved for real audit test');

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'PurchaseRecommendation', entityId: rec.id, action: 'PURCHASE_RECOMMENDATION_APPROVED' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.actorId).toBe(approver.id);

    const updated = await prisma.purchaseRecommendation.findUniqueOrThrow({ where: { id: rec.id } });
    expect(updated.status).toBe('APPROVED');
  });

  it('real permission verification: controller endpoints require the real, expected permission strings', () => {
    const generate = Reflect.getMetadata(PERMISSIONS_KEY, PurchaseRecommendationsController.prototype.generate);
    const list = Reflect.getMetadata(PERMISSIONS_KEY, PurchaseRecommendationsController.prototype.list);
    const approve = Reflect.getMetadata(PERMISSIONS_KEY, PurchaseRecommendationsController.prototype.approve);
    const reject = Reflect.getMetadata(PERMISSIONS_KEY, PurchaseRecommendationsController.prototype.reject);

    expect(generate).toEqual(['recommendations.generate']);
    expect(list).toEqual(['recommendations.read']);
    expect(approve).toEqual(['recommendations.approve']);
    expect(reject).toEqual(['recommendations.approve']);
  });
});
