import { PrismaService } from '../prisma/prisma.service';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { QualityControlService } from '../quality-control/quality-control.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { GarageJobsService } from './garage-jobs.service';
import { IllegalJobTransitionError } from './job-workflow';

describe('GarageJobsService (integration)', () => {
  let prisma: PrismaService;
  let jobs: GarageJobsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const dataQuality = new DataQualityService(prisma);
    const qc = new QualityControlService(prisma);
    jobs = new GarageJobsService(prisma, dataQuality, qc);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a job in DRAFT status with an initial JobStatusHistory row', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'job-1');
    const vehicle = await createVehicleFixture(prisma, 'job-1');

    const job = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id });
    expect(job.status).toBe('DRAFT');

    const history = await prisma.jobStatusHistory.findMany({ where: { jobId: job.id } });
    expect(history).toHaveLength(1);
    expect(history[0].previousStatus).toBeNull();
    expect(history[0].newStatus).toBe('DRAFT');
  });

  it('rejects an illegal transition and leaves the job status unchanged', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'job-2');
    const vehicle = await createVehicleFixture(prisma, 'job-2');
    const job = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id });

    await expect(jobs.transition(job.id, { newStatus: 'COMPLETED' })).rejects.toBeInstanceOf(IllegalJobTransitionError);

    const unchanged = await jobs.findById(job.id);
    expect(unchanged.status).toBe('DRAFT');
  });

  it('accumulates one JobStatusHistory row per transition — immutable, never edited in place', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'job-3');
    const vehicle = await createVehicleFixture(prisma, 'job-3');
    const job = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id });

    await jobs.transition(job.id, { newStatus: 'CHECKED_IN', reason: 'arrived' });
    await jobs.transition(job.id, { newStatus: 'WAITING_INSPECTION' });
    await jobs.transition(job.id, { newStatus: 'CANCELLED', reason: 'customer changed mind' });

    const history = await prisma.jobStatusHistory.findMany({ where: { jobId: job.id }, orderBy: { changedAt: 'asc' } });
    expect(history.map((h) => h.newStatus)).toEqual(['DRAFT', 'CHECKED_IN', 'WAITING_INSPECTION', 'CANCELLED']);
    expect(history[history.length - 1].previousStatus).toBe('WAITING_INSPECTION');
  });

  it('flags a duplicate job card when the vehicle already has an open job', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'job-4');
    const vehicle = await createVehicleFixture(prisma, 'job-4');

    const first = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id });
    await jobs.create({ vehicleId: vehicle.id, branchId: branch.id }); // duplicate while `first` is still open

    const issues = await prisma.dataQualityIssue.findMany({ where: { checkName: 'duplicate_job_card', entityId: first.id } });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags a vehicle mismatch when the job vehicle differs from its reception vehicle', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'job-5');
    const vehicleA = await createVehicleFixture(prisma, 'job-5a');
    const vehicleB = await createVehicleFixture(prisma, 'job-5b');
    const reception = await prisma.vehicleReception.create({ data: { vehicleId: vehicleA.id, branchId: branch.id, mileage: 1000 } });

    await jobs.create({ vehicleId: vehicleB.id, branchId: branch.id, receptionId: reception.id });

    const issues = await prisma.dataQualityIssue.findMany({ where: { checkName: 'vehicle_mismatch' } });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags missing QC/road-test/estimate-approval when a job reaches READY_FOR_COLLECTION without them', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'job-6');
    const vehicle = await createVehicleFixture(prisma, 'job-6');
    const job = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id });

    for (const status of [
      'CHECKED_IN',
      'WAITING_INSPECTION',
      'INSPECTION_IN_PROGRESS',
      'WAITING_ESTIMATE',
      'WAITING_CUSTOMER_APPROVAL',
      'APPROVED',
      'READY_TO_START',
      'IN_PROGRESS',
      'QUALITY_CONTROL',
      'ROAD_TEST',
      'READY_FOR_COLLECTION',
    ] as const) {
      await jobs.transition(job.id, { newStatus: status });
    }

    const [missingQc, missingRoadTest, missingEstimate] = await Promise.all([
      prisma.dataQualityIssue.count({ where: { checkName: 'missing_quality_control', entityId: job.id } }),
      prisma.dataQualityIssue.count({ where: { checkName: 'missing_road_test', entityId: job.id } }),
      prisma.dataQualityIssue.count({ where: { checkName: 'missing_estimate_approval', entityId: job.id } }),
    ]);
    expect(missingQc).toBeGreaterThan(0);
    expect(missingRoadTest).toBeGreaterThan(0);
    expect(missingEstimate).toBeGreaterThan(0);
  });

  it('addLine rejects negative quantity/unit price', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'job-7');
    const vehicle = await createVehicleFixture(prisma, 'job-7');
    const job = await jobs.create({ vehicleId: vehicle.id, branchId: branch.id });

    await expect(
      jobs.addLine(job.id, { lineType: 'LABOUR', description: 'bad line', quantity: -1, unitPrice: 100 }),
    ).rejects.toThrow();
  });
});
