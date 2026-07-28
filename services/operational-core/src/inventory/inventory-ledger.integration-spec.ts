import { MovementDirection, InventoryMovementType } from '@prisma/client';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPartFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ReservationsService } from './reservations.service';

// Real PostgreSQL, not mocks — see docs/architecture/inventory-ledger.md.
// Run with `npm run test:integration` against the dedicated test database.
describe('InventoryLedgerService (integration)', () => {
  let prisma: PrismaService;
  let dataQuality: DataQualityService;
  let ledger: InventoryLedgerService;
  let reservations: ReservationsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    dataQuality = new DataQualityService(prisma);
    ledger = new InventoryLedgerService(prisma, dataQuality);
    reservations = new ReservationsService(prisma, ledger);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('posts a movement and updates the balance projection', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'ledger-1');
    const part = await createPartFixture(prisma, 'ledger-1');

    await ledger.postMovement({
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 10,
      direction: MovementDirection.IN,
      movementType: InventoryMovementType.PURCHASE_RECEIPT,
      occurredAt: new Date(),
    });

    const balance = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(balance.onHand).toBe(10);
    expect(balance.available).toBe(10);
  });

  it('is idempotent: replaying the same sourceSystem+sourceRecordId does not double-count', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'ledger-2');
    const part = await createPartFixture(prisma, 'ledger-2');

    const input = {
      itemType: 'PART' as const,
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 10,
      direction: MovementDirection.IN,
      movementType: InventoryMovementType.PURCHASE_RECEIPT,
      occurredAt: new Date(),
      sourceSystem: 'TEST_ERP',
      sourceRecordId: 'grn-line-1',
    };

    await ledger.postMovement(input);
    await ledger.postMovement(input); // replay
    await ledger.postMovement(input); // replay again

    const movementCount = await prisma.inventoryMovement.count({
      where: { sourceSystem: 'TEST_ERP', sourceRecordId: 'grn-line-1' },
    });
    expect(movementCount).toBe(1);

    const balance = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(balance.onHand).toBe(10); // not 30
  });

  it('flags negative available stock as a data-quality issue rather than silently correcting it', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'ledger-3');
    const part = await createPartFixture(prisma, 'ledger-3');

    await ledger.postMovement({
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 5,
      direction: MovementDirection.IN,
      movementType: InventoryMovementType.OPENING_BALANCE,
      occurredAt: new Date(),
    });

    // Sell more than is on hand (simulating a bad/late import).
    await ledger.postMovement({
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 8,
      direction: MovementDirection.OUT,
      movementType: InventoryMovementType.SALE_ISSUE,
      occurredAt: new Date(),
    });

    const balance = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(balance.onHand).toBe(-3); // preserved, not clamped to 0
    expect(balance.hasNegativeStockIssue).toBe(true);

    const issues = await prisma.dataQualityIssue.findMany({ where: { checkName: 'negative_available_stock', entityType: 'InventoryBalance' } });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('reservation reduces available stock without touching onHand, and release restores it', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'ledger-4');
    const part = await createPartFixture(prisma, 'ledger-4');

    await ledger.postMovement({
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 10,
      direction: MovementDirection.IN,
      movementType: InventoryMovementType.OPENING_BALANCE,
      occurredAt: new Date(),
    });

    const reservation = await reservations.reserve({
      itemType: 'PART',
      partId: part.id,
      warehouseId: warehouse.id,
      quantity: 4,
    });

    const afterReserve = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(afterReserve.onHand).toBe(10);
    expect(afterReserve.reserved).toBe(4);
    expect(afterReserve.available).toBe(6);

    await reservations.release(reservation.id, 'test release');

    const afterRelease = await ledger.getBalance({ itemType: 'PART', partId: part.id }, warehouse.id);
    expect(afterRelease.reserved).toBe(0);
    expect(afterRelease.available).toBe(10);
  });

  it('rejects DAMAGE movements posted with the wrong direction rather than silently corrupting the balance', async () => {
    const { warehouse } = await createWarehouseFixture(prisma, 'ledger-5');
    const part = await createPartFixture(prisma, 'ledger-5');

    await expect(
      ledger.postMovement({
        itemType: 'PART',
        partId: part.id,
        warehouseId: warehouse.id,
        quantity: 1,
        direction: MovementDirection.IN, // DAMAGE must be OUT
        movementType: InventoryMovementType.DAMAGE,
        occurredAt: new Date(),
      }),
    ).rejects.toThrow();
  });
});
