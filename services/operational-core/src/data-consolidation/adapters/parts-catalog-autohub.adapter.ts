import { Client } from 'pg';
import { AdapterHealth, AdapterMetadata, EnterpriseSourceAdapter } from '../../integration/adapters/enterprise-source-adapter.interface';
import { RawChangeBatch, SyncCursor } from '../../integration/adapters/source-adapter.interface';

// Real, read-only Postgres connectivity against the Neon-hosted Parts_Catalog
// database — confirmed the real spare-parts source of truth (AutoHub
// commercial documents + oitm/tecdoc item master + VIN catalog), per
// explicit user direction after MOLAS_Live_2021_Cache profiled as empty.
// See docs/data-sources/parts-catalog-autohub-profile.md. Same extraction-
// mode simplification as MolasLubricantsCacheAdapter — see its header
// comment and docs/data-consolidation/decision-log.md.
export interface PartsCatalogFeedConfig {
  feedName: string;
  table: string; // e.g. `public.oitm`, `public."NeonAutoHubSalesOrders"`
  keyColumn: string; // e.g. "item_code", "DocEntry"
  dateColumn?: string;
  sinceDate?: Date;
  entityType: 'CUSTOMER' | 'PART' | 'LUBRICANT' | 'SUPPLIER' | 'SALES_DOCUMENT' | 'PURCHASE_DOCUMENT';
  batchSize?: number;
  // DGX Prototype 1.7.1 — optional, additive bounding for tables too large to
  // fetch in full for a pilot (e.g. tecdoc_article_vehicle at 3.38M real
  // rows). Unset for every existing caller — zero behavior change. When set,
  // appended as `LIMIT ${limit}` after the existing ORDER BY, so the sample
  // is deterministic (lowest keyColumn values), never random.
  limit?: number;
}

export class PartsCatalogAutoHubAdapter implements EnterpriseSourceAdapter<Record<string, unknown> & { sourceRecordKey: string }> {
  readonly sourceSystem = 'PARTS_CATALOG_AUTOHUB';
  readonly entityType: EnterpriseSourceAdapter['entityType'];

  constructor(private readonly config: PartsCatalogFeedConfig) {
    this.entityType = config.entityType;
  }

  private async connect(): Promise<Client> {
    const client = new Client({ connectionString: process.env.NEON_PARTS_CATALOG_DATABASE_URL! });
    await client.connect();
    return client;
  }

  async authenticate(): Promise<void> {
    const client = await this.connect();
    await client.end();
  }

  async health(): Promise<AdapterHealth> {
    const started = Date.now();
    try {
      const client = await this.connect();
      await client.query('SELECT 1');
      await client.end();
      return { reachable: true, authenticated: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { reachable: false, authenticated: false, message: (err as Error).message };
    }
  }

  async getMetadata(): Promise<AdapterMetadata> {
    return { systemName: 'Parts_Catalog (Neon Postgres — AutoHub + TecDoc + VIN)', supportedEntities: ['PART', 'SALES_DOCUMENT'] };
  }

  async *fetchChanges(_cursor: SyncCursor): AsyncIterable<RawChangeBatch<Record<string, unknown> & { sourceRecordKey: string }>> {
    const client = await this.connect();
    const batchSize = this.config.batchSize ?? 500;

    try {
      const values: unknown[] = [];
      let whereClause = '';
      if (this.config.dateColumn && this.config.sinceDate) {
        values.push(this.config.sinceDate);
        whereClause = `WHERE "${this.config.dateColumn}" >= $1`;
      }

      const limitClause = this.config.limit ? ` LIMIT ${this.config.limit}` : '';
      const result = await client.query(`SELECT * FROM ${this.config.table} ${whereClause} ORDER BY "${this.config.keyColumn}"${limitClause}`, values);
      const rows = result.rows as Record<string, unknown>[];

      const extractedAt = new Date().toISOString();
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        yield {
          cursor: extractedAt,
          records: chunk.map((row) => ({
            sourceRecordId: String(row[this.config.keyColumn]),
            operation: 'UPSERT' as const,
            payload: { ...row, sourceRecordKey: String(row[this.config.keyColumn]) },
            sourceTimestamp: this.config.dateColumn ? new Date(row[this.config.dateColumn] as string) : new Date(),
          })),
        };
      }
    } finally {
      await client.end();
    }
  }
}
