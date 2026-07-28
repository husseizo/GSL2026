// Real Postgres integration tests for the DGX Prototype 1.7.2 Retrieval
// Intelligence Platform — manually constructed services (same convention
// as knowledge-platform/trusted-knowledge-onboarding.integration-spec.ts),
// exercising the real pipeline against the real, live corpus built in
// prior phases. The exhaustive end-to-end proof (gold benchmark, quality
// gates, regression check vs. 1.7.1) lives in
// scripts/verify-retrieval-intelligence.ts.
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { RateLimiterService } from '../ai-gateway/rate-limiter.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { CatalogueSearchService } from '../catalogue-ai/search/catalogue-search.service';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { PostgresArrayVectorIndexProvider } from '../vector-search/postgres-array-vector-index.provider';
import { StructuredFactService } from '../knowledge-platform/structured-facts/structured-fact.service';
import { KnowledgeLifecycleService } from '../knowledge-platform/expiry-supersession/knowledge-lifecycle.service';
import { KnowledgeSourceRegistryService } from '../knowledge-platform/source-registry/knowledge-source-registry.service';
import { KnowledgeItemRegistryService } from '../knowledge-platform/versioning/knowledge-item-registry.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { KnowledgeSnapshotService } from '../knowledge-platform/snapshots/knowledge-snapshot.service';
import { KnowledgeGraphService } from '../knowledge-platform/graph/knowledge-graph.service';
import { GraphExpansionService } from './graph-expansion/graph-expansion.service';
import { RetrievalQueryLogService } from './pipeline/retrieval-query-log.service';
import { RetrievalPipelineService } from './pipeline/retrieval-pipeline.service';
import { RetrievalLabService } from './lab/retrieval-lab.service';

// The `integration` Jest project points DATABASE_URL at aios_operational_test
// (see src/test-global-setup-integration.ts) — a separate database from the
// real, pre-seeded dev corpus (7,723 real parts etc.) queried by
// scripts/verify-retrieval-intelligence.ts. This spec therefore creates its
// own real, clearly-labeled test Part rows (matching the established
// "Verify ..." transient-fixture naming convention from prior phases'
// verify scripts) rather than assuming pre-seeded catalogue data exists
// here.
const runId = Date.now();

describe('DGX Prototype 1.7.2 Retrieval Intelligence Platform (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let pipeline: RetrievalPipelineService;
  let lab: RetrievalLabService;
  let testPart: { id: string; oemNumber: string; internalItemCode: string | null };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    // Real, confirmed shapes observed in the live catalogue (see
    // decision-log.md): OEM numbers and internal item codes are both
    // short (well under 20 characters) — a 13-digit Date.now() runId
    // baked in whole would produce an identifier far longer than any real
    // shape, which the classifier correctly refuses to treat as
    // identifier-shaped (a real finding from this test's first failed
    // run, not a classifier bug). Truncated here to stay realistic.
    const shortSuffix = String(runId).slice(-6);
    testPart = await prisma.part.create({
      data: {
        sourceSystem: 'RETRIEVAL_INTELLIGENCE_INTEGRATION_TEST',
        sourceRecordId: `ri-test-${runId}`,
        oemNumber: `RI${shortSuffix}OEM`,
        internalItemCode: `RI${shortSuffix}`,
        productName: 'Retrieval Intelligence integration test fixture part',
        standardizedProductName: 'RETRIEVAL INTELLIGENCE INTEGRATION TEST FIXTURE PART',
      },
    });

    const audit = new AuditService(prisma);
    const dgxClient = new DgxClientService();
    const rateLimiter = new RateLimiterService();
    const aiGateway = new AiGatewayService(prisma, dgxClient, rateLimiter);
    redis = new RedisService();
    const catalogueSearch = new CatalogueSearchService(prisma, redis);
    const vectorProvider = new PostgresArrayVectorIndexProvider(prisma);
    const vectorSearch = new VectorSearchService(prisma, vectorProvider);
    const structuredFacts = new StructuredFactService(prisma, audit);
    const embeddings = new EmbeddingService(prisma, aiGateway);
    const knowledgeBase = new KnowledgeBaseService(prisma, embeddings);
    const sourceRegistry = new KnowledgeSourceRegistryService(prisma, audit);
    const itemRegistry = new KnowledgeItemRegistryService(prisma, audit, knowledgeBase, sourceRegistry);
    const lifecycle = new KnowledgeLifecycleService(prisma, audit, itemRegistry);
    const snapshots = new KnowledgeSnapshotService(prisma, audit);
    const graph = new KnowledgeGraphService(prisma);
    const graphExpansion = new GraphExpansionService(graph);
    const queryLog = new RetrievalQueryLogService(prisma);

    pipeline = new RetrievalPipelineService(prisma, catalogueSearch, vectorSearch, aiGateway, structuredFacts, lifecycle, snapshots, graphExpansion, queryLog);
    lab = new RetrievalLabService(prisma, pipeline);
  }, 30_000);

  afterAll(async () => {
    await prisma.part.delete({ where: { id: testPart.id } }).catch(() => undefined);
    await redis.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('resolves a real, exact OEM number to its real part via deterministic lookup, never falling back to semantic search for the top result', async () => {
    const result = await pipeline.retrieve({ query: testPart.oemNumber, consumerName: 'retrieval-intelligence-integration-spec' });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].id).toBe(testPart.id);
    expect(result.confidence).toBe(1);
    expect(result.candidates[0].explanation.find((e) => e.signal === 'EXACT_IDENTIFIER')?.value).toBe(1);
  });

  it('classifies a real internal item code query correctly and finds it via the same real deterministic lookup', async () => {
    const result = await pipeline.retrieve({ query: testPart.internalItemCode!, consumerName: 'retrieval-intelligence-integration-spec' });

    expect(result.queryClass).toBe('INTERNAL_ITEM_CODE');
    expect(result.candidates.some((c) => c.id === testPart.id)).toBe(true);
  });

  it('always persists a real RetrievalQueryLog row for every real pipeline run (spec §4 stage 16)', async () => {
    const before = await prisma.retrievalQueryLog.count();
    await pipeline.retrieve({ query: 'a genuinely unmatched free-text automotive question', consumerName: 'retrieval-intelligence-integration-spec' });
    const after = await prisma.retrievalQueryLog.count();
    expect(after).toBe(before + 1);
  });

  it('returns a real ranking explanation array for every returned candidate, never a bare score', async () => {
    const result = await pipeline.retrieve({ query: testPart.oemNumber, consumerName: 'retrieval-intelligence-integration-spec' });
    expect(result.candidates[0].explanation.length).toBeGreaterThan(0);
    for (const e of result.candidates[0].explanation) {
      expect(typeof e.contribution).toBe('number');
    }
  });

  it('real Query Lab replay re-runs a real logged query through the live pipeline and produces a real result', async () => {
    await pipeline.retrieve({ query: testPart.oemNumber, consumerName: 'retrieval-intelligence-integration-spec' });
    const log = await prisma.retrievalQueryLog.findFirst({ where: { queryText: testPart.oemNumber }, orderBy: { createdAt: 'desc' } });
    expect(log).not.toBeNull();

    const replayed = await lab.replayQuery(log!.id);
    expect(replayed.candidates.length).toBeGreaterThan(0);
  });

  it('never reports a false exact-identifier match for a genuinely nonexistent identifier, and never with confidence 1', async () => {
    const result = await pipeline.retrieve({ query: 'ZZZ-NONEXISTENT-PART-NUMBER-000000', consumerName: 'retrieval-intelligence-integration-spec' });
    expect(result.confidence).toBeLessThan(1);
    expect(result.candidates.every((c) => c.explanation.find((e) => e.signal === 'EXACT_IDENTIFIER')?.value !== 1)).toBe(true);
  });

  it('suppresses the semantic widening pass entirely for a genuinely nonexistent identifier-shaped query, rather than showing an irrelevant real match (AI Foundation Certification Sprint fix)', async () => {
    // Real bug found this sprint: a real, nonexistent identifier-shaped
    // query got a genuinely high real cosine similarity (0.7) against an
    // unrelated real document — a known embedding-model artifact for
    // short/unusual tokens, not fixable via a similarity threshold. When
    // deterministic exact lookup was attempted and found nothing real,
    // the semantic-only fallback is now suppressed entirely.
    const result = await pipeline.retrieve({ query: 'QQQ-NEVER-REAL-0002', consumerName: 'retrieval-intelligence-integration-spec' });
    expect(result.queryClass).not.toBe('UNKNOWN'); // must genuinely classify as identifier-shaped for this test to be meaningful
    expect(result.candidates.length).toBe(0);
    expect(result.confidence).toBe(0);
  });
});
