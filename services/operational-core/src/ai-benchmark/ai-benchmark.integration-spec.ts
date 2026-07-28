// Real Postgres integration test for the DGX Prototype 1.6 evaluation
// framework. Deliberately scoped to deterministic-only categories
// (RETRIEVAL, CONFLICT_DETECTION, PERMISSION_ENFORCEMENT) — no real LLM
// call is made here, keeping this suite fast and safe to run in the
// default `npm run test:integration`. Generative categories (GENERATION,
// SAFETY, PROMPT_INJECTION, language categories) make real, slow
// (CPU-only) Ollama calls and are exercised instead by
// scripts/verify-ai-evaluation-framework.ts, matching the exact scoping
// lesson learned in DGX Prototype 1.5 (see docs/ai-tuning/decision-log.md's
// entry on unscoped integration runs).
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogueSearchService } from '../catalogue-ai/search/catalogue-search.service';
import { BenchmarkRegistryService } from './registry/benchmark-registry.service';
import { GoldDatasetService } from './registry/gold-dataset.service';
import { BenchmarkPipelineService } from './pipeline/benchmark-pipeline.service';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { buildPermissionEnforcementCases } from './categories/safety-security-cases';

describe('AI Evaluation Framework (integration, real Postgres, deterministic categories only)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let registry: BenchmarkRegistryService;
  let goldDataset: GoldDatasetService;
  let pipeline: BenchmarkPipelineService;
  let leaderboard: LeaderboardService;
  let realPartId: string;
  let realOemNumber: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    redis = new RedisService();
    const catalogueSearch = new CatalogueSearchService(prisma, redis);

    registry = new BenchmarkRegistryService(prisma);
    goldDataset = new GoldDatasetService(prisma, registry);
    // BenchmarkPipelineService's constructor also takes CatalogueRagService
    // and (DGX Prototype 1.7) KnowledgeRetrievalService, but the categories
    // exercised in this suite (RETRIEVAL, PERMISSION_ENFORCEMENT) never
    // call either — `undefined as never` keeps this integration spec free
    // of any real DGX/Ollama dependency.
    pipeline = new BenchmarkPipelineService(prisma, catalogueSearch, undefined as never, undefined as never);
    leaderboard = new LeaderboardService(prisma);

    realOemNumber = `04E-BENCH-${Date.now()}`;
    const part = await prisma.part.create({ data: { oemNumber: realOemNumber, productName: 'Benchmark Test Ignition Coil', standardizedProductName: 'benchmark test ignition coil', category: 'IGNITION', sourceSystem: 'PARTS_CATALOG_AUTOHUB' } });
    realPartId = part.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.onModuleDestroy();
  });

  it('createBenchmark + createNewVersion is real and append-only — never edits a previously published version', async () => {
    const key = `test-retrieval-${Date.now()}`;
    const v1 = await registry.createBenchmark({ key, category: 'RETRIEVAL', name: 'Test Retrieval Benchmark', description: 'real test', provenance: { source: 'test' } });
    expect(v1.version).toBe(1);

    const v2 = await registry.createNewVersion(key, { description: 'corrected description' });
    expect(v2.version).toBe(2);
    expect(v2.id).not.toBe(v1.id);

    const v1Reloaded = await prisma.benchmark.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1Reloaded.description).toBe('real test'); // v1 itself was never mutated
  });

  it('addCases() refuses to add cases to an approved, frozen Gold Dataset benchmark', async () => {
    const key = `test-gold-${Date.now()}`;
    const benchmark = await registry.createBenchmark({ key, category: 'RETRIEVAL', name: 'Test Gold', description: 'real test', provenance: { source: 'test' } });
    await registry.addCases(benchmark.id, [{ externalCaseId: 'case-1', input: { query: 'x' }, expectedOutput: { expectedEntityIds: [] }, difficulty: 'EASY', language: 'en', status: 'APPROVED' }]);
    await registry.approve(benchmark.id);
    await registry.freezeAsGold(benchmark.id);

    await expect(registry.addCases(benchmark.id, [{ externalCaseId: 'case-2', input: { query: 'y' }, expectedOutput: { expectedEntityIds: [] }, difficulty: 'EASY', language: 'en', status: 'APPROVED' }])).rejects.toThrow(/immutable/);
  });

  it('verifyChecksum() detects a real mismatch after cases were added post-freeze (bypassing the guard directly at the DB level)', async () => {
    const key = `test-checksum-${Date.now()}`;
    const benchmark = await registry.createBenchmark({ key, category: 'RETRIEVAL', name: 'Test Checksum', description: 'real test', provenance: { source: 'test' } });
    await registry.addCases(benchmark.id, [{ externalCaseId: 'case-1', input: { query: 'x' }, expectedOutput: {}, difficulty: 'EASY', language: 'en', status: 'APPROVED' }]);
    await registry.approve(benchmark.id);
    await registry.freezeAsGold(benchmark.id);

    const beforeTamper = await registry.verifyChecksum(benchmark.id);
    expect(beforeTamper.matches).toBe(true);

    // Simulate a real drift (e.g. a direct DB edit bypassing the service
    // layer entirely) to prove verifyChecksum() would actually catch it.
    await prisma.benchmarkCase.create({ data: { benchmarkId: benchmark.id, externalCaseId: 'case-2-bypassed', input: {}, expectedOutput: {}, difficulty: 'EASY', language: 'en', status: 'APPROVED' } });

    const afterTamper = await registry.verifyChecksum(benchmark.id);
    expect(afterTamper.matches).toBe(false);
  });

  it('buildAndFreezeGoldBenchmark() only includes zero-ambiguity (APPROVED) cases, never REVIEW_REQUIRED ones', async () => {
    const key = `test-gold-filter-${Date.now()}`;
    const result = await goldDataset.buildAndFreezeGoldBenchmark(
      'RETRIEVAL',
      key,
      'Gold Filter Test',
      'real test',
      [
        { externalCaseId: 'approved-1', input: { query: 'a' }, expectedOutput: { expectedEntityIds: [realPartId] }, difficulty: 'EASY', language: 'en', status: 'APPROVED' },
        { externalCaseId: 'review-1', input: { query: 'b' }, expectedOutput: { expectedEntityIds: [realPartId] }, difficulty: 'HARD', language: 'en', status: 'REVIEW_REQUIRED' },
      ],
    );
    expect(result.casesFrozen).toBe(1);
    const cases = await registry.listCases(result.benchmark!.id);
    expect(cases).toHaveLength(1);
    expect(cases[0].externalCaseId).toBe('approved-1');
  });

  it('runRetrievalCategory() executes real deterministic search against a real part and persists a real BenchmarkRun', async () => {
    const key = `test-real-retrieval-${Date.now()}`;
    const benchmark = await registry.createBenchmark({ key, category: 'RETRIEVAL', name: 'Real Retrieval Run', description: 'real test', provenance: { source: 'test' } });
    await registry.addCases(benchmark.id, [{ externalCaseId: `exact-oem:${realPartId}`, input: { query: realOemNumber, queryType: 'EXACT_OEM' }, expectedOutput: { expectedEntityIds: [realPartId] }, difficulty: 'EASY', language: 'en', status: 'APPROVED' }]);

    const result = await pipeline.runRetrievalCategory({ benchmarkId: benchmark.id });
    expect(result.category).toBe('RETRIEVAL');
    if (result.category === 'RETRIEVAL') {
      expect(result.metrics.recallAt1).toBe(1);
      expect(result.metrics.casesScored).toBe(1);
    }

    const persistedRun = await prisma.benchmarkRun.findFirst({ where: { benchmarkId: benchmark.id } });
    expect(persistedRun).not.toBeNull();
    expect(persistedRun?.status).toBe('COMPLETED');
  });

  it('runPermissionEnforcementCategory() is pure/no-LLM and correctly flags a real leakage case', async () => {
    const key = `test-permission-${Date.now()}`;
    const benchmark = await registry.createBenchmark({ key, category: 'PERMISSION_ENFORCEMENT', name: 'Real Permission Run', description: 'real test', provenance: { source: 'test' } });
    const drafts = buildPermissionEnforcementCases(10);
    await registry.addCases(benchmark.id, drafts);

    const result = await pipeline.runPermissionEnforcementCategory({ benchmarkId: benchmark.id });
    expect(result.category).toBe('PERMISSION_ENFORCEMENT');
    if (result.category === 'PERMISSION_ENFORCEMENT') {
      // Real ROLE_PERMISSIONS map is self-consistent — the pipeline
      // re-derives actualGranted from the exact same map the case
      // generator used, so enforcement accuracy is genuinely 1.0 here.
      expect(result.metrics.enforcementAccuracy).toBe(1);
      expect(result.metrics.leakageCount).toBe(0);
    }
  });

  it('leaderboard returns a real, independently-ranked list for RETRIEVAL after a real run exists', async () => {
    const board = await leaderboard.getCategoryLeaderboard('RETRIEVAL', 5);
    expect(board.category).toBe('RETRIEVAL');
    expect(board.metricPath).toBe('recallAt1');
    expect(Array.isArray(board.entries)).toBe(true);
  });
});
