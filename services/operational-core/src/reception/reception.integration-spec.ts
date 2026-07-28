import { DataQualityService } from '../common/data-quality/data-quality.service';
import { PrismaService } from '../prisma/prisma.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { ReceptionService } from './reception.service';

describe('ReceptionService (integration)', () => {
  let prisma: PrismaService;
  let reception: ReceptionService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    reception = new ReceptionService(prisma, new DataQualityService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a reception with nested conditions, complaints, and accessories', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'recep-1');
    const vehicle = await createVehicleFixture(prisma, 'recep-1');

    const created = await reception.create({
      vehicleId: vehicle.id,
      branchId: branch.id,
      mileage: 10000,
      conditions: [{ area: 'TYRE_FRONT_LEFT', condition: 'Worn' }],
      complaints: [{ description: 'Brake squeal' }],
      accessories: [{ description: 'Umbrella' }],
    });

    expect(created.conditions).toHaveLength(1);
    expect(created.complaints).toHaveLength(1);
    expect(created.accessories).toHaveLength(1);
  });

  it('flags an impossible mileage decrease against the vehicle\'s prior maximum', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'recep-2');
    const vehicle = await createVehicleFixture(prisma, 'recep-2');

    await reception.create({ vehicleId: vehicle.id, branchId: branch.id, mileage: 50000 });
    await reception.create({ vehicleId: vehicle.id, branchId: branch.id, mileage: 49000 }); // lower — should flag

    const issues = await prisma.dataQualityIssue.findMany({ where: { checkName: 'impossible_mileage_decrease' } });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('does not flag a normal mileage increase', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'recep-3');
    const vehicle = await createVehicleFixture(prisma, 'recep-3');

    await reception.create({ vehicleId: vehicle.id, branchId: branch.id, mileage: 20000 });
    const before = await prisma.dataQualityIssue.count({ where: { checkName: 'impossible_mileage_decrease' } });
    await reception.create({ vehicleId: vehicle.id, branchId: branch.id, mileage: 21000 });
    const after = await prisma.dataQualityIssue.count({ where: { checkName: 'impossible_mileage_decrease' } });

    expect(after).toBe(before);
  });

  it('records a returned accessory with a timestamp', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'recep-4');
    const vehicle = await createVehicleFixture(prisma, 'recep-4');
    const created = await reception.create({
      vehicleId: vehicle.id,
      branchId: branch.id,
      mileage: 5000,
      accessories: [{ description: 'Sunglasses' }],
    });

    const returned = await reception.returnAccessory(created.accessories[0].id);
    expect(returned.returnedAt).not.toBeNull();
  });
});
