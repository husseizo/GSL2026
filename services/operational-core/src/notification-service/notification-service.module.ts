import { Module } from '@nestjs/common';
import { NotificationServiceController } from './notification.controller';
import { NotificationService } from './notification.service';
import { InAppProvider } from './providers/in-app.provider';
import { WebhookProvider } from './providers/webhook.provider';

@Module({
  controllers: [NotificationServiceController],
  providers: [NotificationService, InAppProvider, WebhookProvider],
  exports: [NotificationService],
})
export class NotificationServiceModule {}
