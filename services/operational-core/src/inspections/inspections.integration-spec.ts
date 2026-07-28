import { PrismaService } from '../prisma/prisma.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { InspectionsService } from './inspections.service';

describe('InspectionsService (integration)', () => {
  let prisma: PrismaService;
  let inspections: InspectionsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    inspections = new InspectionsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('re-recording a result for the same job+item upserts in place rather than duplicating', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'insp-1');
    const vehicle = await createVehicleFixture(prisma, 'insp-1');
    const job = await prisma.garageJob.create({ data: { jobNumber: 'JOB-INSP-1', vehicleId: vehicle.id, branchId: branch.id } });
    const template = await inspections.createTemplate({ name: 'T', sections: [{ name: 'Engine', items: [{ label: 'Belt' }] }] });
    const itemId = template.sections[0].items[0].id;

    await inspections.recordResult(job.id, { itemId, finding: 'WARNING' });
    await inspections.recordResult(job.id, { itemId, finding: 'FAIL', severity: 'HIGH' }); // correction, not a duplicate

    const results = await prisma.inspectionResult.findMany({ where: { jobId: job.id, itemId } });
    expect(results).toHaveLength(1);
    expect(results[0].finding).toBe('FAIL');
    expect(results[0].severity).toBe('HIGH');
  });

  it('listFailedForJob returns only FAIL findings', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'insp-2');
    const vehicle = await createVehicleFixture(prisma, 'insp-2');
    const job = await prisma.garageJob.create({ data: { jobNumber: 'JOB-INSP-2', vehicleId: vehicle.id, branchId: branch.id } });
    const template = await inspections.createTemplate({
      name: 'T2',
      sections: [{ name: 'Brakes', items: [{ label: 'Front pads' }, { label: 'Rear pads' }] }],
    });
    const [front, rear] = template.sections[0].items;

    await inspections.recordResult(job.id, { itemId: front.id, finding: 'FAIL' });
    await inspections.recordResult(job.id, { itemId: rear.id, finding: 'PASS' });

    const failed = await inspections.listFailedForJob(job.id);
    expect(failed).toHaveLength(1);
    expect(failed[0].itemId).toBe(front.id);
  });
});
