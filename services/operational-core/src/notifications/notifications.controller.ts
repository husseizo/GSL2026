import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationEventType } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @RequirePermissions('notifications.manage')
  create(
    @Body()
    body: { eventType: NotificationEventType; jobId?: string; vehicleId?: string; recipientRole?: string; recipientId?: string; message: string },
  ) {
    return this.notifications.create(body);
  }

  @Get()
  @RequirePermissions('notifications.read')
  list(@Query('isRead') isRead?: string, @Query('recipientId') recipientId?: string, @Query('jobId') jobId?: string) {
    return this.notifications.list({
      isRead: isRead === undefined ? undefined : isRead === 'true',
      recipientId,
      jobId,
    });
  }

  @Patch(':id/read')
  @RequirePermissions('notifications.manage')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('flag-overdue-jobs')
  @RequirePermissions('notifications.manage')
  flagOverdueJobs() {
    return this.notifications.flagOverdueJobs();
  }
}
