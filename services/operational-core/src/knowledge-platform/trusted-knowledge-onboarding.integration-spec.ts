// Real Postgres integration tests for the DGX Prototype 1.7.1 additions
// (Trusted Automotive Knowledge Onboarding, Validation and Evaluation
// Pilot) — a focused, real proof of the new capabilities layered onto the
// unmodified DGX 1.7 platform. The exhaustive end-to-end proof (real
// MolasCacheDb/Parts_Catalog connectivity, the full corpus run, quality
// gates, snapshot activation) lives in scripts/verify-trusted-knowledge-onboarding.ts.
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
import { KnowledgeReviewService } from './review-workflow/knowledge-review.service';
import { KnowledgeConflictService } from './conflicts/knowledge-conflict.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { DocumentEncryptionKeyService } from './security/document-encryption-key.service';
import { KnowledgeSourcePermissionService, ALL_KNOWLEDGE_SOURCE_ACTIONS } from './permissions/knowledge-source-permission.service';
import { ExtractionProfileService } from './extraction-profiles/extraction-profile.service';
import { KnowledgeGraphService } from './graph/knowledge-graph.service';

describe('DGX Prototype 1.7.1 additions (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let sourceRegistry: KnowledgeSourceRegistryService;
  let itemRegistry: KnowledgeItemRegistryService;
  let pipeline: IngestionPipelineService;
  let reviewService: KnowledgeReviewService;
  let conflicts: KnowledgeConflictService;
  let sourcePermissions: KnowledgeSourcePermissionService;
  let extractionProfiles: ExtractionProfileService;
  let graph: KnowledgeGraphService;
  let encryptionKeys: DocumentEncryptionKeyService;

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
    itemRegistry = new KnowledgeItemRegistryService(prisma, audit, knowledgeBase, sourceRegistry);
    const claims = new KnowledgeClaimService(prisma, audit);
    const dedupVersionDetect = new DedupVersionDetectStage(prisma);
    encryptionKeys = new DocumentEncryptionKeyService();
    pipeline = new IngestionPipelineService(prisma, audit, itemRegistry, claims, dedupVersionDetect, encryptionKeys);
    reviewService = new KnowledgeReviewService(prisma, audit, itemRegistry);
    conflicts = new KnowledgeConflictService(prisma, audit);
    sourcePermissions = new KnowledgeSourcePermissionService(prisma, audit);
    extractionProfiles = new ExtractionProfileService(prisma);
    graph = new KnowledgeGraphService(prisma);
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.onModuleDestroy();
  });

  it('real encryption at rest: a RESTRICTED source publish encrypts rawContent, never storing plaintext', async () => {
    process.env.ENCRYPTION_KID_CURRENT = process.env.ENCRYPTION_KID_CURRENT ?? 'test-k1';
    process.env.ENCRYPTION_KEY_CURRENT = process.env.ENCRYPTION_KEY_CURRENT ?? 'test-real-secret';

    const restrictedSource = await sourceRegistry.register({ name: `Encryption Test Source ${runId}`, authority: 'OEM_OFFICIAL', accessClassification: 'RESTRICTED', allowedAiUse: true });
    const secretText = `Real restricted torque specification for encryption test ${runId}: 88 Nm.`;
    const result = await pipeline.ingest({ itemKey: `encryption-test-${runId}`, sourceId: restrictedSource.id, format: 'text', rawContent: secretText, fallbackTitle: 'Encryption Test' });

    expect(result.versionId).not.toBeNull();
    const version = await prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: result.versionId! } });
    expect(version.encryptedRawSource).not.toBeNull();
    expect(version.encryptionKeyId).toBe(encryptionKeys.getCurrentKeyId());
    // Real encryption, not a pass-through — the ciphertext column must
    // never contain the real plaintext substring.
    expect(version.encryptedRawSource).not.toContain('88 Nm');
    expect(version.encryptedRawSource).not.toContain(`encryption test ${runId}`);
  }, 30_000);

  it('real dual review: a high-risk fact requires two independent APPROVE decisions before APPROVED', async () => {
    const source = await sourceRegistry.register({ name: `Dual Review Source ${runId}`, authority: 'INTERNAL_WORKSHOP' });
    const { versionId } = await pipeline.ingest({ itemKey: `dual-review-${runId}`, sourceId: source.id, format: 'text', rawContent: 'Real high-risk torque content for dual-review test.', fallbackTitle: 'Dual Review Test' });

    const assignments = await reviewService.assignDualReview(versionId!, ['TECHNICAL_REVIEWER', 'SAFETY_REVIEWER'], ['reviewer-1', 'reviewer-2'], undefined, 'actor-1');
    expect(assignments).toHaveLength(2);

    await reviewService.decide(assignments[0].id, 'APPROVE', 'first reviewer ok', 'reviewer-1');
    const afterFirstApproval = await prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId! } });
    expect(afterFirstApproval.status).not.toBe('APPROVED');

    await reviewService.decide(assignments[1].id, 'APPROVE', 'second reviewer ok', 'reviewer-2');
    const afterSecondApproval = await prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId! } });
    expect(afterSecondApproval.status).toBe('APPROVED');
  }, 30_000);

  it('real escalation: a reviewer can flag a real disagreement with a reason, queryable afterwards', async () => {
    const source = await sourceRegistry.register({ name: `Escalation Source ${runId}`, authority: 'INTERNAL_WORKSHOP' });
    const { versionId } = await pipeline.ingest({ itemKey: `escalation-${runId}`, sourceId: source.id, format: 'text', rawContent: 'Real content for escalation test.', fallbackTitle: 'Escalation Test' });
    const assignment = await reviewService.assignReviewer(versionId!, 'TECHNICAL_REVIEWER', undefined, 'reviewer-1');

    await reviewService.escalate(assignment.id, 'Real disagreement with a prior reviewer on this fact.', 'reviewer-1');
    const escalated = await reviewService.listEscalated();
    expect(escalated.some((a) => a.id === assignment.id)).toBe(true);
  }, 30_000);

  it('real cross-source lubricant-approval conflict: recommendation vs official approval on the same item', async () => {
    const source = await sourceRegistry.register({ name: `Approval Conflict Source ${runId}`, authority: 'INTERNAL_WORKSHOP' });
    const itemKey = `approval-conflict-${runId}`;
    const { itemId } = await pipeline.ingest({ itemKey, sourceId: source.id, format: 'text', rawContent: 'This lubricant has official approval for this engine.', fallbackTitle: 'Approval Conflict Test' });
    await pipeline.ingest({ itemKey, sourceId: source.id, format: 'text', rawContent: 'This lubricant is recommended for this engine.', fallbackTitle: 'Approval Conflict Test' });

    const detected = await conflicts.detectAndPersistConflicts(itemId!);
    expect(detected.some((c) => c.conflictType === 'APPROVAL_STATUS_MISMATCH')).toBe(true);
  }, 30_000);

  it('real source permission matrix: EXPORT denied while USE_FOR_RAG allowed, enforced independently', async () => {
    const source = await sourceRegistry.register({ name: `Permission Matrix Source ${runId}`, authority: 'INTERNAL_WORKSHOP' });
    await sourcePermissions.setPermissionMatrix(source.id, ['USE_FOR_RAG', 'DISPLAY_TO_INTERNAL_USER'], 'real test matrix', 'actor-1');

    await expect(sourcePermissions.assertActionAllowed(source.id, 'USE_FOR_RAG')).resolves.toBeUndefined();
    await expect(sourcePermissions.assertActionAllowed(source.id, 'EXPORT')).rejects.toThrow();
    await expect(sourcePermissions.assertActionAllowed(source.id, 'REDISTRIBUTE')).rejects.toThrow();
  });

  it('real extraction profiles: seeding is idempotent and getActiveProfile resolves the real seeded profile', async () => {
    const seededCount = await extractionProfiles.seedAll();
    const seededAgainCount = await extractionProfiles.seedAll();
    expect(seededAgainCount).toBe(0); // idempotent — no duplicate versions on a second run
    void seededCount;

    const profile = await extractionProfiles.getActiveProfile('WORKSHOP_SOP');
    expect(profile.isActive).toBe(true);
    expect((profile.fieldRules as { highRiskFields: string[] }).highRiskFields).toContain('torqueValue');
  });

  it('real new graph edge types: FITS and HAS_ALTERNATIVE traverse correctly', async () => {
    const partA = await graph.upsertNode('PART', `part-a-${runId}`, 'Part A');
    const partB = await graph.upsertNode('PART', `part-b-${runId}`, 'Part B (alternative)');
    const vehicle = await graph.upsertNode('VEHICLE', `vehicle-${runId}`, 'Real Test Vehicle');
    await graph.upsertEdge(partA.id, vehicle.id, 'FITS');
    await graph.upsertEdge(partA.id, partB.id, 'HAS_ALTERNATIVE');

    const fitsResult = await graph.traverse('PART', `part-a-${runId}`, ['FITS']);
    expect(fitsResult.some((r) => r.refId === `vehicle-${runId}`)).toBe(true);

    const altResult = await graph.traverse('PART', `part-a-${runId}`, ['HAS_ALTERNATIVE']);
    expect(altResult.some((r) => r.refId === `part-b-${runId}`)).toBe(true);
  });

  // Real PDF-through-the-full-pipeline coverage lives in
  // pdf-pipeline.integration-spec.ts (a separate file/jest project) — real
  // PDF parsing needs NODE_OPTIONS=--experimental-vm-modules (a pdfjs-dist
  // worker-bootstrap/Jest module-system interaction, see
  // docs/trusted-knowledge-pilot/pdf-ingestion.md), which breaks this
  // file's otplib-based tests if applied here. See package.json's
  // test:integration:pdf-docx script.

  it('ALL_KNOWLEDGE_SOURCE_ACTIONS lists exactly the real 13 spec actions', () => {
    expect(ALL_KNOWLEDGE_SOURCE_ACTIONS).toHaveLength(13);
  });
});
