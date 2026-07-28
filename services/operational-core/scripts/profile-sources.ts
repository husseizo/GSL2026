/* eslint-disable no-console */
// Real, READ-ONLY discovery against live production source systems. Every
// query here is a metadata/system-catalog SELECT or an approximate/fast row
// count — never a full table scan, DML, or DDL. This script exists to
// produce the source-profiling deliverables required before any adapter or
// mapping is designed (see docs/data-consolidation/source-profiling.md) —
// it must never be extended to write to a source database.
import 'dotenv/config';
import * as sql from 'mssql';
import { Client as PgClient } from 'pg';
import { writeFileSync } from 'fs';

function header(title: string) {
  console.log('\n' + '='.repeat(90));
  console.log(title);
  console.log('='.repeat(90));
}

interface SqlServerTableProfile {
  schema: string;
  table: string;
  approxRowCount: number;
  columns: { name: string; type: string; maxLength: number | null; nullable: boolean; isIdentity: boolean }[];
  primaryKeyColumns: string[];
}

async function profileSqlServerDatabase(database: string): Promise<SqlServerTableProfile[]> {
  const pool = await new sql.ConnectionPool({
    server: process.env.SQLSERVER_HOST!,
    database,
    user: process.env.SQLSERVER_USER!,
    password: process.env.SQLSERVER_PASSWORD!,
    options: {
      encrypt: process.env.SQLSERVER_ENCRYPT === 'true',
      trustServerCertificate: process.env.SQLSERVER_TRUST_SERVER_CERT === 'true',
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  }).connect();

  try {
    // Approximate row counts via sys.dm_db_partition_stats — avoids a full
    // table scan (COUNT(*)) against a live production database.
    const tablesResult = await pool.request().query(`
      SELECT s.name AS schema_name, t.name AS table_name,
             SUM(CASE WHEN p.index_id IN (0,1) THEN p.rows ELSE 0 END) AS approx_row_count
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.partitions p ON t.object_id = p.object_id
      GROUP BY s.name, t.name
      ORDER BY s.name, t.name
    `);

    const columnsResult = await pool.request().query(`
      SELECT s.name AS schema_name, t.name AS table_name, c.name AS column_name,
             ty.name AS data_type, c.max_length, c.is_nullable, c.is_identity
      FROM sys.columns c
      JOIN sys.tables t ON c.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      ORDER BY s.name, t.name, c.column_id
    `);

    const pkResult = await pool.request().query(`
      SELECT s.name AS schema_name, t.name AS table_name, c.name AS column_name
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE i.is_primary_key = 1
      ORDER BY s.name, t.name, ic.key_ordinal
    `);

    const profiles = new Map<string, SqlServerTableProfile>();
    for (const row of tablesResult.recordset) {
      const key = `${row.schema_name}.${row.table_name}`;
      profiles.set(key, { schema: row.schema_name, table: row.table_name, approxRowCount: Number(row.approx_row_count), columns: [], primaryKeyColumns: [] });
    }
    for (const row of columnsResult.recordset) {
      const key = `${row.schema_name}.${row.table_name}`;
      profiles.get(key)?.columns.push({ name: row.column_name, type: row.data_type, maxLength: row.max_length, nullable: row.is_nullable, isIdentity: row.is_identity });
    }
    for (const row of pkResult.recordset) {
      const key = `${row.schema_name}.${row.table_name}`;
      profiles.get(key)?.primaryKeyColumns.push(row.column_name);
    }

    return [...profiles.values()].sort((a, b) => b.approxRowCount - a.approxRowCount);
  } finally {
    await pool.close();
  }
}

interface PgTableProfile {
  schema: string;
  table: string;
  approxRowCount: number;
  columns: { name: string; type: string; nullable: boolean }[];
}

async function profilePostgresDatabase(connectionString: string): Promise<PgTableProfile[]> {
  const client = new PgClient({ connectionString });
  await client.connect();
  try {
    const tablesResult = await client.query(`
      SELECT n.nspname AS schema_name, c.relname AS table_name, c.reltuples::bigint AS approx_row_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, c.relname
    `);

    const columnsResult = await client.query(`
      SELECT table_schema, table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name, ordinal_position
    `);

    const profiles = new Map<string, PgTableProfile>();
    for (const row of tablesResult.rows) {
      const key = `${row.schema_name}.${row.table_name}`;
      profiles.set(key, { schema: row.schema_name, table: row.table_name, approxRowCount: Number(row.approx_row_count), columns: [] });
    }
    for (const row of columnsResult.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      profiles.get(key)?.columns.push({ name: row.column_name, type: row.data_type, nullable: row.is_nullable === 'YES' });
    }

    return [...profiles.values()].sort((a, b) => b.approxRowCount - a.approxRowCount);
  } finally {
    await client.end();
  }
}

async function main() {
  const report: Record<string, unknown> = {};

  header('SOURCE 1: SQL Server — MolasCacheDb (lubricants SAP cache)');
  try {
    const profile = await profileSqlServerDatabase(process.env.SQLSERVER_MOLAS_LUBRICANTS_DATABASE!);
    console.log(`Connected. ${profile.length} tables found.`);
    for (const t of profile) {
      console.log(`  ${t.schema}.${t.table} — ~${t.approxRowCount} rows, ${t.columns.length} columns, PK=[${t.primaryKeyColumns.join(', ')}]`);
    }
    report.molasCacheDb = profile;
  } catch (err) {
    console.error(`FAILED to connect/profile MolasCacheDb: ${(err as Error).message}`);
    report.molasCacheDb = { error: (err as Error).message };
  }

  header('SOURCE 2: SQL Server — MOLAS_Live_2021_Cache (spare parts SAP cache)');
  try {
    const profile = await profileSqlServerDatabase(process.env.SQLSERVER_MOLAS_SPARES_DATABASE!);
    console.log(`Connected. ${profile.length} tables found.`);
    for (const t of profile) {
      console.log(`  ${t.schema}.${t.table} — ~${t.approxRowCount} rows, ${t.columns.length} columns, PK=[${t.primaryKeyColumns.join(', ')}]`);
    }
    report.molasLive2021Cache = profile;
  } catch (err) {
    console.error(`FAILED to connect/profile MOLAS_Live_2021_Cache: ${(err as Error).message}`);
    report.molasLive2021Cache = { error: (err as Error).message };
  }

  header('SOURCE 3: Neon Postgres — Parts_Catalog (VIN search data)');
  try {
    const profile = await profilePostgresDatabase(process.env.NEON_PARTS_CATALOG_DATABASE_URL!);
    console.log(`Connected. ${profile.length} tables found.`);
    for (const t of profile) {
      console.log(`  ${t.schema}.${t.table} — ~${t.approxRowCount} rows, ${t.columns.length} columns`);
    }
    report.neonPartsCatalog = profile;
  } catch (err) {
    console.error(`FAILED to connect/profile Neon Parts_Catalog: ${(err as Error).message}`);
    report.neonPartsCatalog = { error: (err as Error).message };
  }

  header('SOURCE 4: Neon Postgres — Molaslubes (SAP<->Odoo middleware output)');
  try {
    const profile = await profilePostgresDatabase(process.env.NEON_MOLASLUBES_DATABASE_URL!);
    console.log(`Connected. ${profile.length} tables found.`);
    for (const t of profile) {
      console.log(`  ${t.schema}.${t.table} — ~${t.approxRowCount} rows, ${t.columns.length} columns`);
    }
    report.neonMolaslubes = profile;
  } catch (err) {
    console.error(`FAILED to connect/profile Neon Molaslubes: ${(err as Error).message}`);
    report.neonMolaslubes = { error: (err as Error).message };
  }

  writeFileSync('scripts/.profile-report.json', JSON.stringify(report, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  header('DONE — full report written to scripts/.profile-report.json (gitignored, contains raw schema detail)');
}

main().catch((err) => {
  console.error('PROFILING SCRIPT FAILED:', err);
  process.exit(1);
});
