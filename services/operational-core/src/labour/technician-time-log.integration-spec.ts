import { DataQualityService } from '../common/data-quality/data-quality.service';
import { PrismaService } from '../prisma/prisma.service';
import { createTechnicianFixture, createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { TechnicianTimeLogService } from './technician-time-log.service';

describe('TechnicianTimeLogService (integration)', () => {
  let prisma: PrismaService;
  let timeLogs: TechnicianTimeLogService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    timeLogs = new TechnicianTimeLogService(prisma, new DataQualityService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setupJobAndTechnician(suffix: string) {
    const { branch } = await createWarehouseFixture(prisma, suffix);
    const vehicle = await createVehicleFixture(prisma, suffix);
    const technician = await createTechnicianFixture(prisma, suffix, branch.id);
    const job = await prisma.garageJob.create({ data: { jobNumber: `JOB-${suffix}`, vehicleId: vehicle.id, branchId: branch.id } });
    return { job, technician };
  }

  it('computes actualMinutes from startedAt to endedAt', async () => {
    const { job, technician } = await setupJobAndTechnician('tlog-1');
    const log = await timeLogs.start({ jobId: job.id, technicianId: technician.id });

    await prisma.technicianTimeLog.update({ where: { id: log.id }, data: { startedAt: new Date(Date.now() - 30 * 60_000) } });
    const ended = await timeLogs.end(log.id);

    expect(ended.actualMinutes).toBeGreaterThanOrEqual(29);
    expect(ended.actualMinutes).toBeLessThanOrEqual(31);
  });

  it('flags an overlapping assignment when a technician starts a second log before ending the first', async () => {
    const { job, technician } = await setupJobAndTechnician('tlog-2');
    const first = await timeLogs.start({ jobId: job.id, technicianId: technician.id });
    await timeLogs.start({ jobId: job.id, technicianId: technician.id }); // overlaps `first`

    const issues = await prisma.dataQualityIssue.findMany({ where: { checkName: 'overlapping_technician_assignment' } });
    expect(issues.length).toBeGreaterThan(0);

    await timeLogs.end(first.id);
  });

  it('rejects ending a time log twice', async () => {
    const { job, technician } = await setupJobAndTechnician('tlog-3');
    const log = await timeLogs.start({ jobId: job.id, technicianId: technician.id });
    await timeLogs.end(log.id);

    await expect(timeLogs.end(log.id)).rejects.toThrow();
  });

  it('pause/resume does not clear the started timestamp', async () => {
    const { job, technician } = await setupJobAndTechnician('tlog-4');
    const log = await timeLogs.start({ jobId: job.id, technicianId: technician.id });

    await timeLogs.pause(log.id);
    const resumed = await timeLogs.resume(log.id);
    expect(resumed.startedAt).toEqual(log.startedAt);
    expect(resumed.pausedAt).toBeNull();
  });
});
