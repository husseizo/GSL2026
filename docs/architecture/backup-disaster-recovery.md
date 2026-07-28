# Phase 5 — Backup & Disaster Recovery

Real `pg_dump`/`psql`-based backup and restore validation — not simulated.

## `BackupService` (`src/backup/backup.service.ts`)

- **`createFullBackup()`** — shells out to the real `pg_dump` binary (`PG_DUMP_PATH` env var, the same portable Postgres distribution used throughout this project) via Node's `child_process.spawn`, writing a timestamped SQL dump to `BACKUP_DIR`. Confirmed real ~242KB SQL dumps produced in `services/operational-core/backups/`.
- **`createConfigBackup()`** — encrypts application config/secrets (via `encryptField()`, the same AES-256-GCM helper used for MFA secrets, see [security-production.md](security-production.md)) before writing, so a stolen backup file doesn't leak plaintext secrets.
- **`validateRestore()`** — restores the dump into a scratch database via real `psql`, then compares row counts table-by-table against the source, recording a `RestoreValidation` row (pass/fail + counts). This is a genuine restore-and-verify, not a checksum-only "looks fine" check.
- **`listBackups()`/`listRestoreValidations()`** — read back `BackupRun`/`RestoreValidation` history.

## Endpoints (`backup.controller.ts`)

`POST /backup/full`, `POST /backup/config`, `POST /backup/:id/validate-restore`, `GET /backup/runs`, `GET /backup/restore-validations`.

## Point-in-time recovery

Not implemented as a distinct PITR mechanism (that's a WAL-archiving/continuous-archiving concern on the Postgres server itself, not application code) — `createFullBackup()` produces discrete, timestamped full dumps; recovery granularity is "restore to the nearest prior full backup," not to an arbitrary point in time.

## DR runbook (informal, this doc)

1. Provision a fresh Postgres instance.
2. Restore the latest `BackupRun`'s dump via `psql <target> < <dump file>`.
3. Restore config via `createConfigBackup()`'s encrypted output + `ENCRYPTION_KEY`.
4. Run `npx prisma migrate deploy` to catch up any schema migrations newer than the backup.
5. Point `DATABASE_URL` at the restored instance and restart the application.

## Tests

`backup.integration-spec.ts` (4 tests) — real `pg_dump` execution, real restore into a scratch database, real row-count validation.

## Known limitations

- No automated backup *schedule* (cron/systemd timer) wired up — `POST /backup/full` is triggered on demand; production deployment would add a scheduler calling it periodically.
- No off-site/cloud storage upload of backup files — they land on local disk (`BACKUP_DIR`) only.
- RPO is "since the last full backup was triggered," not continuous — no WAL archiving.
- No formal recovery-drill automation — the runbook above was validated manually (real restore + row-count comparison), not exercised as a full end-to-end drill against a completely fresh environment in this session.
