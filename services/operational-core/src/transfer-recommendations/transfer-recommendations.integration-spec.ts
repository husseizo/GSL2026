import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { MetricsService } from '../observability/metrics.service';
import { computeItemKey, computeWarehouseKey } from '../inventory/item-key';
import { createCustomerFixture, createPartFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { TransferRecommendationsService } from './transfer-recommendations.service';

// AI Foundation Certification Sprint — Phase II Sprint 2. Real, executed
// integration coverage for TransferRecommendationsService's orchestration
// layer — one of the four services the Phase II Engineering Assessment
// found to have zero orchestration-level test coverage (confirmed real:
// only transfer-recommendation-math.spec.ts, a pure-function unit test,
// existed before this file). See
// docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md §5/§11.
describe('TransferRecommendationsService (integration)', () => {
  let prisma: PrismaService;
  let audit: AuditService;
  let metrics: MetricsService;
  let transferRecs: TransferRecommendationsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    audit = new AuditService(prisma);
    metrics = new MetricsService();
    transferRecs = new TransferRecommendationsService(prisma, audit, metrics);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('real transfer flow: recommends a real transfer from a real surplus source warehouse to a real needy destination warehouse', async () => {
    const { warehouse: source } = await createWarehouseFixture(prisma, 'trf-flow-src-1');
    const { warehouse: destination } = await createWarehouseFixture(prisma, 'trf-flow-dst-1');
    const part = await createPartFixture(prisma, 'trf-flow-1');
    const itemKey = computeItemKey(part.id, null);

    await prisma.itemPlanningProfile.create({
      data: { itemKey, itemType: 'PART', partId: part.id, safetyStock: 5, targetCoverageDays: 30, maxCoverageDays: 90 },
    });

    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: source.id,
        itemKey,
        warehouseKey: computeWarehouseKey(source.id),
        availableStock: 100,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
      },
    });
    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: destination.id,
        itemKey,
        warehouseKey: computeWarehouseKey(destination.id),
        availableStock: 0,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
      },
    });

    const result = await transferRecs.generate();
    expect(result.generated).toBeGreaterThanOrEqual(1);

    const rec = await prisma.transferRecommendation.findFirstOrThrow({
      where: { partId: part.id, sourceWarehouseId: source.id, destinationWarehouseId: destination.id },
    });
    expect(Number(rec.suggestedQuantity)).toBeGreaterThan(0);
    expect(rec.status).toBe('PENDING');
    expect(rec.reason).toContain('Destination');
  });

  it('does not recommend a transfer when only one warehouse holds real stock for the item', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'trf-single-1');
    const part = await createPartFixture(prisma, 'trf-single-1');
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
      },
    });

    await transferRecs.generate();

    const rec = await prisma.transferRecommendation.findFirst({ where: { partId: part.id } });
    expect(rec).toBeNull();
  });

  it('real audit + approval flow: approve() writes a real AuditLog row and updates real status', async () => {
    const { warehouse: source } = await createWarehouseFixture(prisma, 'trf-audit-src-1');
    const { warehouse: destination } = await createWarehouseFixture(prisma, 'trf-audit-dst-1');
    const part = await createPartFixture(prisma, 'trf-audit-1');
    const itemKey = computeItemKey(part.id, null);

    await prisma.itemPlanningProfile.create({
      data: { itemKey, itemType: 'PART', partId: part.id, safetyStock: 0, targetCoverageDays: 30, maxCoverageDays: 90 },
    });
    await prisma.inventoryItemMetric.create({
      data: { itemType: 'PART', partId: part.id, warehouseId: source.id, itemKey, warehouseKey: computeWarehouseKey(source.id), availableStock: 50, avgDailyDemand: 1, historyDays: 90, hasSufficientHistory: true, movementClass: 'MEDIUM_MOVING' },
    });
    await prisma.inventoryItemMetric.create({
      data: { itemType: 'PART', partId: part.id, warehouseId: destination.id, itemKey, warehouseKey: computeWarehouseKey(destination.id), availableStock: 0, avgDailyDemand: 1, historyDays: 90, hasSufficientHistory: true, movementClass: 'MEDIUM_MOVING' },
    });

    await transferRecs.generate();
    const rec = await prisma.transferRecommendation.findFirstOrThrow({ where: { partId: part.id, sourceWarehouseId: source.id, destinationWarehouseId: destination.id } });

    const approver = await createCustomerFixture(prisma, `trf-audit-approver-${Date.now()}`);
    await transferRecs.approve(rec.id, approver.id, 'approved for real audit test');

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'TransferRecommendation', entityId: rec.id, action: 'TRANSFER_RECOMMENDATION_APPROVED' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.actorId).toBe(approver.id);

    const updated = await prisma.transferRecommendation.findUniqueOrThrow({ where: { id: rec.id } });
    expect(updated.status).toBe('APPROVED');
  });

  it('real observability: generate()/approve()/reject() record real recommendation metrics', async () => {
    const { warehouse: source } = await createWarehouseFixture(prisma, 'trf-metrics-src-1');
    const { warehouse: destination } = await createWarehouseFixture(prisma, 'trf-metrics-dst-1');
    const part = await createPartFixture(prisma, 'trf-metrics-1');
    const itemKey = computeItemKey(part.id, null);

    await prisma.itemPlanningProfile.create({
      data: { itemKey, itemType: 'PART', partId: part.id, safetyStock: 0, targetCoverageDays: 30, maxCoverageDays: 90 },
    });
    await prisma.inventoryItemMetric.create({
      data: { itemType: 'PART', partId: part.id, warehouseId: source.id, itemKey, warehouseKey: computeWarehouseKey(source.id), availableStock: 50, avgDailyDemand: 1, historyDays: 90, hasSufficientHistory: true, movementClass: 'MEDIUM_MOVING' },
    });
    await prisma.inventoryItemMetric.create({
      data: { itemType: 'PART', partId: part.id, warehouseId: destination.id, itemKey, warehouseKey: computeWarehouseKey(destination.id), availableStock: 0, avgDailyDemand: 1, historyDays: 90, hasSufficientHistory: true, movementClass: 'MEDIUM_MOVING' },
    });

    await transferRecs.generate();
    const rec = await prisma.transferRecommendation.findFirstOrThrow({ where: { partId: part.id, sourceWarehouseId: source.id, destinationWarehouseId: destination.id } });
    const approver = await createCustomerFixture(prisma, `trf-metrics-approver-${Date.now()}`);
    await transferRecs.reject(rec.id, approver.id, 'rejected for real metrics test');

    const text = await metrics.getMetricsText();
    expect(text).toMatch(/recommendation_executions_total\{recommendationType="TRANSFER"\}/);
    expect(text).toMatch(/recommendation_rejections_total\{recommendationType="TRANSFER"\}/);
  });
});
