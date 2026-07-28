import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    eventType: NotificationEventType;
    jobId?: string;
    vehicleId?: string;
    recipientRole?: string;
    recipientId?: string;
    message: string;
  }) {
    return this.prisma.notificationEvent.create({ data });
  }

  list(filter: { isRead?: boolean; recipientId?: string; jobId?: string }) {
    return this.prisma.notificationEvent.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
  }

  async markRead(id: string) {
    const notification = await this.prisma.notificationEvent.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    return this.prisma.notificationEvent.update({ where: { id }, data: { isRead: true, readAt: new Date() } });
  }

  // Scans for jobs past their reception's expected completion time and
  // creates a JOB_OVERDUE notification — idempotent by checking for an
  // existing unread overdue notification for the same job first.
  async flagOverdueJobs(): Promise<{ flagged: number }> {
    const now = new Date();
    const overdueJobs = await this.prisma.garageJob.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        reception: { expectedCompletionAt: { lt: now } },
      },
    });

    let flagged = 0;
    for (const job of overdueJobs) {
      const existing = await this.prisma.notificationEvent.findFirst({
        where: { jobId: job.id, eventType: NotificationEventType.JOB_OVERDUE, isRead: false },
      });
      if (existing) continue;
      await this.create({
        eventType: NotificationEventType.JOB_OVERDUE,
        jobId: job.id,
        vehicleId: job.vehicleId,
        message: `Job ${job.jobNumber} is overdue against its expected completion time`,
      });
      flagged += 1;
    }
    return { flagged };
  }
}
