import { Injectable } from '@nestjs/common';
import { NotificationProvider } from './notification-provider.interface';

// Real HTTP delivery — recipient is a URL, POSTed a real JSON body. Genuinely
// testable against a local mock receiver (nock), unlike Email/SMS/WhatsApp/
// Push, which need real external provider credentials this environment
// doesn't have.
@Injectable()
export class WebhookProvider implements NotificationProvider {
  readonly channel = 'WEBHOOK';

  async send(recipient: string, subject: string | undefined, body: string): Promise<void> {
    const res = await fetch(recipient, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    if (!res.ok) {
      throw new Error(`Webhook delivery to ${recipient} failed: ${res.status} ${await res.text()}`);
    }
  }
}
