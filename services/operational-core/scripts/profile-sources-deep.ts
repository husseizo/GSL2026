/* eslint-disable no-console */
// Deep, READ-ONLY profiling of the specific tables confirmed relevant after
// the initial table-level scan (see profile-sources.ts and
// docs/data-sources/*.md). Column names below were taken from that real
// scan's output, not guessed. Every query is a SELECT — aggregate stats, a
// masked sample, min/max on date columns, and distinct-count checks for
// candidate business keys. Never writes to the source.
import 'dotenv/config';
import * as sql from 'mssql';
import { Client as PgClient } from 'pg';
import { writeFileSync } from 'fs';

function header(title: string) {
  console.log('\n' + '='.repeat(90));
  console.log(title);
  console.log('='.repeat(90));
}

function maskRow(row: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeyPattern = /phone|mobile|tel|email|tax|vat|address|contact|^cardname$|^customername$|street|city/i;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      masked[key] = value;
    } else if (sensitiveKeyPattern.test(key) && typeof value === 'string' && value.length > 0) {
      masked[key] = value.length <= 2 ? '**' : `${value[0]}${'*'.repeat(Math.min(value.length - 2, 8))}${value[value.length - 1]}`;
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

interface DeepTableProfile {
  table: string;
  rowCountExact: number;
  sampleRows: Record<string, unknown>[];
  dateColumnRanges: Record<string, { min: unknown; max: unknown }>;
  nullRates: Record<string, number>;
  distinctKeyExcess: Record<string, number>; // 0 = column is unique across all rows; negative = duplicates exist
}

async function deepProfileSqlServer(pool: sql.ConnectionPool, table: string, dateColumns: string[], nullCheckColumns: string[], candidateKeyColumns: string[]): Promise<DeepTableProfile> {
  const countResult = await pool.request().query(`SELECT COUNT(*) AS cnt FROM ${table}`);
  const rowCountExact = Number(countResult.recordset[0].cnt);

  const sampleResult = await pool.request().query(`SELECT TOP 3 * FROM ${table} ORDER BY (SELECT NULL)`);
  const sampleRows = sampleResult.recordset.map(maskRow);

  const dateColumnRanges: Record<string, { min: unknown; max: unknown }> = {};
  for (const col of dateColumns) {
    const r = await pool.request().query(`SELECT MIN([${col}]) AS mn, MAX([${col}]) AS mx FROM ${table}`);
    dateColumnRanges[col] = { min: r.recordset[0].mn, max: r.recordset[0].mx };
  }

  const nullRates: Record<string, number> = {};
  for (const col of nullCheckColumns) {
    const r = await pool.request().query(`SELECT SUM(CASE WHEN [${col}] IS NULL THEN 1 ELSE 0 END) AS nulls, COUNT(*) AS total FROM ${table}`);
    const nulls = Number(r.recordset[0].nulls);
    const total = Number(r.recordset[0].total);
    nullRates[col] = total > 0 ? Math.round((nulls / total) * 10000) / 100 : 0;
  }

  const distinctKeyExcess: Record<string, number> = {};
  for (const col of candidateKeyColumns) {
    const r = await pool.request().query(`SELECT COUNT(*) AS total, COUNT(DISTINCT [${col}]) AS distinctCount FROM ${table}`);
    distinctKeyExcess[col] = Number(r.recordset[0].distinctCount) - Number(r.recordset[0].total);
  }

  return { table, rowCountExact, sampleRows, dateColumnRanges, nullRates, distinctKeyExcess };
}

async function deepProfilePostgres(client: PgClient, table: string, dateColumns: string[], nullCheckColumns: string[], candidateKeyColumns: string[]): Promise<DeepTableProfile> {
  const countResult = await client.query(`SELECT COUNT(*)::bigint AS cnt FROM ${table}`);
  const rowCountExact = Number(countResult.rows[0].cnt);

  const sampleResult = await client.query(`SELECT * FROM ${table} LIMIT 3`);
  const sampleRows = sampleResult.rows.map(maskRow);

  const dateColumnRanges: Record<string, { min: unknown; max: unknown }> = {};
  for (const col of dateColumns) {
    const r = await client.query(`SELECT MIN("${col}") AS mn, MAX("${col}") AS mx FROM ${table}`);
    dateColumnRanges[col] = { min: r.rows[0].mn, max: r.rows[0].mx };
  }

  const nullRates: Record<string, number> = {};
  for (const col of nullCheckColumns) {
    const r = await client.query(`SELECT SUM(CASE WHEN "${col}" IS NULL THEN 1 ELSE 0 END) AS nulls, COUNT(*) AS total FROM ${table}`);
    const nulls = Number(r.rows[0].nulls);
    const total = Number(r.rows[0].total);
    nullRates[col] = total > 0 ? Math.round((nulls / total) * 10000) / 100 : 0;
  }

  const distinctKeyExcess: Record<string, number> = {};
  for (const col of candidateKeyColumns) {
    const r = await client.query(`SELECT COUNT(*)::bigint AS total, COUNT(DISTINCT "${col}")::bigint AS distinctcount FROM ${table}`);
    distinctKeyExcess[col] = Number(r.rows[0].distinctcount) - Number(r.rows[0].total);
  }

  return { table, rowCountExact, sampleRows, dateColumnRanges, nullRates, distinctKeyExcess };
}

async function main() {
  const report: Record<string, unknown> = {};

  header('DEEP PROFILE: MolasCacheDb (lubricants — real SAP<->Odoo middleware DB)');
  const lubricantsPool = await new sql.ConnectionPool({
    server: process.env.SQLSERVER_HOST!,
    database: process.env.SQLSERVER_MOLAS_LUBRICANTS_DATABASE!,
    user: process.env.SQLSERVER_USER!,
    password: process.env.SQLSERVER_PASSWORD!,
    options: { encrypt: process.env.SQLSERVER_ENCRYPT === 'true', trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERT === 'true' },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  }).connect();

  try {
    const lubricantTables: [string, string[], string[], string[]][] = [
      ['dbo.CacheCustomers', [], ['CardCode', 'CardName', 'Phone1', 'Email', 'OdooCustomerId'], ['CardCode']],
      ['dbo.CacheProducts', [], ['ItemCode', 'WarehouseCode', 'OnHandSap', 'OdooProductId'], ['ItemCode', 'WarehouseCode']],
      ['dbo.CacheSalesOrders', ['DocDate'], ['SapDocEntry', 'CustomerCode', 'DocStatus', 'OdooSalesOrderId'], ['SapDocEntry']],
      ['dbo.CacheSalesOrderLines', [], ['SapDocEntry', 'ItemCode'], []],
      ['dbo.CacheInvoices', ['DocDate'], ['SapDocEntry', 'CardCode', 'OdooInvoiceId'], ['SapDocEntry']],
      ['dbo.CacheInvoiceLines', [], ['SapDocEntry', 'ItemCode'], []],
      ['dbo.CacheDeliveries', ['DeliveryDate'], ['SapDocEntry', 'CardCode', 'IsCancelled', 'OdooDeliveryId'], ['SapDocEntry']],
      ['dbo.CacheDeliveryLines', [], ['SapDocEntry', 'ItemCode'], []],
      ['dbo.CachePayment', ['DocDate'], ['SapDocEntry', 'CardCode', 'OdooPaymentId'], ['SapDocEntry']],
      ['dbo.CacheLiquiMolyProducts', [], ['ArticleNumber', 'Name', 'SpecGrade'], ['ArticleNumber']],
    ];

    const lubricantProfiles: Record<string, DeepTableProfile | { error: string }> = {};
    for (const [table, dateCols, nullCols, keyCols] of lubricantTables) {
      try {
        console.log(`Profiling ${table}...`);
        lubricantProfiles[table] = await deepProfileSqlServer(lubricantsPool, table, dateCols, nullCols, keyCols);
      } catch (err) {
        lubricantProfiles[table] = { error: (err as Error).message };
        console.error(`  FAILED: ${(err as Error).message}`);
      }
    }
    report.lubricants = lubricantProfiles;
  } finally {
    await lubricantsPool.close();
  }

  header('DEEP PROFILE: Parts_Catalog (spare parts / AutoHub / TecDoc / VIN)');
  const pgClient = new PgClient({ connectionString: process.env.NEON_PARTS_CATALOG_DATABASE_URL! });
  await pgClient.connect();
  try {
    const partsTables: [string, string[], string[], string[]][] = [
      ['public.oitm', ['create_date', 'write_date'], ['item_code', 'article_number', 'canonical_oem_number', 'lookup_status'], ['item_code']],
      ['public.oitm_cross_reference', ['created_at'], ['oitm_id', 'oem_number', 'oem_number_normalized'], []],
      ['public.oitm_compatible_vehicle', [], ['oitm_id', 'vehicle_id'], []],
      ['public.neon_germax_products', [], [], []],
      ['public."NeonAutoHubProducts"', ['SyncedAt'], ['ItemCode', 'OnHandSap'], ['ItemCode']],
      ['public."NeonAutoHubSalesOrders"', ['DocDate'], ['DocEntry', 'CardCode', 'DocStatus'], ['DocEntry']],
      ['public."NeonAutoHubSalesOrderLines"', [], ['DocEntry', 'ItemCode'], []],
      ['public."NeonAutoHubInvoices"', ['DocDate'], ['DocEntry', 'CardCode', 'DocStatus'], ['DocEntry']],
      ['public."NeonAutoHubDeliveries"', ['DocDate'], ['DocEntry', 'CardCode', 'IsCancelled'], ['DocEntry']],
      ['public."NeonAutoHubPurchaseOrders"', ['DocDate'], ['DocEntry', 'CardCode', 'DocStatus'], ['DocEntry']],
      ['public."NeonAutoHubStockTransfers"', ['DocDate'], ['DocEntry'], ['DocEntry']],
      ['public.vin_decoded', ['decoded_at'], ['vin', 'decode_status', 'manufacturer_name'], ['vin']],
      ['public.tecdoc_vehicle', ['create_date'], ['tecdoc_id', 'manufacturer_id'], ['tecdoc_id']],
      ['public.tecdoc_article', ['create_date'], ['tecdoc_article_id', 'canonical_oem_number'], ['tecdoc_article_id']],
    ];

    const partsProfiles: Record<string, DeepTableProfile | { error: string }> = {};
    for (const [table, dateCols, nullCols, keyCols] of partsTables) {
      try {
        console.log(`Profiling ${table}...`);
        partsProfiles[table] = await deepProfilePostgres(pgClient, table, dateCols, nullCols, keyCols);
      } catch (err) {
        partsProfiles[table] = { error: (err as Error).message };
        console.error(`  FAILED: ${(err as Error).message}`);
      }
    }
    report.partsCatalog = partsProfiles;
  } finally {
    await pgClient.end();
  }

  writeFileSync('scripts/.profile-report-deep.json', JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  header('DONE — deep report written to scripts/.profile-report-deep.json (gitignored)');
}

main().catch((err) => {
  console.error('DEEP PROFILING SCRIPT FAILED:', err);
  process.exit(1);
});
