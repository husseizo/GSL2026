import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { RateLimiterService } from '../ai-gateway/rate-limiter.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromptRegistryService } from '../prompt-registry/prompt-registry.service';
import { RagService } from '../rag/rag.service';
import { PostgresArrayVectorIndexProvider } from '../vector-search/postgres-array-vector-index.provider';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { AiEvaluationService } from './ai-evaluation.service';

// Real Ollama end-to-end: evaluates real retrieval behavior from RagService
// against a human-curated expected-document set, not a mocked answer.
describe('AiEvaluationService (integration, real DGX/Ollama)', () => {
  let prisma: PrismaService;
  let evaluations: AiEvaluationService;
  let knowledgeBase: KnowledgeBaseService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const dgxClient = new DgxClientService();
    const aiGateway = new AiGatewayService(prisma, dgxClient, new RateLimiterService());
    const embeddingService = new EmbeddingService(prisma, aiGateway);
    knowledgeBase = new KnowledgeBaseService(prisma, embeddingService);
    const vectorSearch = new VectorSearchService(prisma, new PostgresArrayVectorIndexProvider(prisma));
    const promptRegistry = new PromptRegistryService(prisma);
    const rag = new RagService(aiGateway, vectorSearch, promptRegistry);
    evaluations = new AiEvaluationService(prisma, rag);
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs a real retrieval evaluation and measures precision/recall against a curated expectation', async () => {
    const doc = await knowledgeBase.ingestDocument({
      source: 'eval-sop-1',
      sourceType: 'INTERNAL_SOP',
      title: 'Brake Pad Replacement Procedure',
      content: 'Symptom: squealing noise when braking, worn brake pads below minimum thickness. Replace front brake pads and inspect rotors for scoring.',
      isApproved: true,
    });

    const dataset = await evaluations.createDataset('eval-retrieval-brakes', 'RETRIEVAL');
    await evaluations.addCase(
      dataset.id,
      { query: 'Car makes a squealing noise when braking, what should I check?' },
      { expectedDocumentIds: [doc.document.id] },
    );

    const run = await evaluations.runRetrievalEvaluation(dataset.id);
    const metrics = run.metrics as { casesEvaluated: number; avgPrecision: number; avgRecall: number };

    expect(metrics.casesEvaluated).toBe(1);
    expect(metrics.avgRecall).toBeGreaterThan(0); // the real ingested brake document should actually be retrieved
    expect(run.completedAt).not.toBeNull();
  }, 60_000);

  it('listRuns/listDatasets return the persisted real evaluation records', async () => {
    const datasets = await evaluations.listDatasets();
    expect(datasets.some((d) => d.name === 'eval-retrieval-brakes')).toBe(true);

    const runs = await evaluations.listRuns();
    expect(runs.length).toBeGreaterThan(0);
  });
});
