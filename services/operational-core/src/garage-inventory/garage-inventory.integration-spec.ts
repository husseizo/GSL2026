import { DataQualityService } from '../common/data-quality/data-quality.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { ReservationsService } from '../inventory/reservations.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPartFixture, createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { GarageInventoryService } from './garage-inventory.service';

// Exercises the Phase 3 core architectural rule for real: every assertion
// here checks the Phase 2 InventoryBalance/InventoryMovement rows that
// GarageInventoryService produces by calling Phase 2 services, not any
// inventory-mutating code of its own.
describe('GarageInventoryService (integration)', () => {
  let prisma: PrismaService;
  let garageInventory: GarageInventoryService;
  let ledger: InventoryLedgerService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const dataQuality = new DataQualityService(prisma);
    ledger = new InventoryLedgerService(prisma, dataQuality);
    const reservations = new ReservationsService(prisma, ledger);
    garageInventory = new GarageInventoryService(prisma, reservations, ledger, dataQuality);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function setupJobWithStock(suffix: string, openingQty = 10) {
    const { branch, warehouse } = await createWarehouseFixture(prisma, suffix);
    const vehicle = await createVehicleFixture(prisma, suffix);
    const part = await createPartFixture(prisma, suffix);
    const job = await prisma.garageJob.create({
      data: { jobNumber: `JOB-${suffix}`, vehicleId: vehicle.id, branchId: branch.id, warehouseId: warehouse.id },
    });
    await ledger.postMovement({
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: openingQty,
      direction: 'IN',
      movementType: 'OPENING_BALANCE',
      occurredAt: new Date(),
    });
    return { branch, warehouse, vehicle, part, job };
  }

  it('reserving a part increases `reserved` without touching `onHand`', async () => {
    const { warehouse, part, job } = await setupJobWithStock('ginv-1');

    await garageInventory.reservePart(job.id, {
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 3,
      description: 'Test part',
    });

    const balance = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(balance.onHand).toBe(10);
    expect(balance.reserved).toBe(3);
    expect(balance.available).toBe(7);
  });

  it('issuing a reserved line posts a GARAGE_ISSUE movement and reduces onHand', async () => {
    const { warehouse, part, job } = await setupJobWithStock('ginv-2');
    const { line } = await garageInventory.reservePart(job.id, {
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 4,
      description: 'Test part',
    });

    const movement = await garageInventory.issue(line.id);
    expect(movement.movementType).toBe('GARAGE_ISSUE');

    const balance = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(balance.onHand).toBe(6); // 10 - 4
    expect(balance.reserved).toBe(0); // consumed
    expect(balance.available).toBe(6);
  });

  it('returning an unused unit posts an ADJUSTMENT_IN and restores onHand', async () => {
    const { warehouse, part, job } = await setupJobWithStock('ginv-3');
    const { line } = await garageInventory.reservePart(job.id, {
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 2,
      description: 'Test part',
    });
    await garageInventory.issue(line.id);

    const movement = await garageInventory.returnUnused(line.id, 1, 'Unused unit returned to shelf');
    expect(movement.movementType).toBe('ADJUSTMENT_IN');

    const balance = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(balance.onHand).toBe(9); // 10 - 2 (issued) + 1 (returned)
  });

  it('releasing a reservation restores available stock without any onHand movement', async () => {
    const { warehouse, part, job } = await setupJobWithStock('ginv-4');
    const { line } = await garageInventory.reservePart(job.id, {
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 5,
      description: 'Test part',
    });

    await garageInventory.releaseReservation(line.id, 'No longer needed');

    const balance = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(balance.onHand).toBe(10); // unchanged
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(10);
  });

  it('flags a duplicate reservation for the same job/item/warehouse', async () => {
    const { warehouse, part, job } = await setupJobWithStock('ginv-5');

    await garageInventory.reservePart(job.id, { itemType: 'PART', partId: part.id, warehouseId: warehouse.id, quantity: 1, description: 'first' });
    await garageInventory.reservePart(job.id, { itemType: 'PART', partId: part.id, warehouseId: warehouse.id, quantity: 1, description: 'duplicate' });

    const issues = await prisma.dataQualityIssue.findMany({ where: { checkName: 'duplicate_reservation' } });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('rejects issuing a job line that has no linked reservation', async () => {
    const { job } = await setupJobWithStock('ginv-6');
    const orphanLine = await prisma.garageJobLine.create({
      data: { jobId: job.id, lineType: 'PART', description: 'orphan', quantity: 1, unitPrice: 0, lineTotal: 0 },
    });

    await expect(garageInventory.issue(orphanLine.id)).rejects.toThrow();
  });
});
