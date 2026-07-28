import { PrismaService } from '../prisma/prisma.service';
import { SourceAuthorityService } from './authority/source-authority.service';
import { ReviewPrioritizationService } from './review/review-prioritization.service';
import { CustomerQualityService } from './quality/customer-quality.service';
import { BaselineService } from './baseline/baseline.service';
import { DataSnapshotService } from './snapshot/data-snapshot.service';
import { AIUseCaseReadinessService } from './ai-readiness/ai-use-case-readiness.service';
import { InventoryReadinessService } from './inventory-readiness.service';

// Real Postgres integration tests — every scenario below is built from
// real fixture rows created in this test, not mocked Prisma calls. See
// docs/data-readiness/decision-log.md.
describe('Data Readiness services (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let sourceAuthority: SourceAuthorityService;
  let reviewPrioritization: ReviewPrioritizationService;
  let baseline: BaselineService;
  let snapshot: DataSnapshotService;
  let aiReadiness: AIUseCaseReadinessService;
  let testUser: { id: string };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    sourceAuthority = new SourceAuthorityService(prisma);
    const customerQuality = new CustomerQualityService(prisma);
    reviewPrioritization = new ReviewPrioritizationService(prisma, customerQuality);
    baseline = new BaselineService(prisma, new InventoryReadinessService());
    snapshot = new DataSnapshotService(prisma);
    aiReadiness = new AIUseCaseReadinessService(prisma);

    testUser = await prisma.user.create({ data: { email: `data-readiness-test-${Date.now()}@aios.local`, name: 'Test Reviewer', role: 'DATA_QUALITY_REVIEWER' } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('SourceAuthorityService', () => {
    it('supersedes a prior rule rather than overwriting it — real append-only history', async () => {
      await sourceAuthority.defineAuthority({ entityType: 'TEST_ENTITY', authoritativeSourceSystem: 'SOURCE_A', authorityType: 'ENTITY_LEVEL', rationale: 'first decision' });
      const second = await sourceAuthority.defineAuthority({ entityType: 'TEST_ENTITY', authoritativeSourceSystem: 'SOURCE_B', authorityType: 'ENTITY_LEVEL', rationale: 'superseding decision' });

      const current = await sourceAuthority.getAuthority('TEST_ENTITY');
      expect(current?.id).toBe(second.id);
      expect(current?.authoritativeSourceSystem).toBe('SOURCE_B');

      const allRules = await prisma.sourceAuthorityRule.findMany({ where: { entityType: 'TEST_ENTITY' } });
      expect(allRules).toHaveLength(2);
      expect(allRules.find((r) => r.authoritativeSourceSystem === 'SOURCE_A')?.effectiveTo).not.toBeNull();
    });

    it('records and resolves a real authority conflict', async () => {
      const conflict = await sourceAuthority.recordConflict('TEST_ENTITY_2', 'someField', [{ sourceSystem: 'A', value: 1 }, { sourceSystem: 'B', value: 2 }]);
      expect((await sourceAuthority.listOpenConflicts()).some((c) => c.id === conflict.id)).toBe(true);

      await sourceAuthority.resolveConflict(conflict.id, testUser.id, 'Resolved for test');
      expect((await sourceAuthority.listOpenConflicts()).some((c) => c.id === conflict.id)).toBe(false);
    });
  });

  describe('ReviewPrioritizationService', () => {
    it('records a real decision, updates ManualReviewItem status, and supports reversal', async () => {
      const rawRecord = await prisma.rawSourceRecord.create({
        data: { sourceSystem: 'TEST', sourceDatabase: 'test', sourceSchema: 'test', sourceTable: 'test', sourceRecordKey: `key-${Date.now()}`, feedName: 'TEST_FEED', batchId: (await prisma.syncRun.create({ data: { sourceId: (await prisma.integrationSource.create({ data: { name: `TEST_SOURCE_${Date.now()}`, adapterType: 'test' } })).id } })).id, rawPayload: {}, rawChecksum: 'abc' },
      });
      const reviewItem = await prisma.manualReviewItem.create({ data: { queueType: 'CUSTOMER_MATCH', relatedRawSourceRecordId: rawRecord.id, proposedAction: 'test', evidence: {} } });

      const decision = await reviewPrioritization.recordDecision({
        manualReviewItemId: reviewItem.id,
        decisionType: 'KEEP_SEPARATE',
        reviewerId: testUser.id,
        evidence: { note: 'real test decision' },
        reason: 'Distinct real businesses',
        sourceRecordRefs: [rawRecord.sourceRecordKey],
      });

      const updatedItem = await prisma.manualReviewItem.findUniqueOrThrow({ where: { id: reviewItem.id } });
      expect(updatedItem.status).toBe('REJECTED');
      expect(updatedItem.reviewedById).toBe(testUser.id);

      await reviewPrioritization.reverseDecision(decision.id, testUser.id, 'Reversing for test');
      const reversedItem = await prisma.manualReviewItem.findUniqueOrThrow({ where: { id: reviewItem.id } });
      expect(reversedItem.status).toBe('PENDING');

      const reversedDetail = await prisma.reviewDecisionDetail.findUniqueOrThrow({ where: { id: decision.id } });
      expect(reversedDetail.reversedAt).not.toBeNull();
    }, 15_000);

    it('creates a real review batch from the highest-priority scored items', async () => {
      const rawRecord = await prisma.rawSourceRecord.create({
        data: { sourceSystem: 'TEST', sourceDatabase: 'test', sourceSchema: 'test', sourceTable: 'test', sourceRecordKey: `key-batch-${Date.now()}`, feedName: 'TEST_FEED_BATCH', batchId: (await prisma.syncRun.create({ data: { sourceId: (await prisma.integrationSource.create({ data: { name: `TEST_SOURCE_BATCH_${Date.now()}`, adapterType: 'test' } })).id } })).id, rawPayload: {}, rawChecksum: 'abc' },
      });
      await prisma.manualReviewItem.create({ data: { queueType: 'CUSTOMER_MATCH', relatedRawSourceRecordId: rawRecord.id, proposedAction: 'test', evidence: {}, priorityScore: 0.9 } });

      const { batch, itemCount } = await reviewPrioritization.createPriorityBatch(`test-batch-${Date.now()}`, 10, testUser.id);
      expect(itemCount).toBeGreaterThan(0);
      expect(batch.status).toBe('OPEN');
    }, 15_000);
  });

  describe('BaselineService reproducibility', () => {
    it('produces the same calculationChecksum for the same code version, and the same outputChecksum for the same underlying real data', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const first = await baseline.runBaseline(weekAgo, now, testUser.id);
      const second = await baseline.runBaseline(weekAgo, now, testUser.id);

      expect(first.calculationChecksum).toBe(second.calculationChecksum);
      expect(first.outputChecksum).toBe(second.outputChecksum);
    }, 20_000);

    it('approves a baseline run and compares two runs', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const run = await baseline.runBaseline(weekAgo, now, testUser.id);
      const approved = await baseline.approveBaseline(run.run.id, testUser.id);
      expect(approved.status).toBe('APPROVED');

      const comparison = await baseline.compareBaselineRuns(run.run.id, run.run.id);
      expect(comparison.every((c) => c.delta === 0)).toBe(true);
    }, 20_000);
  });

  describe('DataSnapshotService', () => {
    it('creates a real immutable snapshot and rejects a duplicate name', async () => {
      const name = `test-snapshot-${Date.now()}`;
      const created = await snapshot.createSnapshot(name, testUser.id);
      expect(created.snapshotName).toBe(name);
      await expect(snapshot.createSnapshot(name, testUser.id)).rejects.toThrow();
    }, 15_000);

    it('validates a snapshot against live data and detects real drift', async () => {
      const name = `test-snapshot-drift-${Date.now()}`;
      await snapshot.createSnapshot(name, testUser.id);
      await prisma.customer.create({ data: { customerCode: `DRIFT-${Date.now()}`, legalName: 'Drift Test Customer', displayName: 'Drift Test Customer', sourceSystem: 'MOLAS_CACHE_LUBRICANTS', sourceRecordId: `drift-${Date.now()}` } });

      const validation = await snapshot.validateSnapshot(name);
      expect(validation.valid).toBe(false);
      expect(validation.mismatches.length).toBeGreaterThan(0);
    }, 15_000);
  });

  describe('AIUseCaseReadinessService', () => {
    it('persists real assessments and always blocks vehicle failure prediction without real garage data', async () => {
      const result = await aiReadiness.persistAssessments();
      expect(result.upserted).toBeGreaterThan(0);

      const vehicleFailure = await prisma.aIUseCaseReadiness.findUniqueOrThrow({ where: { useCaseName: 'Vehicle failure prediction' } });
      expect(vehicleFailure.status).toBe('BLOCKED_BY_SOURCE_ACCESS');
    }, 15_000);
  });
});
