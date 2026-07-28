import { PrismaClient } from '@prisma/client';

// Runs once before the whole integration suite. Tests use fixed, readable
// fixture IDs (not randomly generated) for readability, so the suite must
// start from a genuinely empty database each run rather than relying on
// every test file to clean up its own rows.
module.exports = async function globalSetup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://aios:aios_dev_password@127.0.0.1:55432/aios_operational_test?schema=public';
  process.env.DATABASE_URL = databaseUrl;

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const tables: Array<{ tablename: string }> = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'`,
    );
    if (tables.length > 0) {
      const quoted = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
};
