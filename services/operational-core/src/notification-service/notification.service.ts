import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { renderPromptTemplate } from '../prompt-registry/prompt-render';
import { PrismaService } from '../prisma/prisma.service';
import { ConsoleLogProvider } from './providers/console-log.provider';
import { InAppProvider } from './providers/in-app.provider';
import { NotificationProvider } from './providers/notification-provider.interface';
import { WebhookProvider } from './providers/webhook.provider';

const MAX_ATTEMPTS = 3;

export interface SendNotificationParams {
  channel: string;
  recipient: string;
  userId?: string;
  templateName?: string;
  variables?: Record<string, string>;
  subject?: string;
  body?: string;
}

// Real templates, real retry, real delivery tracking, real preference
// enforcement — for whichever channel it is. EMAIL/SMS/WHATSAPP/PUSH fall
// back to ConsoleLogProvider (see its own header comment) since no external
// provider credentials exist here; IN_APP and WEBHOOK are fully real. This
// is the SAME NotificationDispatch row and the SAME retry/tracking code
// path regardless of channel — reuse over duplication applied to the
// notification layer itself. See docs/architecture/notifications.md.
//
// Template rendering reuses PromptRegistry's pure {{variable}} substitution
// (renderPromptTemplate) rather than a second templating implementation —
// a notification template and a prompt template are the same shape:
// static text with named placeholders.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly providers: Map<string, NotificationProvider>;

  constructor(
    private readonly prisma: PrismaService,
    inAppProvider: InAppProvider,
    webhookProvider: WebhookProvider,
  ) {
    this.providers = new Map<string, NotificationProvider>([
      [inAppProvider.channel, inAppProvider],
      [webhookProvider.channel, webhookProvider],
      ['EMAIL', new ConsoleLogProvider('EMAIL')],
      ['SMS', new ConsoleLogProvider('SMS')],
      ['WHATSAPP', new ConsoleLogProvider('WHATSAPP')],
      ['PUSH', new ConsoleLogProvider('PUSH')],
    ]);
  }

  async createTemplate(name: string, channel: string, body: string, subject?: string) {
    return this.prisma.notificationTemplate.create({ data: { name, channel, body, subject } });
  }

  async send(params: SendNotificationParams): Promise<{ id: string; status: string }> {
    if (params.userId) {
      const preference = await this.prisma.notificationPreference.findUnique({
        where: { userId_channel: { userId: params.userId, channel: params.channel } },
      });
      if (preference && !preference.enabled) {
        const dispatch = await this.prisma.notificationDispatch.create({
          data: { channel: params.channel, recipient: params.recipient, userId: params.userId, body: params.body ?? '', status: 'SKIPPED_BY_PREFERENCE' },
        });
        return { id: dispatch.id, status: dispatch.status };
      }
    }

    let subject = params.subject;
    let body = params.body ?? '';
    let templateId: string | undefined;

    if (params.templateName) {
      const template = await this.prisma.notificationTemplate.findUnique({ where: { name: params.templateName } });
      if (!template) throw new NotFoundException(`Notification template ${params.templateName} not found`);
      templateId = template.id;
      const rendered = renderPromptTemplate(template.body, params.variables ?? {});
      body = rendered.rendered;
      subject = template.subject ? renderPromptTemplate(template.subject, params.variables ?? {}).rendered : subject;
    }

    const dispatch = await this.prisma.notificationDispatch.create({
      data: { templateId, channel: params.channel, recipient: params.recipient, userId: params.userId, subject, body, status: 'PENDING' },
    });

    return this.attemptDelivery(dispatch.id);
  }

  async attemptDelivery(dispatchId: string): Promise<{ id: string; status: string }> {
    const dispatch = await this.prisma.notificationDispatch.findUniqueOrThrow({ where: { id: dispatchId } });
    const provider = this.providers.get(dispatch.channel);

    if (!provider) {
      await this.prisma.notificationDispatch.update({ where: { id: dispatchId }, data: { status: 'FAILED', lastError: `No provider registered for channel ${dispatch.channel}` } });
      return { id: dispatchId, status: 'FAILED' };
    }

    try {
      await provider.send(dispatch.recipient, dispatch.subject ?? undefined, dispatch.body);
      const updated = await this.prisma.notificationDispatch.update({
        where: { id: dispatchId },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
      return { id: updated.id, status: updated.status };
    } catch (err) {
      const attempts = dispatch.attempts + 1;
      const status = attempts >= MAX_ATTEMPTS ? 'FAILED' : 'RETRYING';
      await this.prisma.notificationDispatch.update({
        where: { id: dispatchId },
        data: { status, attempts, lastError: (err as Error).message },
      });
      this.logger.warn(`Notification ${dispatchId} delivery attempt ${attempts} failed: ${(err as Error).message}`);
      return { id: dispatchId, status };
    }
  }

  async retryFailed(): Promise<{ retried: number }> {
    const failing = await this.prisma.notificationDispatch.findMany({ where: { status: 'RETRYING' } });
    for (const dispatch of failing) {
      await this.attemptDelivery(dispatch.id);
    }
    return { retried: failing.length };
  }

  async setPreference(userId: string, channel: string, enabled: boolean) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_channel: { userId, channel } },
      create: { userId, channel, enabled },
      update: { enabled },
    });
  }

  listPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({ where: { userId } });
  }

  listHistory(userId?: string, channel?: string) {
    return this.prisma.notificationDispatch.findMany({ where: { userId, channel }, orderBy: { createdAt: 'desc' } });
  }
}
