import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import { createWarehouseFixture } from '../test-helpers/db-fixtures';
import { ForecastingService } from './forecasting.service';

describe('ForecastingService (integration)', () => {
  let prisma: PrismaService;
  let forecasting: ForecastingService;
  let metrics: MetricsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    metrics = new MetricsService();
    forecasting = new ForecastingService(prisma, metrics);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a forecast request with no historical data', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'fc-empty');
    await expect(forecasting.generate('GARAGE_WORKLOAD', branch.id, 30)).rejects.toThrow('No historical data available');
  });

  it('generates one ForecastRun per method, marks exactly one as best, and persists future points only for it', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'fc-1');
    const vehicle = await prisma.vehicle.create({ data: { vin: 'FCVIN0000000001'.padEnd(17, '0'), brand: 'Test', model: 'Model' } });

    // 60 days of a steady 2-jobs-per-day workload — a real, backtestable series.
    const jobs = [];
    for (let i = 0; i < 60; i++) {
      const openedAt = new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000);
      for (let j = 0; j < 2; j++) {
        jobs.push(
          prisma.garageJob.create({
            data: { jobNumber: `JOB-FC1-${i}-${j}`, vehicleId: vehicle.id, branchId: branch.id, openedAt },
          }),
        );
      }
    }
    await Promise.all(jobs);

    const result = await forecasting.generate('GARAGE_WORKLOAD', branch.id, 7);

    expect(result.runs).toHaveLength(5); // NAIVE, MOVING_AVERAGE, EXPONENTIAL_SMOOTHING, SEASONAL_NAIVE, CROSTON
    expect(result.bestMethod).toBeDefined();

    const bestRuns = result.runs.filter((r) => r.chosenAsBest);
    expect(bestRuns).toHaveLength(1);

    const persistedRuns = await prisma.forecastRun.findMany({ where: { targetType: 'GARAGE_WORKLOAD', targetId: branch.id }, include: { points: true } });
    expect(persistedRuns).toHaveLength(5);

    const bestPersisted = persistedRuns.find((r) => r.chosenAsBest)!;
    expect(bestPersisted.points).toHaveLength(7);
    expect(Number(bestPersisted.mape)).toBeLessThan(50); // a flat, predictable series should backtest reasonably well

    // Phase II Sprint 2 fix (see docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md
    // §7): WAPE/MASE were computed correctly by forecast-math.ts all along
    // but never persisted here — every real ForecastRun must now carry both.
    for (const run of persistedRuns) {
      expect(run.wape).not.toBeNull();
      expect(Number(run.wape)).toBeGreaterThanOrEqual(0);
      expect(run.mase).not.toBeNull();
      expect(Number(run.mase)).toBeGreaterThanOrEqual(0);
    }

    const nonBestPersisted = persistedRuns.filter((r) => !r.chosenAsBest);
    for (const run of nonBestPersisted) {
      expect(run.points).toHaveLength(0);
    }
  });

  // DGX 2.0 Certification Standard Amendment v1.1 (Remediation Cycle 2):
  // testActualSum must be a real, persisted evidence field on every real
  // ForecastRun — never computed later, only ever read at certification
  // time from what was captured here.
  it('persists a real, finite testActualSum evidence value on every real ForecastRun (Amendment v1.1 evidence requirement)', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'fc-evidence-1');
    const vehicle = await prisma.vehicle.create({ data: { vin: 'FCEVIDVIN000001'.padEnd(17, '0'), brand: 'Test', model: 'Model' } });

    const jobs = [];
    for (let i = 0; i < 40; i++) {
      const openedAt = new Date(Date.now() - (40 - i) * 24 * 60 * 60 * 1000);
      jobs.push(prisma.garageJob.create({ data: { jobNumber: `JOB-FCEVID-${i}`, vehicleId: vehicle.id, branchId: branch.id, openedAt } }));
    }
    await Promise.all(jobs);

    await forecasting.generate('GARAGE_WORKLOAD', branch.id, 7);

    const persistedRuns = await prisma.forecastRun.findMany({ where: { targetType: 'GARAGE_WORKLOAD', targetId: branch.id } });
    expect(persistedRuns.length).toBeGreaterThan(0);
    for (const run of persistedRuns) {
      const evidence = run.evidence as { testActualSum?: unknown };
      expect(typeof evidence.testActualSum).toBe('number');
      expect(Number.isFinite(evidence.testActualSum as number)).toBe(true);
      expect(evidence.testActualSum as number).toBeGreaterThanOrEqual(0);
    }
  });

  it('list() filters by targetType and chosenAsBest', async () => {
    const runs = await forecasting.list({ targetType: 'GARAGE_WORKLOAD', chosenAsBest: true });
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.every((r) => r.chosenAsBest)).toBe(true);
  });

  it('historical WAPE/MASE values remain real and queryable across multiple real runs (not overwritten or lost)', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'fc-hist-1');
    const vehicle = await prisma.vehicle.create({ data: { vin: 'FCHISTVIN000001'.padEnd(17, '0'), brand: 'Test', model: 'Model' } });

    const jobs = [];
    for (let i = 0; i < 45; i++) {
      const openedAt = new Date(Date.now() - (45 - i) * 24 * 60 * 60 * 1000);
      jobs.push(prisma.garageJob.create({ data: { jobNumber: `JOB-FCHIST-${i}`, vehicleId: vehicle.id, branchId: branch.id, openedAt } }));
    }
    await Promise.all(jobs);

    await forecasting.generate('GARAGE_WORKLOAD', branch.id, 7);
    await forecasting.generate('GARAGE_WORKLOAD', branch.id, 7); // a second, real run against the same target

    const runs = await prisma.forecastRun.findMany({ where: { targetType: 'GARAGE_WORKLOAD', targetId: branch.id } });
    expect(runs.length).toBeGreaterThanOrEqual(10); // 2 runs x 5 methods each
    for (const run of runs) {
      expect(run.wape).not.toBeNull();
      expect(run.mase).not.toBeNull();
    }
  });

  it('real forecast generation records real observability metrics (executions, duration, confidence, method, accuracy)', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'fc-metrics-1');
    const vehicle = await prisma.vehicle.create({ data: { vin: 'FCMETRVIN000001'.padEnd(17, '0'), brand: 'Test', model: 'Model' } });

    const jobs = [];
    for (let i = 0; i < 30; i++) {
      const openedAt = new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000);
      jobs.push(prisma.garageJob.create({ data: { jobNumber: `JOB-FCMETR-${i}`, vehicleId: vehicle.id, branchId: branch.id, openedAt } }));
    }
    await Promise.all(jobs);

    await forecasting.generate('GARAGE_WORKLOAD', branch.id, 7);

    const text = await metrics.getMetricsText();
    expect(text).toContain('forecast_executions_total');
    expect(text).toContain('forecast_duration_seconds');
    expect(text).toContain('forecast_confidence_total');
    expect(text).toContain('forecast_method_total');
    expect(text).toContain('forecast_accuracy_wape');
  });

  it('a real forecast failure (no historical data) records a real failure metric', async () => {
    const metricsForFailure = new MetricsService();
    const forecastingForFailure = new ForecastingService(prisma, metricsForFailure);
    const { branch } = await createWarehouseFixture(prisma, 'fc-fail-metrics-1');

    await expect(forecastingForFailure.generate('GARAGE_WORKLOAD', branch.id, 30)).rejects.toThrow();

    const text = await metricsForFailure.getMetricsText();
    expect(text).toMatch(/forecast_failures_total\{reason="NO_HISTORICAL_DATA"\} 1/);
  });
});
