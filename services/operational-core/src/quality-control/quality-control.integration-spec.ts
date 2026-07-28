import { PrismaService } from '../prisma/prisma.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { QualityControlService } from './quality-control.service';

describe('QualityControlService (integration)', () => {
  let prisma: PrismaService;
  let qc: QualityControlService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    qc = new QualityControlService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setupJob(suffix: string) {
    const { branch } = await createWarehouseFixture(prisma, suffix);
    const vehicle = await createVehicleFixture(prisma, suffix);
    return prisma.garageJob.create({ data: { jobNumber: `JOB-${suffix}`, vehicleId: vehicle.id, branchId: branch.id } });
  }

  it('creates a QC_FAILED notification when an inspection fails', async () => {
    const job = await setupJob('qc-1');
    await qc.createInspection({ jobId: job.id, result: 'FAIL', issues: [{ category: 'LEAK', description: 'Oil leak at drain plug' }] });

    const notifications = await prisma.notificationEvent.findMany({ where: { jobId: job.id, eventType: 'QC_FAILED' } });
    expect(notifications).toHaveLength(1);
  });

  it('creates a ROAD_TEST_REQUIRED notification when an inspection passes', async () => {
    const job = await setupJob('qc-2');
    await qc.createInspection({ jobId: job.id, result: 'PASS' });

    const notifications = await prisma.notificationEvent.findMany({ where: { jobId: job.id, eventType: 'ROAD_TEST_REQUIRED' } });
    expect(notifications).toHaveLength(1);
  });

  it('hasPassed reports true only once a passing inspection, road test, and approval all exist', async () => {
    const job = await setupJob('qc-3');
    expect(await qc.hasPassed(job.id)).toEqual({ hasQualityInspection: false, hasRoadTest: false, isCustomerReady: false });

    await qc.createInspection({ jobId: job.id, result: 'PASS' });
    await qc.createRoadTest({ jobId: job.id, result: 'PASS' });
    await qc.createApproval(job.id, 'user-1');

    expect(await qc.hasPassed(job.id)).toEqual({ hasQualityInspection: true, hasRoadTest: true, isCustomerReady: true });
  });

  it('resolving a quality issue sets resolvedAt', async () => {
    const job = await setupJob('qc-4');
    const inspection = await qc.createInspection({ jobId: job.id, result: 'FAIL', issues: [{ category: 'NOISE', description: 'Belt squeal' }] });

    const resolved = await qc.resolveIssue(inspection.issues[0].id);
    expect(resolved.resolvedAt).not.toBeNull();
  });
});
