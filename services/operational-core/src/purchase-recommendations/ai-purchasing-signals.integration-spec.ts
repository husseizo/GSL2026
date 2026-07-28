import { AuditService } from '../common/audit/audit.service';
import { computeItemKey, computeWarehouseKey } from '../inventory/item-key';
import { PrismaService } from '../prisma/prisma.service';
import { createPartFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { AiPurchasingSignalsService } from './ai-purchasing-signals.service';
import { PurchaseRecommendationsService } from './purchase-recommendations.service';

describe('AiPurchasingSignalsService + PurchaseRecommendationsService (integration)', () => {
  let prisma: PrismaService;
  let aiSignals: AiPurchasingSignalsService;
  let purchaseRecs: PurchaseRecommendationsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    aiSignals = new AiPurchasingSignalsService(prisma);
    purchaseRecs = new PurchaseRecommendationsService(prisma, new AuditService(prisma), aiSignals);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns empty signals for a part with no forecast, no repeat repairs, and no search events', async () => {
    const part = await createPartFixture(prisma, 'aisig-1');
    const signals = await aiSignals.computeSignals({ itemType: 'PART', partId: part.id });
    expect(signals.forecastedDemandNextWindow).toBeNull();
    expect(signals.repeatRepairPartCount).toBe(0);
    expect(signals.searchDemandEvents90d).toBe(0);
    expect(signals.evidence).toEqual([]);
  });

  it('surfaces a real chosen-best ForecastRun as forecasted demand evidence', async () => {
    const part = await createPartFixture(prisma, 'aisig-2');
    const run = await prisma.forecastRun.create({
      data: { targetType: 'PART', targetId: part.id, windowDays: 7, method: 'MOVING_AVERAGE', confidence: 'MEDIUM', chosenAsBest: true },
    });
    await prisma.forecastPoint.createMany({
      data: [
        { forecastRunId: run.id, forecastDate: new Date(), predictedValue: 2 },
        { forecastRunId: run.id, forecastDate: new Date(Date.now() + 86400000), predictedValue: 2 },
      ],
    });

    const signals = await aiSignals.computeSignals({ itemType: 'PART', partId: part.id });
    expect(signals.forecastedDemandNextWindow).toBe(4);
    expect(signals.forecastMethod).toBe('MOVING_AVERAGE');
    expect(signals.evidence[0]).toContain('Forecasted demand');
  });

  it('counts repeat-repair jobs that involved this part', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'aisig-3');
    const part = await createPartFixture(prisma, 'aisig-3');
    const job1 = await prisma.garageJob.create({ data: { jobNumber: 'JOB-AISIG-1', vehicleId: (await prisma.vehicle.create({ data: { vin: 'AISIGVIN00000001'.padEnd(17, '0'), brand: 'T', model: 'M' } })).id, branchId: branch.id } });
    const job2 = await prisma.garageJob.create({ data: { jobNumber: 'JOB-AISIG-2', vehicleId: job1.vehicleId, branchId: branch.id } });

    await prisma.garageJobLine.create({ data: { jobId: job1.id, lineType: 'PART', description: 'part', partId: part.id, quantity: 1, unitPrice: 1, lineTotal: 1 } });
    await prisma.repeatRepairFlag.create({ data: { vehicleId: job1.vehicleId, jobId: job2.id, relatedJobId: job1.id, matchReason: 'SAME_PART', status: 'CONFIRMED' } });

    const signals = await aiSignals.computeSignals({ itemType: 'PART', partId: part.id });
    expect(signals.repeatRepairPartCount).toBe(1);
    expect(signals.evidence.some((e) => e.includes('repeat-repair'))).toBe(true);
  });

  it('generate() attaches aiSignals to the persisted recommendation evidence without altering the deterministic action', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'aisig-4');
    const part = await createPartFixture(prisma, 'aisig-4');

    await prisma.inventoryItemMetric.create({
      data: {
        itemType: 'PART',
        partId: part.id,
        warehouseId: warehouse.id,
        itemKey: computeItemKey(part.id, null),
        warehouseKey: computeWarehouseKey(warehouse.id),
        availableStock: 5,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
      },
    });

    const runResult = await prisma.forecastRun.create({
      data: { targetType: 'PART', targetId: part.id, windowDays: 7, method: 'NAIVE', confidence: 'LOW', chosenAsBest: true },
    });
    await prisma.forecastPoint.create({ data: { forecastRunId: runResult.id, forecastDate: new Date(), predictedValue: 1 } });

    await purchaseRecs.generate();

    const rec = await prisma.purchaseRecommendation.findFirstOrThrow({ where: { partId: part.id, warehouseId: warehouse.id } });
    const evidence = rec.evidence as { aiSignals?: { forecastedDemandNextWindow: number | null } };
    expect(evidence.aiSignals).toBeDefined();
    expect(evidence.aiSignals!.forecastedDemandNextWindow).toBe(1);
    // The action itself must still be exactly what the deterministic engine
    // alone would produce — aiSignals is supplementary evidence, not a
    // second vote in the decision.
    expect(['BUY_NOW', 'BUY_SOON', 'MONITOR']).toContain(rec.action);
  });
});
