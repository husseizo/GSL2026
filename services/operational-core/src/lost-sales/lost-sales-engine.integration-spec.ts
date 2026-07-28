import { AppEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LostSalesEngineService } from './lost-sales-engine.service';
import { DEFAULT_LOST_SALES_CONFIG } from './lost-sales.config';

describe('LostSalesEngineService (integration)', () => {
  let prisma: PrismaService;
  let engine: LostSalesEngineService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    engine = new LostSalesEngineService(prisma, DEFAULT_LOST_SALES_CONFIG);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('deduplicates repeated log events in the same session into a single candidate', async () => {
    const sessionId = 'session-dedup-test-1';
    const now = new Date('2026-03-01T10:00:00Z');

    // Two OUT_OF_STOCK_VIEW events for the same item, same session, close together.
    const eventA = await prisma.appEvent.create({
      data: {
        sourceApplication: 'TEST_APP',
        sourceEventId: 'dedup-evt-1',
        eventType: AppEventType.OUT_OF_STOCK_VIEW,
        occurredAt: now,
        sessionId,
        itemCode: 'OEM-DEDUP-1',
        checksum: 'x',
      },
    });
    const eventB = await prisma.appEvent.create({
      data: {
        sourceApplication: 'TEST_APP',
        sourceEventId: 'dedup-evt-2',
        eventType: AppEventType.OUT_OF_STOCK_VIEW,
        occurredAt: new Date(now.getTime() + 60_000),
        sessionId,
        itemCode: 'OEM-DEDUP-1',
        checksum: 'x',
      },
    });

    const result = await engine.detect(now);
    expect(result.eventsScanned).toBeGreaterThanOrEqual(2);

    const candidates = await prisma.lostSaleCandidate.findMany({
      where: { evidence: { some: { appEventId: { in: [eventA.id, eventB.id] } } } },
    });
    expect(candidates.length).toBe(1); // one candidate, not two

    const evidenceCount = await prisma.lostSaleEvidence.count({ where: { lostSaleCandidateId: candidates[0].id } });
    expect(evidenceCount).toBe(2); // both events attached as evidence to the same candidate
  });

  it('creates a human-recorded manual lost sale with HIGH confidence and no log evidence required', async () => {
    const candidate = await engine.recordManual({ requestedQuantity: 1, estimatedValue: 5000, note: 'Customer called in' });
    expect(candidate.confidence).toBe('HIGH');
    expect(candidate.reason).toBe('MANUAL_REPORT');
  });

  // AI Foundation Certification Sprint — Phase II Sprint 2. Real coverage
  // for detection paths this file did not previously exercise: direct
  // ZERO_RESULT_SEARCH triggers, and the repeated-search-without-order
  // pattern (detectRepeatedSearches()). See
  // docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md §5/§11.
  it('detects a real ZERO_RESULT_SEARCH event as a direct-trigger candidate', async () => {
    const event = await prisma.appEvent.create({
      data: {
        sourceApplication: 'TEST_APP',
        sourceEventId: 'zero-result-evt-1',
        eventType: AppEventType.ZERO_RESULT_SEARCH,
        occurredAt: new Date('2026-03-02T10:00:00Z'),
        sessionId: 'session-zero-result-1',
        searchQuery: 'nonexistent part xyz',
        checksum: 'x',
      },
    });

    await engine.detect(new Date('2026-03-02T09:00:00Z'));

    const evidence = await prisma.lostSaleEvidence.findFirst({ where: { appEventId: event.id }, include: { lostSaleCandidate: true } });
    expect(evidence).not.toBeNull();
    expect(evidence!.lostSaleCandidate.reason).toBe('ZERO_RESULT_SEARCH');
  });

  it('detects a real repeated-search-with-no-sale pattern (3+ identical searches, same session, no order)', async () => {
    const sessionId = 'session-repeated-search-1';
    const query = 'brake pad set';
    const base = new Date('2026-03-03T10:00:00Z');

    for (let i = 0; i < 3; i++) {
      await prisma.appEvent.create({
        data: {
          sourceApplication: 'TEST_APP',
          sourceEventId: `repeated-search-evt-${i}`,
          eventType: AppEventType.SEARCH,
          occurredAt: new Date(base.getTime() + i * 60_000),
          sessionId,
          searchQuery: query,
          checksum: 'x',
        },
      });
    }

    await engine.detect(base);

    const candidate = await prisma.lostSaleCandidate.findFirst({ where: { reason: 'REPEATED_SEARCH_NO_SALE', rawQuery: query } });
    expect(candidate).not.toBeNull();

    const evidenceCount = await prisma.lostSaleEvidence.count({ where: { lostSaleCandidateId: candidate!.id } });
    expect(evidenceCount).toBe(3); // all 3 repeated searches attached as evidence
  });

  it('does not flag a repeated-search session that ended in a real order', async () => {
    const sessionId = 'session-repeated-search-converted-1';
    const query = 'oil filter';
    const base = new Date('2026-03-04T10:00:00Z');

    for (let i = 0; i < 3; i++) {
      await prisma.appEvent.create({
        data: {
          sourceApplication: 'TEST_APP',
          sourceEventId: `repeated-search-converted-evt-${i}`,
          eventType: AppEventType.SEARCH,
          occurredAt: new Date(base.getTime() + i * 60_000),
          sessionId,
          searchQuery: query,
          checksum: 'x',
        },
      });
    }
    await prisma.appEvent.create({
      data: {
        sourceApplication: 'TEST_APP',
        sourceEventId: 'repeated-search-converted-order-1',
        eventType: AppEventType.ORDER_CREATED,
        occurredAt: new Date(base.getTime() + 4 * 60_000),
        sessionId,
        checksum: 'x',
      },
    });

    await engine.detect(base);

    const candidate = await prisma.lostSaleCandidate.findFirst({ where: { reason: 'REPEATED_SEARCH_NO_SALE', rawQuery: query } });
    expect(candidate).toBeNull(); // the session did convert, so no lost sale is recorded
  });
});
