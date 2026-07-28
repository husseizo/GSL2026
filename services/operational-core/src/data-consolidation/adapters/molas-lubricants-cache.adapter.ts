import * as sql from 'mssql';
import { AdapterHealth, AdapterMetadata, EnterpriseSourceAdapter } from '../../integration/adapters/enterprise-source-adapter.interface';
import { RawChangeBatch, SyncCursor } from '../../integration/adapters/source-adapter.interface';

// Real, read-only SQL Server connectivity against MolasCacheDb — the live
// SAP<->Odoo lubricants middleware database (see
// docs/data-sources/molas-cache-db-profile.md). This adapter issues SELECT
// statements only; it never writes to the source, matching the phase's
// critical safety rule. The `sa` credential provided has full write access
// at the database level, so this read-only guarantee is enforced entirely
// here, in code — see docs/data-consolidation/decision-log.md.
//
// Extraction mode is deliberately simple for this pass: a bounded date-range
// (or, for small master-data tables, full-table) SELECT per run, not a
// true per-row incremental watermark — the real "last changed" column
// differs or is absent per table (see the source profile doc), and the
// phase's own guidance is to start with a limited, provably-correct batch
// rather than build a perfect incremental system before the basics are
// proven. The cursor records the extraction run's timestamp for audit
// purposes; it is not (yet) used to compute the next window automatically.
export interface LubricantsFeedConfig {
  feedName: string;
  table: string; // e.g. "dbo.CacheCustomers"
  keyColumn: string; // e.g. "CardCode"
  dateColumn?: string; // used for a bounded DATE_RANGE extraction; omit for full-table master data
  sinceDate?: Date;
  entityType: 'CUSTOMER' | 'PART' | 'LUBRICANT' | 'SUPPLIER' | 'SALES_DOCUMENT' | 'PURCHASE_DOCUMENT';
  batchSize?: number;
}

export class MolasLubricantsCacheAdapter implements EnterpriseSourceAdapter<Record<string, unknown> & { sourceRecordKey: string }> {
  readonly sourceSystem = 'MOLAS_CACHE_LUBRICANTS';
  readonly entityType: EnterpriseSourceAdapter['entityType'];

  constructor(private readonly config: LubricantsFeedConfig) {
    this.entityType = config.entityType;
  }

  private async connect(): Promise<sql.ConnectionPool> {
    return new sql.ConnectionPool({
      server: process.env.SQLSERVER_HOST!,
      database: process.env.SQLSERVER_MOLAS_LUBRICANTS_DATABASE!,
      user: process.env.SQLSERVER_USER!,
      password: process.env.SQLSERVER_PASSWORD!,
      options: {
        encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERT === 'true',
      },
      connectionTimeout: 15000,
      requestTimeout: 60000,
    }).connect();
  }

  async authenticate(): Promise<void> {
    const pool = await this.connect();
    await pool.close();
  }

  async health(): Promise<AdapterHealth> {
    const started = Date.now();
    try {
      const pool = await this.connect();
      await pool.request().query('SELECT 1');
      await pool.close();
      return { reachable: true, authenticated: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { reachable: false, authenticated: false, message: (err as Error).message };
    }
  }

  async getMetadata(): Promise<AdapterMetadata> {
    return { systemName: 'MolasCacheDb (SAP<->Odoo lubricants middleware)', supportedEntities: ['CUSTOMER', 'PART', 'LUBRICANT', 'SALES_DOCUMENT'] };
  }

  async *fetchChanges(_cursor: SyncCursor): AsyncIterable<RawChangeBatch<Record<string, unknown> & { sourceRecordKey: string }>> {
    const pool = await this.connect();
    const batchSize = this.config.batchSize ?? 500;

    try {
      const whereClause = this.config.dateColumn && this.config.sinceDate ? `WHERE [${this.config.dateColumn}] >= @sinceDate` : '';
      const request = pool.request();
      if (this.config.dateColumn && this.config.sinceDate) {
        request.input('sinceDate', sql.DateTime, this.config.sinceDate);
      }

      const result = await request.query(`SELECT * FROM ${this.config.table} ${whereClause} ORDER BY [${this.config.keyColumn}]`);
      const rows = result.recordset as Record<string, unknown>[];

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
      await pool.close();
    }
  }
}
