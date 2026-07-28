import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { NotificationService, SendNotificationParams } from './notification.service';

@ApiTags('notification-service')
@Controller('notification-service')
@UseGuards(PermissionsGuard)
export class NotificationServiceController {
  constructor(private readonly notifications: NotificationService) {}

  @Post('templates')
  @RequirePermissions('notifications.manage')
  createTemplate(@Body() body: { name: string; channel: string; body: string; subject?: string }) {
    return this.notifications.createTemplate(body.name, body.channel, body.body, body.subject);
  }

  @Post('send')
  @RequirePermissions('notifications.manage')
  send(@Body() body: SendNotificationParams) {
    return this.notifications.send(body);
  }

  @Post('retry-failed')
  @RequirePermissions('notifications.manage')
  retryFailed() {
    return this.notifications.retryFailed();
  }

  @Put('preferences/:userId/:channel')
  @RequirePermissions('notifications.manage')
  setPreference(@Param('userId') userId: string, @Param('channel') channel: string, @Body() body: { enabled: boolean }) {
    return this.notifications.setPreference(userId, channel, body.enabled);
  }

  @Get('preferences/:userId')
  @RequirePermissions('notifications.read')
  listPreferences(@Param('userId') userId: string) {
    return this.notifications.listPreferences(userId);
  }

  @Get('history')
  @RequirePermissions('notifications.read')
  history(@Query('userId') userId?: string, @Query('channel') channel?: string) {
    return this.notifications.listHistory(userId, channel);
  }
}
