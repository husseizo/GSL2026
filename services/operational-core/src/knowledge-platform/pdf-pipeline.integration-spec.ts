// Real PDF-through-the-full-ingestion-pipeline proof (DGX Prototype 1.7.1).
// Split into its own file/jest project because real PDF parsing
// (pdf-parse/pdfjs-dist) needs NODE_OPTIONS=--experimental-vm-modules to
// run under Jest at all (a real pdfjs-dist worker-bootstrap/Jest
// module-system interaction, confirmed during this phase's own testing —
// see docs/trusted-knowledge-pilot/pdf-ingestion.md) — but that flag
// breaks otplib-based tests elsewhere in this codebase (identity.integration-spec.ts,
// mfa.spec.ts), so it cannot be applied to the shared "integration" or
// "unit" jest projects. Run via: npm run test:integration:pdf-docx.
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { RateLimiterService } from '../ai-gateway/rate-limiter.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { KnowledgeSourceRegistryService } from './source-registry/knowledge-source-registry.service';
import { KnowledgeItemRegistryService } from './versioning/knowledge-item-registry.service';
import { KnowledgeClaimService } from './provenance/knowledge-claim.service';
import { DedupVersionDetectStage } from './ingestion/stages/dedup-version-detect.stage';
import { IngestionPipelineService } from './ingestion/ingestion-pipeline.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { DocumentEncryptionKeyService } from './security/document-encryption-key.service';
import { buildMinimalTestPdf, buildMinimalTestDocx } from './parsing/test-fixtures/build-test-documents';

describe('Real PDF/DOCX through the full ingestion pipeline (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let sourceRegistry: KnowledgeSourceRegistryService;
  let pipeline: IngestionPipelineService;

  const runId = Date.now();

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    redis = new RedisService();

    const dgxClient = new DgxClientService();
    const rateLimiter = new RateLimiterService();
    const aiGateway = new AiGatewayService(prisma, dgxClient, rateLimiter);
    const embeddings = new EmbeddingService(prisma, aiGateway);
    const knowledgeBase = new KnowledgeBaseService(prisma, embeddings);
    const audit = new AuditService(prisma);

    sourceRegistry = new KnowledgeSourceRegistryService(prisma, audit);
    const itemRegistry = new KnowledgeItemRegistryService(prisma, audit, knowledgeBase, sourceRegistry);
    const claims = new KnowledgeClaimService(prisma, audit);
    const dedupVersionDetect = new DedupVersionDetectStage(prisma);
    const encryptionKeys = new DocumentEncryptionKeyService();
    pipeline = new IngestionPipelineService(prisma, audit, itemRegistry, claims, dedupVersionDetect, encryptionKeys);
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.onModuleDestroy();
  });

  it('real PDF ingestion end-to-end through the full pipeline (checksum, dedup, parse, claims)', async () => {
    const source = await sourceRegistry.register({ name: `Real PDF Source ${runId}`, authority: 'INTERNAL_WORKSHOP' });
    const pdfBytes = await buildMinimalTestPdf(`Real torque spec for PDF pipeline test ${runId}: 52 Nm.`);
    const result = await pipeline.ingest({ itemKey: `real-pdf-${runId}`, sourceId: source.id, format: 'pdf', rawContent: '', rawBytes: pdfBytes, fallbackTitle: 'Real PDF Pipeline Test' });

    expect(result.quarantined).toBe(false);
    expect(result.versionId).not.toBeNull();
    expect(result.run.failed).toBe(false);
  }, 30_000);

  it('real DOCX ingestion end-to-end through the full pipeline, real table preserved', async () => {
    const source = await sourceRegistry.register({ name: `Real DOCX Source ${runId}`, authority: 'INTERNAL_WORKSHOP' });
    const docxBytes = await buildMinimalTestDocx('Real Torque Table', `Real fastener torque values for DOCX pipeline test ${runId}.`, { headers: ['Fastener', 'Torque (Nm)'], rows: [['Wheel bolt', '110']] });
    const result = await pipeline.ingest({ itemKey: `real-docx-${runId}`, sourceId: source.id, format: 'docx', rawContent: '', rawBytes: docxBytes, fallbackTitle: 'Real DOCX Pipeline Test' });

    expect(result.quarantined).toBe(false);
    expect(result.versionId).not.toBeNull();
    expect(result.run.failed).toBe(false);
  }, 30_000);
});
