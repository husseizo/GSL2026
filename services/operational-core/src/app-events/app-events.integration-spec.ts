import { IntegrationService } from '../integration/integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppEventsService } from './app-events.service';
import { IngestAppEventDto } from './dto/ingest-event.dto';

describe('AppEventsService (integration)', () => {
  let prisma: PrismaService;
  let service: AppEventsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AppEventsService(prisma, new IntegrationService(prisma));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function event(overrides: Partial<IngestAppEventDto> = {}): IngestAppEventDto {
    return {
      sourceEventId: 'evt-dup-test-1',
      eventType: 'SEARCH',
      occurredAt: '2026-02-01T00:00:00Z',
      searchQuery: 'test query',
      ...overrides,
    } as IngestAppEventDto;
  }

  it('does not create a duplicate row when the same sourceEventId is ingested twice', async () => {
    const result1 = await service.ingestBatch('TEST_APP', [event()]);
    expect(result1.accepted).toBe(1);

    const countBefore = await prisma.appEvent.count({ where: { sourceApplication: 'TEST_APP', sourceEventId: 'evt-dup-test-1' } });
    const result2 = await service.ingestBatch('TEST_APP', [event()]); // exact replay
    expect(result2.accepted).toBe(1); // upsert still "succeeds", just doesn't add a row
    const countAfter = await prisma.appEvent.count({ where: { sourceApplication: 'TEST_APP', sourceEventId: 'evt-dup-test-1' } });

    expect(countAfter).toBe(countBefore);
    expect(countAfter).toBe(1);
  });

  it('routes an event with an unknown eventType to the dead-letter store instead of crashing the batch', async () => {
    const result = await service.ingestBatch('TEST_APP', [
      event({ sourceEventId: 'evt-bad-type-1', eventType: 'NOT_A_REAL_TYPE' }),
      event({ sourceEventId: 'evt-good-1' }),
    ]);
    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);

    const deadLetters = await prisma.syncDeadLetter.findMany({ where: { sourceRecordId: 'evt-bad-type-1', entityType: 'APP_EVENT' } });
    expect(deadLetters.length).toBe(1);
  });
});
