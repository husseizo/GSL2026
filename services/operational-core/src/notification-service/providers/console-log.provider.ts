import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider } from './notification-provider.interface';

// The honest default for EMAIL/SMS/WHATSAPP/PUSH: this environment has no
// real SMTP server, Twilio account, WhatsApp Business API credentials, or
// FCM/APNs project. Rather than fabricate delivery, this provider logs the
// message and returns success — a real, executed code path (the dispatch
// really is processed, retried on failure, tracked in NotificationDispatch)
// that is honestly NOT external delivery. Supplying real credentials
// (SMTP_HOST/TWILIO_*/WHATSAPP_*/FCM_*) and swapping this provider for a
// real one is a configuration change behind the same NotificationProvider
// interface — see docs/architecture/notifications.md.
@Injectable()
export class ConsoleLogProvider implements NotificationProvider {
  private readonly logger = new Logger('NotificationDelivery');

  constructor(readonly channel: string) {}

  async send(recipient: string, subject: string | undefined, body: string): Promise<void> {
    this.logger.log(`[${this.channel} → ${recipient}] ${subject ? `${subject}: ` : ''}${body}`);
  }
}
