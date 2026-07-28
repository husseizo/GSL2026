import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { DgxClientService } from '../../ai-gateway/dgx-client.service';
import { RateLimiterService } from '../../ai-gateway/rate-limiter.service';
import { EmbeddingService } from '../../embeddings/embedding.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogueIndexVersionService } from './catalogue-index-version.service';

// Real Postgres + real DGX/Ollama integration test — a deliberately tiny
// fixture set (2 parts, 1 lubricant) so the real embedding calls this
// exercises stay well under the real 30-req/60s rate limit (see
// rate-limiter.service.ts and the pacing note in buildIndex() itself).
describe('CatalogueIndexVersionService (integration, real Postgres + real DGX/Ollama)', () => {
  let prisma: PrismaService;
  let indexService: CatalogueIndexVersionService;
  let eligiblePartOem: string;
  let conflictPartOem: string;
  let approverId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const approver = await prisma.user.create({ data: { email: `idx-approver-${Date.now()}@aios.local`, name: 'Index Approver', role: 'DATA_QUALITY_REVIEWER' } });
    approverId = approver.id;
    const dgxClient = new DgxClientService();
    const aiGateway = new AiGatewayService(prisma, dgxClient, new RateLimiterService());
    const embeddingService = new EmbeddingService(prisma, aiGateway);
    const knowledgeBase = new KnowledgeBaseService(prisma, embeddingService);
    indexService = new CatalogueIndexVersionService(prisma, knowledgeBase);

    const suffix = Date.now();
    eligiblePartOem = `OEM-IDX-ELIGIBLE-${suffix}`;
    conflictPartOem = `OEM-IDX-CONFLICT-${suffix}`;

    const eligiblePart = await prisma.part.create({ data: { oemNumber: eligiblePartOem, productName: 'Index Test Part', standardizedProductName: 'index test part', sourceSystem: 'PARTS_CATALOG_AUTOHUB', category: 'BRAKES' } });
    await prisma.partExternalReference.create({ data: { partId: eligiblePart.id, sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordId: `src-${suffix}-a` } });

    const conflictPart = await prisma.part.create({ data: { oemNumber: conflictPartOem, productName: 'Index Conflict Part', standardizedProductName: 'index conflict part', sourceSystem: 'PARTS_CATALOG_AUTOHUB' } });
    const source = await prisma.integrationSource.create({ data: { name: `TEST_SOURCE_IDX_${suffix}`, adapterType: 'test' } });
    const syncRun = await prisma.syncRun.create({ data: { sourceId: source.id } });
    const recordA = await prisma.rawSourceRecord.create({ data: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceDatabase: 'test', sourceSchema: 'test', sourceTable: 'test', sourceRecordKey: `idx-conf-a-${suffix}`, feedName: 'TEST_FEED', batchId: syncRun.id, rawPayload: { part_group: 'BRAKES' }, rawChecksum: 'a' } });
    const recordB = await prisma.rawSourceRecord.create({ data: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceDatabase: 'test', sourceSchema: 'test', sourceTable: 'test', sourceRecordKey: `idx-conf-b-${suffix}`, feedName: 'TEST_FEED', batchId: syncRun.id, rawPayload: { part_group: 'ENGINE' }, rawChecksum: 'b' } });
    await prisma.partExternalReference.create({ data: { partId: conflictPart.id, sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordId: recordA.sourceRecordKey } });
    await prisma.partExternalReference.create({ data: { partId: conflictPart.id, sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordId: recordB.sourceRecordKey } });

    await prisma.lubricantProduct.create({ data: { brand: 'TestBrand', productName: `Index Test Oil ${suffix}`, normalizedName: `index test oil ${suffix}`, category: 'ENGINE_OIL', sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } });
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('builds a real versioned index, excludes a real category conflict, and generates real embeddings for eligible documents', async () => {
    const result = await indexService.buildIndex({ maxPartsToIndex: 500, maxLubricantsToIndex: 500, actorId: `idx-test-${Date.now()}` });

    expect(result.indexVersion.versionNumber).toBeGreaterThan(0);
    expect(result.exclusions.EXCLUDED_CONFLICT).toBeGreaterThanOrEqual(1);
    expect(result.embeddingFailures).toBe(0);

    const document = await prisma.knowledgeDocument.findFirst({ where: { indexVersionId: result.indexVersion.id, part: { oemNumber: eligiblePartOem } }, include: { chunks: true } });
    expect(document).not.toBeNull();
    expect(document!.chunks.length).toBeGreaterThan(0);
    expect(document!.chunks[0].embedding.length).toBeGreaterThan(100);

    const conflictDocument = await prisma.knowledgeDocument.findFirst({ where: { indexVersionId: result.indexVersion.id, part: { oemNumber: conflictPartOem } } });
    expect(conflictDocument).toBeNull();
  }, 60_000);

  it('validate -> approve -> activate never overwrites the previous index in place (blue-green)', async () => {
    // Real bug found by this test itself (DGX Prototype 1.5 acceptance
    // pass): buildIndex({maxPartsToIndex: 1}) has no `orderBy`, so which of
    // the two real fixture parts Postgres returns first for `take: 1` is
    // not guaranteed. When it picked the conflict part, that part is
    // correctly EXCLUDED_CONFLICT and produces zero KnowledgeDocument rows,
    // making this test's own "documents still exist" assertion fail for a
    // reason unrelated to the blue-green behavior being tested. Removing
    // the conflict fixture here makes `take: 1` unambiguous for the rest
    // of this test, without touching buildIndex() itself (its real,
    // unordered `take` behavior is correct and intentional for a full
    // corpus build — see docs/ai-tuning/decision-log.md).
    const conflictPart = await prisma.part.findFirstOrThrow({ where: { oemNumber: conflictPartOem } });
    await prisma.partExternalReference.deleteMany({ where: { partId: conflictPart.id } });
    await prisma.part.delete({ where: { id: conflictPart.id } });

    const first = await indexService.buildIndex({ maxPartsToIndex: 1, maxLubricantsToIndex: 0, actorId: `idx-bluegreen-1-${Date.now()}` });
    await indexService.validateIndex(first.indexVersion.id);
    await indexService.approve(first.indexVersion.id, approverId);
    await indexService.activate(first.indexVersion.id);

    const activeAfterFirst = await indexService.getActiveIndexVersion();
    expect(activeAfterFirst?.id).toBe(first.indexVersion.id);

    const second = await indexService.buildIndex({ maxPartsToIndex: 1, maxLubricantsToIndex: 0, actorId: `idx-bluegreen-2-${Date.now()}` });
    await indexService.validateIndex(second.indexVersion.id);
    await indexService.approve(second.indexVersion.id, approverId);
    await indexService.activate(second.indexVersion.id);

    const firstAfterRetire = await prisma.catalogueIndexVersion.findUniqueOrThrow({ where: { id: first.indexVersion.id } });
    expect(firstAfterRetire.status).toBe('RETIRED');

    const activeAfterSecond = await indexService.getActiveIndexVersion();
    expect(activeAfterSecond?.id).toBe(second.indexVersion.id);

    const firstIndexDocsStillExist = await prisma.knowledgeDocument.count({ where: { indexVersionId: first.indexVersion.id } });
    expect(firstIndexDocsStillExist).toBeGreaterThan(0);
  }, 60_000);
});
