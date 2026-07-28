import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CatalogueSearchService } from './catalogue-search.service';

// Real Postgres integration tests — every scenario below is built from real
// fixture rows created in this test, not mocked Prisma calls. None of these
// methods ever call the AI gateway (see catalogue-search.service.ts's own
// comment) so this suite runs with zero DGX/Ollama dependency. Real Redis
// (Memurai) is used for findByOemNumber()'s real cache — see
// docs/ai-tuning/performance-optimization.md.
describe('CatalogueSearchService (integration, real Postgres)', () => {
  let prisma: PrismaService;
  let search: CatalogueSearchService;
  let redis: RedisService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    redis = new RedisService();
    search = new CatalogueSearchService(prisma, redis);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.onModuleDestroy();
  });

  it('finds a real part by exact internal code', async () => {
    const part = await prisma.part.create({
      data: { oemNumber: `OEM-INTERNAL-${Date.now()}`, productName: 'Test Brake Pad', standardizedProductName: 'test brake pad', internalItemCode: `INT-${Date.now()}` },
    });

    const result = await search.findByInternalCode(part.internalItemCode!);
    expect(result?.canonicalEntityId).toBe(part.id);
    expect(result?.matchType).toBe('EXACT_INTERNAL_CODE');
  });

  it('finds a real part by exact OEM number', async () => {
    const part = await prisma.part.create({
      data: { oemNumber: `04E-115-561-${Date.now()}`, productName: 'Test Oil Filter', standardizedProductName: 'test oil filter' },
    });

    const results = await search.findByOemNumber(part.oemNumber);
    expect(results.some((r) => r.canonicalEntityId === part.id && r.matchType === 'EXACT_OEM' && r.matchScore === 1.0)).toBe(true);
  });

  it('finds the same part via a formatting variation, only at relaxed (lower) confidence', async () => {
    const oem = `ABC${Date.now()}DEF`;
    const part = await prisma.part.create({ data: { oemNumber: oem, productName: 'Test Sensor', standardizedProductName: 'test sensor' } });

    const formatted = `${oem.slice(0, 3)}-${oem.slice(3)}`;
    const results = await search.findByOemNumber(formatted);
    expect(results.some((r) => r.canonicalEntityId === part.id)).toBe(true);
    expect(results.find((r) => r.canonicalEntityId === part.id)?.matchScore).toBeLessThan(1.0);
  });

  it('caches a real OEM lookup in Redis and serves the second call from that real cache entry', async () => {
    const part = await prisma.part.create({ data: { oemNumber: `CACHE-TEST-${Date.now()}`, productName: 'Cache Test Part', standardizedProductName: 'cache test part' } });

    const first = await search.findByOemNumber(part.oemNumber);
    expect(first.some((r) => r.canonicalEntityId === part.id)).toBe(true);

    const cacheKey = `catalogue-search:v1:oem:${part.oemNumber.trim().toUpperCase()}`;
    const cachedRaw = await redis.cacheGet<unknown[]>(cacheKey);
    expect(cachedRaw).not.toBeNull();
    expect(cachedRaw).toHaveLength(1);

    const second = await search.findByOemNumber(part.oemNumber);
    expect(second).toEqual(first);
  });

  it('finds a real part by alternate number', async () => {
    const part = await prisma.part.create({ data: { oemNumber: `OEM-ALT-${Date.now()}`, productName: 'Test Alternator Belt', standardizedProductName: 'test alternator belt' } });
    const altNumber = `ALT-${Date.now()}`;
    await prisma.partAlternateNumber.create({ data: { partId: part.id, number: altNumber, type: 'CROSS_REFERENCE' } });

    const results = await search.findByAlternateNumber(altNumber);
    expect(results.some((r) => r.canonicalEntityId === part.id && r.matchType === 'EXACT_ALTERNATE')).toBe(true);
  });

  it('finds a real part by real TecDoc article id', async () => {
    const tecdocId = `TEC-${Date.now()}`;
    const part = await prisma.part.create({ data: { oemNumber: `OEM-TEC-${Date.now()}`, productName: 'Test Wheel Bearing', standardizedProductName: 'test wheel bearing', tecdocArticleId: tecdocId } });

    const results = await search.findByTecdocId(tecdocId);
    expect(results.some((r) => r.canonicalEntityId === part.id && r.matchType === 'EXACT_TECDOC')).toBe(true);
  });

  it('reports a real verified supersession relationship, and never presents a pending one as verified', async () => {
    const oldPart = await prisma.part.create({ data: { oemNumber: `OEM-OLD-${Date.now()}`, productName: 'Old Part', standardizedProductName: 'old part' } });
    const newPart = await prisma.part.create({ data: { oemNumber: `OEM-NEW-${Date.now()}`, productName: 'New Part', standardizedProductName: 'new part' } });

    await prisma.partRelationship.create({
      data: { fromPartId: oldPart.id, toPartId: newPart.id, relationshipType: 'SUPERSEDED_BY', source: 'test', evidence: {}, verificationStatus: 'APPROVED', verifiedAt: new Date() },
    });

    const supersessions = await search.findSupersessions(oldPart.id);
    expect(supersessions).toHaveLength(1);
    expect(supersessions[0]).toEqual({ relationshipType: 'SUPERSEDED_BY', relatedPartId: newPart.id, verified: true });
  });

  it('flags a real category conflict between two source records sharing one OEM number', async () => {
    const part = await prisma.part.create({ data: { oemNumber: `OEM-CONFLICT-${Date.now()}`, productName: 'Conflicted Part', standardizedProductName: 'conflicted part' } });

    const source = await prisma.integrationSource.create({ data: { name: `TEST_SOURCE_${Date.now()}`, adapterType: 'test' } });
    const syncRun = await prisma.syncRun.create({ data: { sourceId: source.id } });

    const recordA = await prisma.rawSourceRecord.create({
      data: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceDatabase: 'test', sourceSchema: 'test', sourceTable: 'test', sourceRecordKey: `key-a-${Date.now()}`, feedName: 'TEST_FEED', batchId: syncRun.id, rawPayload: { part_group: 'BRAKES' }, rawChecksum: 'a' },
    });
    const recordB = await prisma.rawSourceRecord.create({
      data: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceDatabase: 'test', sourceSchema: 'test', sourceTable: 'test', sourceRecordKey: `key-b-${Date.now()}`, feedName: 'TEST_FEED', batchId: syncRun.id, rawPayload: { part_group: 'ENGINE' }, rawChecksum: 'b' },
    });
    await prisma.partExternalReference.create({ data: { partId: part.id, sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordId: recordA.sourceRecordKey } });
    await prisma.partExternalReference.create({ data: { partId: part.id, sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordId: recordB.sourceRecordKey } });

    const results = await search.findByOemNumber(part.oemNumber);
    const hit = results.find((r) => r.canonicalEntityId === part.id);
    expect(hit?.hasConflict).toBe(true);
    expect(hit?.matchType).toBe('CONFLICTING_MATCH');
    expect(hit?.matchScore).toBeLessThanOrEqual(0.6);
  });

  it('never reports a viscosity match as verified — no verified viscosity source exists yet', async () => {
    const product = await prisma.lubricantProduct.create({
      data: { brand: 'TestBrand', productName: 'Test 5W-30', normalizedName: 'test 5w-30', category: 'ENGINE_OIL', viscosity: `5W-30-${Date.now()}` },
    });

    const results = await search.findLubricantsByViscosity(product.viscosity!);
    expect(results.some((r) => r.lubricantId === product.id)).toBe(true);
    expect(results.every((r) => r.verified === false)).toBe(true);
  });

  it('returns a verified-approval match, and excludes an unverified approval for the same product', async () => {
    const product = await prisma.lubricantProduct.create({
      data: { brand: 'TestBrand', productName: 'Test Approval Oil', normalizedName: 'test approval oil', category: 'ENGINE_OIL' },
    });
    const oemBrand = `VW-${Date.now()}`;
    await prisma.lubricantApproval.create({ data: { lubricantProductId: product.id, oemBrand, approvalCode: '504.00', isVerified: true } });
    await prisma.lubricantApproval.create({ data: { lubricantProductId: product.id, oemBrand, approvalCode: '507.00', isVerified: false } });

    const verifiedResults = await search.findLubricantsByVerifiedApproval(oemBrand, '504.00');
    expect(verifiedResults.some((r) => r.lubricantId === product.id)).toBe(true);

    const unverifiedResults = await search.findLubricantsByVerifiedApproval(oemBrand, '507.00');
    expect(unverifiedResults.some((r) => r.lubricantId === product.id)).toBe(false);
  });
});
