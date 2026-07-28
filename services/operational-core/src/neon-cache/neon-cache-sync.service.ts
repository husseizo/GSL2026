import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';

export interface CacheRecord {
  id: string;
  data: unknown;
}

export interface CachedRow {
  id: string;
  data: unknown;
  syncedAt: Date;
}

// Real cross-database replication into a read-optimized cache — never the
// primary write path (Operational Core Postgres remains the sole source of
// truth for every write in this system). No real Neon (neon.tech) account
// exists in this environment, so NEON_DATABASE_URL points at a second,
// genuinely separate PostgreSQL database on the local instance for this
// session — Neon IS Postgres-compatible under the hood, so the same
// connection-string-based sync mechanism built here works unchanged
// against a real Neon endpoint later; only the URL changes. See
// docs/architecture/neon-cache.md for exactly what was and wasn't proven
// against real Neon infrastructure.
@Injectable()
export class NeonCacheSyncService implements OnModuleDestroy {
  private readonly logger = new Logger(NeonCacheSyncService.name);
  private client: Client | null = null;

  constructor(private readonly prisma: PrismaService) {}

  isConfigured(): boolean {
    return !!process.env.NEON_DATABASE_URL;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const client = await this.getClient();
      await client.query('SELECT 1');
      return true;
    } catch (err) {
      this.logger.warn(`Neon cache database unreachable: ${(err as Error).message}`);
      return false;
    }
  }

  async syncDataset(datasetName: string, records: CacheRecord[]): Promise<{ synced: number }> {
    const client = await this.getClient();
    let synced = 0;
    for (const record of records) {
      await client.query(
        `INSERT INTO cache_snapshot (dataset_name, record_id, data, synced_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (dataset_name, record_id) DO UPDATE SET data = $3, synced_at = now()`,
        [datasetName, record.id, JSON.stringify(record.data)],
      );
      synced += 1;
    }
    return { synced };
  }

  async getCachedDataset(datasetName: string): Promise<CachedRow[]> {
    const client = await this.getClient();
    const result = await client.query(
      'SELECT record_id, data, synced_at FROM cache_snapshot WHERE dataset_name = $1 ORDER BY record_id',
      [datasetName],
    );
    return result.rows.map((row) => ({ id: row.record_id, data: row.data, syncedAt: row.synced_at }));
  }

  // A real, concrete dataset: purchase recommendations read from the
  // genuine Operational Core Postgres (source of truth) and pushed into
  // the Neon-side cache for fast, non-blocking dashboard reads. Only ever
  // reads from the operational DB and writes to the cache DB — never the
  // reverse.
  async syncPurchaseRecommendations(): Promise<{ synced: number }> {
    const recommendations = await this.prisma.purchaseRecommendation.findMany({ orderBy: { generatedAt: 'desc' }, take: 500 });
    return this.syncDataset(
      'purchase-recommendations',
      recommendations.map((r) => ({
        id: r.id,
        data: { action: r.action, suggestedQuantity: Number(r.suggestedQuantity), confidence: r.confidence, generatedAt: r.generatedAt },
      })),
    );
  }

  private async getClient(): Promise<Client> {
    if (!this.isConfigured()) throw new Error('NEON_DATABASE_URL is not configured — Neon cache sync is unavailable');
    if (!this.client) {
      this.client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
      await this.client.connect();
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }
}
