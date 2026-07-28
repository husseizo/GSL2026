import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

// Real proof that AuditLog is immutable at the database level, not just by
// convention — a raw UPDATE/DELETE against a real row is attempted and must
// be rejected by the Postgres trigger installed in migration
// 20260712083533_audit_log_immutability, not by any application-level
// check. See docs/architecture/security-production.md.
describe('AuditLog immutability (integration, real Postgres trigger)', () => {
  let prisma: PrismaService;
  let audit: AuditService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    audit = new AuditService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects a raw UPDATE against a real AuditLog row', async () => {
    const entry = await audit.log({ action: 'TEST_ACTION', entityType: 'TestEntity', entityId: 'test-1' });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET action = 'TAMPERED' WHERE id = $1`, entry.id),
    ).rejects.toThrow(/immutable/i);

    const unchanged = await prisma.auditLog.findUniqueOrThrow({ where: { id: entry.id } });
    expect(unchanged.action).toBe('TEST_ACTION');
  });

  it('rejects a raw DELETE against a real AuditLog row', async () => {
    const entry = await audit.log({ action: 'TEST_ACTION_2', entityType: 'TestEntity', entityId: 'test-2' });

    await expect(prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id = $1`, entry.id)).rejects.toThrow(/immutable/i);

    const stillExists = await prisma.auditLog.findUnique({ where: { id: entry.id } });
    expect(stillExists).not.toBeNull();
  });

  it('still allows normal INSERT (the only real write path, via AuditService.log())', async () => {
    const entry = await audit.log({ action: 'TEST_ACTION_3', entityType: 'TestEntity', entityId: 'test-3' });
    expect(entry.id).toBeDefined();
  });
});
