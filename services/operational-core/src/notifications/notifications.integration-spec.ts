import { PrismaService } from '../prisma/prisma.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { NotificationsService } from './notifications.service';

describe('NotificationsService (integration)', () => {
  let prisma: PrismaService;
  let notifications: NotificationsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    notifications = new NotificationsService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('flags an overdue job exactly once across repeated scans', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'notif-1');
    const vehicle = await createVehicleFixture(prisma, 'notif-1');
    const reception = await prisma.vehicleReception.create({
      data: { vehicleId: vehicle.id, branchId: branch.id, mileage: 1000, expectedCompletionAt: new Date(Date.now() - 86_400_000) },
    });
    await prisma.garageJob.create({
      data: { jobNumber: 'JOB-NOTIF-1', vehicleId: vehicle.id, branchId: branch.id, receptionId: reception.id },
    });

    const first = await notifications.flagOverdueJobs();
    const second = await notifications.flagOverdueJobs();

    expect(first.flagged).toBe(1);
    expect(second.flagged).toBe(0); // already has an unread JOB_OVERDUE notification

    const count = await prisma.notificationEvent.count({ where: { eventType: 'JOB_OVERDUE' } });
    expect(count).toBe(1);
  });

  it('markRead sets isRead and readAt', async () => {
    const notification = await notifications.create({ eventType: 'VEHICLE_READY', message: 'test' });
    const marked = await notifications.markRead(notification.id);
    expect(marked.isRead).toBe(true);
    expect(marked.readAt).not.toBeNull();
  });
});
