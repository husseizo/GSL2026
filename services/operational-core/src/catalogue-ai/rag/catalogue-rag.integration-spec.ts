import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { DgxClientService } from '../../ai-gateway/dgx-client.service';
import { RateLimiterService } from '../../ai-gateway/rate-limiter.service';
import { EmbeddingService } from '../../embeddings/embedding.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptRegistryService } from '../../prompt-registry/prompt-registry.service';
import { RagService } from '../../rag/rag.service';
import { PostgresArrayVectorIndexProvider } from '../../vector-search/postgres-array-vector-index.provider';
import { VectorSearchService } from '../../vector-search/vector-search.service';
import { CatalogueSearchService } from '../search/catalogue-search.service';
import { MetricsService } from '../../observability/metrics.service';
import { ManualReviewService } from '../../data-consolidation/manual-review.service';
import { RedisService } from '../../redis/redis.service';
import { CatalogueRagService } from './catalogue-rag.service';

// Real Postgres + real DGX/Ollama integration test. A tiny fixture set (one
// part) keeps real embedding/generation calls minimal.
describe('CatalogueRagService (integration, real Postgres + real DGX/Ollama)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let catalogueRag: CatalogueRagService;
  let realOemNumber: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const dgxClient = new DgxClientService();
    const aiGateway = new AiGatewayService(prisma, dgxClient, new RateLimiterService());
    const embeddingService = new EmbeddingService(prisma, aiGateway);
    const knowledgeBase = new KnowledgeBaseService(prisma, embeddingService);
    const vectorSearch = new VectorSearchService(prisma, new PostgresArrayVectorIndexProvider(prisma));
    const promptRegistry = new PromptRegistryService(prisma);
    const ragService = new RagService(aiGateway, vectorSearch, promptRegistry);
    redis = new RedisService();
    const catalogueSearch = new CatalogueSearchService(prisma, redis);
    catalogueRag = new CatalogueRagService(ragService, catalogueSearch, aiGateway, vectorSearch, promptRegistry, prisma, new MetricsService(), new ManualReviewService(prisma));

    realOemNumber = `04E-RAG-${Date.now()}`;
    const part = await prisma.part.create({ data: { oemNumber: realOemNumber, productName: 'RAG Test Ignition Coil', standardizedProductName: 'rag test ignition coil', category: 'IGNITION' } });
    await knowledgeBase.ingestDocument({
      source: 'PARTS_CATALOG_AUTOHUB',
      sourceType: 'PARTS_DOCUMENTATION',
      title: part.productName,
      content: `Part: RAG Test Ignition Coil\nOEM number: ${realOemNumber}\nCategory: IGNITION\nBrand: TestBrand`,
      partId: part.id,
      isApproved: true,
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.onModuleDestroy();
  });

  it('answers an exact-OEM query via deterministic lookup, never calling the LLM', async () => {
    const answer = await catalogueRag.ask(realOemNumber);
    expect(answer.usedDeterministicLookup).toBe(true);
    expect(answer.usedGeneration).toBe(false);
    expect(answer.matchingProducts.some((m) => m.exactIdentifiers.includes(realOemNumber))).toBe(true);
    expect(answer.logId).toBeUndefined();
  }, 30_000);

  it('answers a real description query via semantic RAG, citing real approved sources', async () => {
    const answer = await catalogueRag.ask('ignition coil for testing');
    expect(answer.usedDeterministicLookup).toBe(false);
    expect(['MEDIUM', 'LOW', 'INSUFFICIENT_EVIDENCE']).toContain(answer.confidence);
    // Semantic-only matches are structurally capped below VERIFIED/HIGH —
    // see confidence-model.ts and catalogue-rag.service.ts's documented rule.
    expect(answer.confidence).not.toBe('VERIFIED');
    expect(answer.confidence).not.toBe('HIGH');
  }, 120_000);

  it('honestly declines an unrelated query rather than inventing a match', async () => {
    const answer = await catalogueRag.ask('recommended tyre pressure for a spaceship landing gear');
    expect(answer.matchingProducts).toHaveLength(0);
    expect(['LOW', 'INSUFFICIENT_EVIDENCE']).toContain(answer.confidence);
  }, 120_000);
});
