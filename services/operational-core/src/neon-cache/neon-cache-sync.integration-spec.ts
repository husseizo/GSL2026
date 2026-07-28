import { PrismaService } from '../prisma/prisma.service';
import { NeonCacheSyncService } from './neon-cache-sync.service';

// Real cross-database sync: writes to a genuinely separate PostgreSQL
// database (NEON_DATABASE_URL — see docs/architecture/neon-cache.md for why
// this stands in for a real Neon endpoint, which this environment has no
// account for) and reads them back from there, never from the operational
// database.
describe('NeonCacheSyncService (integration, real cross-database sync)', () => {
  let prisma: PrismaService;
  let neonCache: NeonCacheSyncService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    neonCache = new NeonCacheSyncService(prisma);
  });

  afterAll(async () => {
    await neonCache.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('reports configured and available against the real stand-in database', async () => {
    expect(neonCache.isConfigured()).toBe(true);
    expect(await neonCache.isAvailable()).toBe(true);
  });

  it('syncs a dataset into the real cache database and reads it back from there', async () => {
    const datasetName = `test-dataset-${Date.now()}`;
    const result = await neonCache.syncDataset(datasetName, [
      { id: 'rec-1', data: { value: 42 } },
      { id: 'rec-2', data: { value: 99 } },
    ]);
    expect(result.synced).toBe(2);

    const cached = await neonCache.getCachedDataset(datasetName);
    expect(cached).toHaveLength(2);
    expect(cached.find((r) => r.id === 'rec-1')?.data).toEqual({ value: 42 });
  });

  it('re-syncing the same record IDs updates in place rather than duplicating', async () => {
    const datasetName = `test-dataset-update-${Date.now()}`;
    await neonCache.syncDataset(datasetName, [{ id: 'rec-1', data: { value: 1 } }]);
    await neonCache.syncDataset(datasetName, [{ id: 'rec-1', data: { value: 2 } }]);

    const cached = await neonCache.getCachedDataset(datasetName);
    expect(cached).toHaveLength(1);
    expect(cached[0].data).toEqual({ value: 2 });
  });

  it('syncPurchaseRecommendations reads real rows from the operational database and pushes them to the cache', async () => {
    const rec = await prisma.purchaseRecommendation.create({
      data: { itemType: 'PART', action: 'MONITOR', suggestedQuantity: 0, confidence: 'MEDIUM', evidence: {} },
    });

    const result = await neonCache.syncPurchaseRecommendations();
    expect(result.synced).toBeGreaterThan(0);

    const cached = await neonCache.getCachedDataset('purchase-recommendations');
    expect(cached.some((r) => r.id === rec.id)).toBe(true);
  });
});
