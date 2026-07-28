import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import { createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { BackupService } from './backup.service';

const SCRATCH_DATABASE_URL = 'postgresql://aios:aios_dev_password@127.0.0.1:55432/aios_restore_scratch?schema=public';

// Real pg_dump against the real test database, real psql restore into a
// genuinely separate scratch database, real row-count comparison — not a
// simulation of any of these steps. See docs/architecture/backup-disaster-recovery.md.
describe('BackupService (integration, real pg_dump/psql)', () => {
  let prisma: PrismaService;
  let backup: BackupService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    backup = new BackupService(prisma);

    // Ensure the scratch database starts empty so the restore is a clean,
    // repeatable proof rather than accumulating across test runs.
    const scratchClient = new Client({ connectionString: SCRATCH_DATABASE_URL });
    await scratchClient.connect();
    await scratchClient.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await scratchClient.end();
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a real full backup via pg_dump and records a real file checksum/size', async () => {
    await createVehicleFixture(prisma, 'backup-1');

    const result = await backup.createFullBackup();
    expect(result.status).toBe('SUCCESS');
    expect(result.filePath).toBeDefined();
    expect(Number(result.sizeBytes)).toBeGreaterThan(0);
  }, 60_000);

  it('validates a restore into a real, separate scratch database with matching row counts', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'backup-2');
    await createVehicleFixture(prisma, 'backup-2');

    const backupResult = await backup.createFullBackup();
    expect(backupResult.status).toBe('SUCCESS');

    const validation = await backup.validateRestore(backupResult.id, SCRATCH_DATABASE_URL, ['Vehicle', 'Branch']);

    expect(validation.rowCountsMatch).toBe(true);
    expect(validation.details.Vehicle.source).toBeGreaterThan(0);
    expect(validation.details.Vehicle.restored).toBe(validation.details.Vehicle.source);
    expect(validation.details.Branch.restored).toBe(validation.details.Branch.source);

    const recorded = await prisma.restoreValidation.findFirst({ where: { backupRunId: backupResult.id } });
    expect(recorded?.rowCountsMatch).toBe(true);

    void branch;
  }, 90_000);

  it('creates an encrypted config backup that is not readable as plaintext', async () => {
    const result = await backup.createConfigBackup({ DATABASE_URL: 'postgresql://example', JWT_SECRET_CURRENT: 'super-secret-value' });
    expect(result.status).toBe('SUCCESS');

    const fs = await import('fs/promises');
    const contents = await fs.readFile(result.filePath!, 'utf8');
    expect(contents).not.toContain('super-secret-value');
  }, 30_000);

  it('lists real persisted backup runs', async () => {
    const backups = await backup.listBackups();
    expect(backups.length).toBeGreaterThan(0);
    expect(backups.every((b) => ['SUCCESS', 'FAILED', 'RUNNING'].includes(b.status))).toBe(true);
  });
});
