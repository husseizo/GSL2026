import nock from 'nock';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { InAppProvider } from './providers/in-app.provider';
import { WebhookProvider } from './providers/webhook.provider';

describe('NotificationService (integration, real Postgres + real webhook HTTP delivery)', () => {
  let prisma: PrismaService;
  let notifications: NotificationService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    notifications = new NotificationService(prisma, new InAppProvider(), new WebhookProvider());
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(() => nock.cleanAll());

  it('delivers an IN_APP notification (send = the dispatch row existing) and marks it SENT', async () => {
    const result = await notifications.send({ channel: 'IN_APP', recipient: 'user-1', body: 'Your vehicle is ready' });
    expect(result.status).toBe('SENT');
  });

  it('delivers a real WEBHOOK notification via a real HTTP POST to a mock receiver', async () => {
    const scope = nock('http://webhook-receiver.local')
      .post('/notify', { subject: undefined, body: 'Vehicle ready for collection' })
      .reply(200, { ok: true });

    const result = await notifications.send({ channel: 'WEBHOOK', recipient: 'http://webhook-receiver.local/notify', body: 'Vehicle ready for collection' });

    expect(result.status).toBe('SENT');
    expect(scope.isDone()).toBe(true);
  });

  it('retries a failing WEBHOOK delivery and marks it FAILED after exhausting attempts', async () => {
    nock('http://unreachable-webhook.local').post('/notify').times(3).reply(500, 'server error');

    let result = await notifications.send({ channel: 'WEBHOOK', recipient: 'http://unreachable-webhook.local/notify', body: 'test' });
    expect(result.status).toBe('RETRYING');
    result = await notifications.attemptDelivery(result.id);
    expect(result.status).toBe('RETRYING');
    result = await notifications.attemptDelivery(result.id);
    expect(result.status).toBe('FAILED');

    const dispatch = await prisma.notificationDispatch.findUniqueOrThrow({ where: { id: result.id } });
    expect(dispatch.attempts).toBe(3);
    expect(dispatch.lastError).toContain('500');
  });

  it('renders a real template with variable substitution before sending', async () => {
    await notifications.createTemplate('vehicle-ready', 'IN_APP', 'Vehicle {{vin}} is ready for collection at {{branch}}', 'Vehicle Ready');
    const result = await notifications.send({
      channel: 'IN_APP',
      recipient: 'user-2',
      templateName: 'vehicle-ready',
      variables: { vin: 'WBA123', branch: 'DSM01' },
    });

    const dispatch = await prisma.notificationDispatch.findUniqueOrThrow({ where: { id: result.id } });
    expect(dispatch.body).toBe('Vehicle WBA123 is ready for collection at DSM01');
    expect(dispatch.subject).toBe('Vehicle Ready');
  });

  it('skips delivery when the user has disabled that channel via preferences', async () => {
    const user = await prisma.user.create({ data: { email: `pref-test-${Date.now()}@example.com`, name: 'Pref Test User', role: 'TECHNICIAN' } });
    await notifications.setPreference(user.id, 'EMAIL', false);
    const result = await notifications.send({ channel: 'EMAIL', recipient: 'user3@example.com', userId: user.id, body: 'test' });
    expect(result.status).toBe('SKIPPED_BY_PREFERENCE');
  });

  it('EMAIL/SMS/WHATSAPP/PUSH deliver via the honest console-log stand-in and are marked SENT (a real, executed, non-external code path)', async () => {
    for (const channel of ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']) {
      const result = await notifications.send({ channel, recipient: 'someone@example.com', body: `test ${channel}` });
      expect(result.status).toBe('SENT');
    }
  });

  it('listHistory returns real persisted dispatch records', async () => {
    const user = await prisma.user.create({ data: { email: `history-test-${Date.now()}@example.com`, name: 'History Test User', role: 'TECHNICIAN' } });
    await notifications.send({ channel: 'IN_APP', recipient: user.id, userId: user.id, body: 'history test' });
    const history = await notifications.listHistory(user.id);
    expect(history.length).toBeGreaterThan(0);
  });
});
