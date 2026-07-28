// Integration tests hit a real PostgreSQL database — never the dev database
// (aios_operational), always the dedicated test one, so a failing assertion
// or an interrupted run can never corrupt data someone is looking at.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://aios:aios_dev_password@127.0.0.1:55432/aios_operational_test?schema=public';

// Phase 5: a real Redis instance (redis-memory-server, started separately
// for this session via scripts/start-dev-redis.js) — never a mock client.
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:16379';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'integration-test-encryption-key-not-for-prod';
process.env.JWT_SECRET_CURRENT = process.env.JWT_SECRET_CURRENT ?? 'integration-test-jwt-secret';
process.env.JWT_KID_CURRENT = process.env.JWT_KID_CURRENT ?? 'k1';
process.env.BRANCH_GATEWAY_SIGNING_KEY = process.env.BRANCH_GATEWAY_SIGNING_KEY ?? 'integration-test-branch-gateway-signing-key';
process.env.NEON_DATABASE_URL =
  process.env.NEON_DATABASE_URL ?? 'postgresql://aios:aios_dev_password@127.0.0.1:55432/aios_neon_cache?schema=public';
process.env.PG_DUMP_PATH =
  process.env.PG_DUMP_PATH ??
  'C:/Users/hussein.abdurahmani/AppData/Local/Temp/claude/f--GSL2026/42986fe1-bb16-41e8-b2fe-85569a27cb7d/scratchpad/pg/pgsql/bin/pg_dump.exe';
process.env.PSQL_PATH =
  process.env.PSQL_PATH ??
  'C:/Users/hussein.abdurahmani/AppData/Local/Temp/claude/f--GSL2026/42986fe1-bb16-41e8-b2fe-85569a27cb7d/scratchpad/pg/pgsql/bin/psql.exe';
process.env.BACKUP_DIR = process.env.BACKUP_DIR ?? './backups-test';
