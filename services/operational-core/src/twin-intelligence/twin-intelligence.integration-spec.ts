import { PrismaService } from '../prisma/prisma.service';
import { createPartFixture, createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { VehicleDigitalTwinService } from '../vehicle-lifecycle/digital-twin.service';

describe('Digital Twin Intelligence (integration)', () => {
  let prisma: PrismaService;
  let digitalTwin: VehicleDigitalTwinService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    digitalTwin = new VehicleDigitalTwinService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports full health (100) and INSUFFICIENT_HISTORY confidence for a vehicle with no history', async () => {
    const vehicle = await createVehicleFixture(prisma, 'twinintel-1');
    const twin = await digitalTwin.getDigitalTwin(vehicle.id);

    expect(twin.healthScore).toBe(100);
    expect(twin.maintenanceRiskScore).toBe(0);
    expect(twin.aiConfidenceScore).toBe('INSUFFICIENT_HISTORY');
    expect(twin.predictedMaintenance).toEqual([]);
    expect(twin.predictedFutureParts).toEqual([]);
  });

  it('raises BRAKE system risk and lowers health score after repeated brake-related DTCs', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'twinintel-2');
    const vehicle = await createVehicleFixture(prisma, 'twinintel-2');

    for (let i = 0; i < 3; i++) {
      const job = await prisma.garageJob.create({
        data: { jobNumber: `JOB-TWIN2-${i}`, vehicleId: vehicle.id, branchId: branch.id },
      });
      const session = await prisma.diagnosticSession.create({ data: { jobId: job.id } });
      await prisma.diagnosticCode.create({
        data: { sessionId: session.id, code: 'C1201', source: 'GENERIC_OBD', description: 'Brake caliper fault detected' },
      });
    }

    const twin = await digitalTwin.getDigitalTwin(vehicle.id);
    expect(twin.systemRisks.BRAKE.riskLevel).toBe('HIGH');
    expect(twin.systemRisks.BRAKE.evidenceCount).toBe(3);
    expect(twin.healthScore).toBeLessThan(100);
    expect(twin.predictedMaintenance.some((m: { system: string }) => m.system === 'BRAKE')).toBe(true);
  });

  it('predicts the next replacement for a part replaced twice, citing the real average interval', async () => {
    const { branch, warehouse } = await createWarehouseFixture(prisma, 'twinintel-3');
    const vehicle = await createVehicleFixture(prisma, 'twinintel-3');
    const part = await createPartFixture(prisma, 'twinintel-3');

    const job1 = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TWIN3-1', vehicleId: vehicle.id, branchId: branch.id, warehouseId: warehouse.id } });
    const job2 = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TWIN3-2', vehicleId: vehicle.id, branchId: branch.id, warehouseId: warehouse.id } });

    const line1 = await prisma.garageJobLine.create({
      data: { jobId: job1.id, lineType: 'PART', description: 'Ignition coil', partId: part.id, quantity: 1, unitPrice: 50000, lineTotal: 50000 },
    });
    await prisma.garageJobLine.update({ where: { id: line1.id }, data: { createdAt: new Date('2025-01-01') } });

    const line2 = await prisma.garageJobLine.create({
      data: { jobId: job2.id, lineType: 'PART', description: 'Ignition coil', partId: part.id, quantity: 1, unitPrice: 50000, lineTotal: 50000 },
    });
    await prisma.garageJobLine.update({ where: { id: line2.id }, data: { createdAt: new Date('2025-07-01') } });

    const twin = await digitalTwin.getDigitalTwin(vehicle.id);
    expect(twin.predictedFutureParts).toHaveLength(1);
    expect(twin.predictedFutureParts[0].occurrenceCount).toBe(2);
    expect(twin.predictedFutureParts[0].averageIntervalDays).toBeGreaterThan(150);
    expect(new Date(twin.predictedFutureParts[0].predictedNextDate).getTime()).toBeGreaterThan(new Date('2025-07-01').getTime());
  });

  it('raises warranty risk score for a vehicle with a confirmed warranty-candidate repeat repair', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'twinintel-4');
    const vehicle = await createVehicleFixture(prisma, 'twinintel-4');
    const job1 = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TWIN4-1', vehicleId: vehicle.id, branchId: branch.id, isWarranty: true } });
    const job2 = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TWIN4-2', vehicleId: vehicle.id, branchId: branch.id, isWarranty: true } });

    await prisma.repeatRepairFlag.create({
      data: { vehicleId: vehicle.id, jobId: job2.id, relatedJobId: job1.id, matchReason: 'SAME_DTC', status: 'WARRANTY_CANDIDATE' },
    });

    const twin = await digitalTwin.getDigitalTwin(vehicle.id);
    expect(twin.warrantyRiskScore).toBeGreaterThan(0);
  });
});
