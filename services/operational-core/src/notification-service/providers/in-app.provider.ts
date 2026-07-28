import { Injectable } from '@nestjs/common';
import { NotificationProvider } from './notification-provider.interface';

// In-app delivery IS the NotificationDispatch row existing — there's
// nowhere else to "send" it, the portal/PWA reads the row directly. Real,
// not a stub: the correct implementation of this channel is a no-op send.
@Injectable()
export class InAppProvider implements NotificationProvider {
  readonly channel = 'IN_APP';

  async send(): Promise<void> {
    // Intentionally empty — see class comment.
  }
}
