import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { RateLimiterService } from '../ai-gateway/rate-limiter.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromptRegistryService } from '../prompt-registry/prompt-registry.service';
import { PostgresArrayVectorIndexProvider } from '../vector-search/postgres-array-vector-index.provider';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { RagService } from './rag.service';

// Real Ollama end-to-end: real embeddings for both ingestion and query, real
// cosine-similarity retrieval, real llama3 generation grounded in that
// retrieved text. Requires the DGX FastAPI service running (see
// ai-gateway.integration-spec.ts's precondition note).
describe('RagService + KnowledgeBaseService (integration, real DGX/Ollama)', () => {
  let prisma: PrismaService;
  let aiGateway: AiGatewayService;
  let knowledgeBase: KnowledgeBaseService;
  let vectorSearch: VectorSearchService;
  let ragService: RagService;
  let promptRegistry: PromptRegistryService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const dgxClient = new DgxClientService();
    aiGateway = new AiGatewayService(prisma, dgxClient, new RateLimiterService());
    const embeddingService = new EmbeddingService(prisma, aiGateway);
    knowledgeBase = new KnowledgeBaseService(prisma, embeddingService);
    vectorSearch = new VectorSearchService(prisma, new PostgresArrayVectorIndexProvider(prisma));
    promptRegistry = new PromptRegistryService(prisma);
    ragService = new RagService(aiGateway, vectorSearch, promptRegistry);
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('ingests a document, chunks it, and embeds each chunk with real vectors', async () => {
    const result = await knowledgeBase.ingestDocument({
      source: 'internal-sop-001',
      sourceType: 'INTERNAL_SOP',
      title: 'Ignition Coil Replacement Procedure',
      content:
        'Symptom: Engine misfire on cylinder 3, DTC P0301 stored.\n\n' +
        'Diagnosis: A failed ignition coil on BMW N20 engines is a common cause of a P0301 misfire code. ' +
        'Inspect the coil for cracks and test primary/secondary resistance before replacement.\n\n' +
        'Procedure: Disconnect battery. Remove engine cover. Unplug ignition coil connector. ' +
        'Remove retaining bolt. Extract coil. Install new coil in reverse order. Torque bolt to spec. Clear DTCs and road test.',
      isApproved: true,
    });

    expect(result.chunksCreated).toBeGreaterThan(0);
    expect(result.chunksFailed).toBe(0);

    const stored = await prisma.knowledgeChunk.findMany({ where: { documentId: result.document.id } });
    expect(stored.length).toBe(result.chunksCreated);
    for (const chunk of stored) {
      expect(chunk.embedding.length).toBeGreaterThan(100);
      expect(chunk.embeddingModel).toContain('nomic');
    }
  }, 30_000);

  it('re-ingesting identical content skips already-embedded chunks (no duplicate embedding calls)', async () => {
    const content = 'Duplicate-test paragraph that should only ever be embedded once.';
    const first = await knowledgeBase.ingestDocument({
      source: 'dup-test',
      sourceType: 'COMPANY_POLICY',
      title: 'Dedup test document',
      content,
      isApproved: true,
    });
    expect(first.chunksCreated).toBe(1);

    const embeddingService = new EmbeddingService(prisma, aiGateway);
    const secondPass = await embeddingService.embedDocumentContent(first.document.id, content);
    expect(secondPass.chunksCreated).toBe(0);
    expect(secondPass.chunksSkippedDuplicate).toBe(1);
  }, 30_000);

  it('an unapproved document is never returned by semantic search', async () => {
    const unapproved = await knowledgeBase.ingestDocument({
      source: 'unverified-doc',
      sourceType: 'OTHER',
      title: 'Unverified Draft Notes',
      content: 'This document discusses turbocharger wastegate actuator calibration in detail for XJ-series engines.',
      isApproved: false,
    });
    expect(unapproved.chunksCreated).toBeGreaterThan(0);

    const embedResult = await aiGateway.embed({ text: 'turbocharger wastegate actuator calibration' });
    expect(embedResult.available).toBe(true);

    const hits = await vectorSearch.semanticSearch(embedResult.embedding!, 5, { documentIds: [unapproved.document.id] });
    expect(hits).toHaveLength(0);
  }, 30_000);

  it('RagService.answer() retrieves the ignition coil procedure and grounds a real generated answer in it', async () => {
    const result = await ragService.answer('The engine has a P0301 misfire code, what should I check?');

    expect(result.available).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources.some((s) => s.title === 'Ignition Coil Replacement Procedure')).toBe(true);
    expect(result.answer).toBeTruthy();
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.confidence);
    expect(result.evidenceRanking.length).toBeGreaterThan(0);

    const promptVersion = await promptRegistry.getActiveVersion('RAG_ANSWER');
    expect(promptVersion).toBeDefined();

    const log = await prisma.aiInferenceLog.findUniqueOrThrow({ where: { id: result.logId! } });
    expect(log.promptVersionId).toBe(promptVersion.id);
    expect((log.retrievedDocumentIds as string[]).length).toBeGreaterThan(0);
  }, 120_000);

  it('RagService.answer() states uncertainty rather than hallucinating when nothing relevant is approved', async () => {
    const result = await ragService.answer('What is the recommended tyre pressure for a spaceship landing gear?');

    expect(result.available).toBe(true);
    expect(result.confidence === 'NONE' || result.confidence === 'LOW').toBe(true);
    if (result.sources.length === 0) {
      expect(result.answer).toContain('do not have enough verified information');
      expect(result.missingInformation.length).toBeGreaterThan(0);
    } else {
      expect(result.missingInformation.length).toBeGreaterThan(0);
    }
  }, 120_000);
});
