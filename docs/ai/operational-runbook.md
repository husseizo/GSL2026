# Operational Runbook — DGX Prototype 1 (updated for Prototype 1.5)

## Starting the platform in this environment

1. **Postgres** (`127.0.0.1:55432`, database `aios_operational`) and **Redis/Memurai** (`127.0.0.1:16379`) must already be running — both were found already running throughout this project's sessions; see `docker-compose.yml`/`scripts/start-dev-redis.js` for how they were originally provisioned.
2. **DGX/Ollama service** (`127.0.0.1:8800`): a real local FastAPI wrapper around Ollama. Verify with `curl http://127.0.0.1:8800/v1/health` — expect `{"status":"ok", ...}`. If unreachable, `CatalogueSearchService`/deterministic lookups still work; only the RAG generative path degrades (see [dgx-fallback.md](dgx-fallback.md)).
3. **Operational Core backend**:
   ```bash
   cd services/operational-core
   PORT=3900 npm run start:dev
   ```
   **Real port-conflict note from this session**: the repo's own `.env` default is `PORT=3000`, but this environment already had an unrelated process bound to `0.0.0.0:3000`. Always check `netstat -ano | grep :3000` (or the platform equivalent) before relying on the `.env` default, and override with `PORT=3900` (or any free port) as shown above rather than editing the committed `.env`.
4. **Web Management Portal**:
   ```bash
   cd services/web-portal
   npm install
   npm run dev
   ```
   Already configured (`services/web-portal/.env`: `VITE_API_BASE_URL=http://127.0.0.1:3900`) to match the backend port above — no edit needed if you follow step 3 exactly.

## Verifying the platform is healthy

```bash
curl http://127.0.0.1:3900/health          # aggregate: db + redis + dgx
curl http://127.0.0.1:3900/health/db
curl http://127.0.0.1:3900/health/redis
curl http://127.0.0.1:3900/health/dgx
curl http://127.0.0.1:3900/metrics         # Prometheus-format counters
curl http://127.0.0.1:3900/api-docs        # Swagger UI (HTTP 200 expected)
```

## Running the full verification pipeline (this phase's own real, executed order)

```bash
cd services/operational-core
npx prisma validate
npx prisma migrate status
npx tsc --noEmit
npm run lint
npm run build
npm test                          # unit suite (55 suites / 396 tests as of this acceptance pass)
npm run test:integration          # real Postgres + real DGX/Ollama, --runInBand — real duration is long (see note below)
npx ts-node -T scripts/verify-dgx-catalogue-rag.ts
npx ts-node -T scripts/verify-ai-evaluation-framework.ts       # DGX Prototype 1.6
npx ts-node -T scripts/verify-automotive-knowledge-platform.ts # DGX Prototype 1.7
```

**Real timing note**: the full `test:integration` run touches every real-DGX-dependent integration spec across the entire platform (Phase 4's RAG/assistants specs, this phase's 5 catalogue-ai specs, and others), serialized via `--runInBand` on CPU-only Ollama. This genuinely takes on the order of an hour in this environment — plan accordingly, and do not assume a stall if it runs long; verify via a real process check (`tasklist`/`ps`) rather than only watching for piped output, since piping through `tail` (or any buffering command) hides all output until the process exits.

## Known issues found and fixed this project (carry these lessons forward)

- **Real rate-limiting bug in bulk embedding jobs**: `AiGatewayService.embed()` is capped at 30 requests/60s per actor. Any future bulk corpus-indexing job must pace its own calls (see `CatalogueIndexVersionService.paceEmbedCall()`, ~2.1s/call) — do not call `KnowledgeBaseService.ingestDocument()` in a tight loop under one actor id.
- **Windows Prisma-client regeneration lock**: `npx prisma generate`/`migrate dev` can fail with `EPERM` on the query-engine DLL if a lingering `ts-node`/`jest` process still holds it open. Find and stop the offending process (`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*ts-node*' -or $_.CommandLine -like '*jest*' }`) before retrying.
- **`register()` returned the full `User` row, including `passwordHash`/`mfaSecretEncrypted`** — confirmed via a real live call during the Prototype 1 acceptance pass. **Fixed in DGX Prototype 1.5** — see [../ai-tuning/security-hotfix.md](../ai-tuning/security-hotfix.md) for the real fix (`USER_SAFE_SELECT`, applied to `register()`, plus two related leaks found in the same audit: `ApiKeysService`'s `keyHash` exposure and `requestEmailVerification()`'s in-band token return).
- **Never run a `--testPathPattern`-scoped integration suite while a full, unscoped `npm run test:integration` is still executing** (DGX Prototype 1.5 finding) — both share one test database, and `test-global-setup-integration.ts` truncates it at the start of *every* jest invocation. Running a scoped rerun while the full suite is still in progress silently invalidates the full run's results. Let one integration-test invocation finish completely before starting another.
- **Piping a long-running background command through `tail`** (e.g. `... 2>&1 | tail -150`) hides all output until the *entire* command exits — this makes a genuinely-running-but-slow process look identical to a hung one. Verify liveness via a real process check (`tasklist`/`wmic process where "CommandLine like '%jest%'"` get `ProcessId,CreationDate`) and compare the process's start time against the current time, rather than assuming a stall from empty piped output alone.
- **Postgres in this environment is a portable binary, not a Windows service** (DGX Prototype 1.7 finding) — it does not survive a machine restart automatically. If `npm run start:dev`/integration tests suddenly can't reach `127.0.0.1:55432`, check whether the machine was restarted before assuming data loss: the real data directory (see `PG_DUMP_PATH` in `services/operational-core/.env` for its location) survives a restart intact via Postgres's own WAL-based crash recovery — restart it with `pg_ctl.exe start -D <data-dir> -l <logfile> -o "-p 55432" -w`, then confirm with `npx prisma migrate status` (should report "up to date", not request a fresh migration) and a real row-count spot-check before concluding anything was lost. The DGX FastAPI proxy (port 8800) and backend dev server (port 3900) likewise do not restart themselves and need the same manual restart described above.

## Stopping the platform

The backend/portal dev processes started for this verification session are long-running foreground/background processes — stop them with a normal process kill (`Ctrl+C` in an interactive shell, or terminate the PID) rather than any destructive action against Postgres/Redis/Ollama, which are shared, persistent services this project does not own the lifecycle of.
