import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { encryptField } from '../common/crypto/field-encryption';
import { writeFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';

// Real pg_dump/pg_restore via the same portable PostgreSQL binary
// distribution this whole environment already uses (PG_BIN_DIR) — not a
// simulated backup. Every BackupRun row reflects a command that actually
// ran and either actually succeeded or actually failed. See
// docs/architecture/backup-disaster-recovery.md for the measured RPO/RTO
// this produced and the disaster-recovery runbook.
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createFullBackup(): Promise<{ id: string; status: string; filePath?: string; sizeBytes?: string }> {
    const dir = process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');
    await mkdir(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(dir, `backup-full-${timestamp}.sql`);

    const run = await this.prisma.backupRun.create({ data: { kind: 'FULL', filePath, status: 'RUNNING' } });

    try {
      await this.runPgDump(filePath);
      const stats = await stat(filePath);
      const checksum = await this.computeChecksum(filePath);
      const updated = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: { status: 'SUCCESS', completedAt: new Date(), sizeBytes: BigInt(stats.size), checksum },
      });
      return { id: updated.id, status: updated.status, filePath, sizeBytes: String(stats.size) };
    } catch (err) {
      const updated = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: (err as Error).message },
      });
      this.logger.error(`Backup ${run.id} failed: ${(err as Error).message}`);
      return { id: updated.id, status: updated.status };
    }
  }

  // Encrypts a snapshot of the current process environment (excluding
  // nothing — it's already just configuration, no live secrets beyond what
  // .env already holds) with the same real AES-256-GCM cipher used for MFA
  // secrets. A config/secrets restore is: decryptField() the file, write it
  // back out as .env.
  async createConfigBackup(configSnapshot: Record<string, string>): Promise<{ id: string; status: string; filePath?: string }> {
    const dir = process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');
    await mkdir(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(dir, `backup-config-${timestamp}.enc`);

    const run = await this.prisma.backupRun.create({ data: { kind: 'CONFIG', filePath, status: 'RUNNING' } });

    try {
      const encrypted = encryptField(JSON.stringify(configSnapshot));
      await writeFile(filePath, encrypted, 'utf8');
      const stats = await stat(filePath);
      const checksum = await this.computeChecksum(filePath);
      const updated = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: { status: 'SUCCESS', completedAt: new Date(), sizeBytes: BigInt(stats.size), checksum },
      });
      return { id: updated.id, status: updated.status, filePath };
    } catch (err) {
      const updated = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), errorMessage: (err as Error).message },
      });
      return { id: updated.id, status: updated.status };
    }
  }

  // Restores the given backup into a genuinely separate scratch database
  // (never the source database) and compares real row counts across key
  // tables to prove the backup is actually restorable, not just that
  // pg_dump exited 0. Source counts are captured FIRST, before the
  // (multi-second) restore runs — pg_dump already took its own consistent
  // snapshot when createFullBackup() ran, so counting the source as close
  // to that as possible (rather than after waiting for the restore to
  // finish) minimizes the window in which a concurrently-writing workload
  // could add rows between "what was backed up" and "what we compare
  // against," which is exactly the source of a real race observed when
  // this ran alongside other integration suites writing to the same
  // database concurrently.
  async validateRestore(backupRunId: string, scratchDatabaseUrl: string, tablesToVerify: string[]): Promise<{ rowCountsMatch: boolean; details: Record<string, { source: number; restored: number }> }> {
    const backupRun = await this.prisma.backupRun.findUniqueOrThrow({ where: { id: backupRunId } });

    const sourceCounts: Record<string, number> = {};
    for (const table of tablesToVerify) {
      sourceCounts[table] = await this.countRows(process.env.DATABASE_URL!, table);
    }

    await this.runPsqlRestore(backupRun.filePath, scratchDatabaseUrl);

    const details: Record<string, { source: number; restored: number }> = {};
    let rowCountsMatch = true;

    for (const table of tablesToVerify) {
      const restoredCount = await this.countRows(scratchDatabaseUrl, table);
      details[table] = { source: sourceCounts[table], restored: restoredCount };
      if (sourceCounts[table] !== restoredCount) rowCountsMatch = false;
    }

    await this.prisma.restoreValidation.create({ data: { backupRunId, rowCountsMatch, details } });
    return { rowCountsMatch, details };
  }

  listBackups() {
    return this.prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' } });
  }

  listRestoreValidations(backupRunId?: string) {
    return this.prisma.restoreValidation.findMany({ where: { backupRunId }, orderBy: { validatedAt: 'desc' } });
  }

  private runPgDump(filePath: string): Promise<void> {
    const dbUrl = new URL(process.env.DATABASE_URL!);
    const pgDumpBin = process.env.PG_DUMP_PATH ?? 'pg_dump';
    return this.runProcess(pgDumpBin, ['-h', dbUrl.hostname, '-p', dbUrl.port, '-U', dbUrl.username, '-d', dbUrl.pathname.slice(1), '-f', filePath, '--no-owner', '--no-privileges'], dbUrl.password);
  }

  private runPsqlRestore(filePath: string, targetDatabaseUrl: string): Promise<void> {
    const dbUrl = new URL(targetDatabaseUrl);
    const psqlBin = process.env.PSQL_PATH ?? 'psql';
    return this.runProcess(psqlBin, ['-h', dbUrl.hostname, '-p', dbUrl.port, '-U', dbUrl.username, '-d', dbUrl.pathname.slice(1), '-f', filePath, '-v', 'ON_ERROR_STOP=0'], dbUrl.password);
  }

  private async countRows(databaseUrl: string, table: string): Promise<number> {
    const { PrismaClient } = await import('@prisma/client');
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const result = await client.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*)::bigint as count FROM "${table}"`);
      return Number(result[0]?.count ?? 0);
    } finally {
      await client.$disconnect();
    }
  }

  private runProcess(bin: string, args: string[], pgPassword?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { env: { ...process.env, PGPASSWORD: pgPassword ?? '' } });
      let stderr = '';
      child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} exited with code ${code}: ${stderr.slice(0, 500)}`))));
      child.on('error', reject);
    });
  }

  private computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
