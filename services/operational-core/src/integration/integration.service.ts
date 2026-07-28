import { Injectable, Logger } from '@nestjs/common';
import { DeadLetterStage, SyncRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SourceAdapter } from './adapters/source-adapter.interface';
import { EntitySyncHandler } from './entity-sync-handler.interface';

export interface SyncRunSummary {
  syncRunId: string;
  status: SyncRunStatus;
  recordsFetched: number;
  recordsUpserted: number;
  recordsSkipped: number;
  recordsFailed: number;
  cursorAfter: string | null;
}

// The one engine every SourceAdapter + EntitySyncHandler pair runs through.
// Implements the fixed pipeline order from docs/architecture/02-integration-contracts.md §2:
// fetch -> validate -> normalize -> dedup(checksum) -> upsert -> commit cursor.
// Reconciliation (§2 step 7) is a separate scheduled job, not part of this path.
@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runSync<TRaw, TNormalized>(
    adapter: SourceAdapter<TRaw>,
    handler: EntitySyncHandler<TRaw, TNormalized>,
  ): Promise<SyncRunSummary> {
    const source = await this.getOrCreateSource(adapter.sourceSystem, adapter.constructor.name);
    const syncRun = await this.prisma.syncRun.create({
      data: { sourceId: source.id, cursorBefore: source.lastCommittedCursor },
    });

    let cursor = source.lastCommittedCursor;
    let recordsFetched = 0;
    let recordsUpserted = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;

    try {
      for await (const batch of adapter.fetchChanges(cursor)) {
        for (const record of batch.records) {
          recordsFetched += 1;

          if (record.operation === 'DELETE') {
            // Phase 1 does not implement soft-delete propagation; deletes are
            // counted so the reconciliation job can flag the gap explicitly.
            recordsSkipped += 1;
            continue;
          }

          const validation = handler.validate(record.payload);
          if (!validation.valid) {
            await this.deadLetter(
              adapter.sourceSystem,
              record.sourceRecordId,
              handler.entityType,
              DeadLetterStage.VALIDATE,
              record.payload,
              validation.error ?? 'validation failed',
            );
            recordsFailed += 1;
            continue;
          }

          let normalized: TNormalized;
          try {
            normalized = await handler.normalize(record.payload);
          } catch (err) {
            await this.deadLetter(
              adapter.sourceSystem,
              record.sourceRecordId,
              handler.entityType,
              DeadLetterStage.NORMALIZE,
              record.payload,
              (err as Error).message,
            );
            recordsFailed += 1;
            continue;
          }

          const checksum = handler.checksum(normalized);
          const existingChecksum = await handler.getExistingChecksum(
            adapter.sourceSystem,
            record.sourceRecordId,
          );

          if (existingChecksum === checksum) {
            // No-op: identical payload already synced. This is what makes
            // cursor replay after a crash safe rather than duplicating writes.
            recordsSkipped += 1;
            continue;
          }

          try {
            await handler.upsert({
              sourceSystem: adapter.sourceSystem,
              sourceRecordId: record.sourceRecordId,
              recordVersion: record.recordVersion,
              checksum,
              normalized,
            });
            recordsUpserted += 1;
          } catch (err) {
            await this.deadLetter(
              adapter.sourceSystem,
              record.sourceRecordId,
              handler.entityType,
              DeadLetterStage.UPSERT,
              record.payload,
              (err as Error).message,
            );
            recordsFailed += 1;
          }
        }

        cursor = batch.cursor;
        await this.prisma.integrationSource.update({
          where: { id: source.id },
          data: { lastCommittedCursor: cursor },
        });
      }

      return this.finalizeSyncRun(syncRun.id, SyncRunStatus.COMPLETED, cursor, {
        recordsFetched,
        recordsUpserted,
        recordsSkipped,
        recordsFailed,
      });
    } catch (err) {
      this.logger.error(`Sync run ${syncRun.id} failed`, err as Error);
      return this.finalizeSyncRun(
        syncRun.id,
        SyncRunStatus.FAILED,
        cursor,
        { recordsFetched, recordsUpserted, recordsSkipped, recordsFailed },
        (err as Error).message,
      );
    }
  }

  listDeadLetters(entityType?: string) {
    return this.prisma.syncDeadLetter.findMany({
      where: { entityType, resolvedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  resolveDeadLetter(id: string, resolvedById: string, resolution: string) {
    return this.prisma.syncDeadLetter.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedById, resolution },
    });
  }

  private async getOrCreateSource(name: string, adapterType: string) {
    const existing = await this.prisma.integrationSource.findUnique({ where: { name } });
    if (existing) return existing;
    return this.prisma.integrationSource.create({ data: { name, adapterType } });
  }

  // Public entry point so modules outside the sync-run pipeline (e.g.
  // app-event ingestion) can route invalid records to the same dead-letter
  // store, without exposing the sync-run-internal `deadLetter` signature.
  recordDeadLetter(params: {
    sourceSystem: string;
    sourceRecordId: string;
    entityType: string;
    stage: DeadLetterStage;
    rawPayload: unknown;
    error: string;
  }) {
    return this.deadLetter(
      params.sourceSystem,
      params.sourceRecordId,
      params.entityType,
      params.stage,
      params.rawPayload,
      params.error,
    );
  }

  private async deadLetter(
    sourceSystem: string,
    sourceRecordId: string,
    entityType: string,
    stage: DeadLetterStage,
    rawPayload: unknown,
    error: string,
  ) {
    await this.prisma.syncDeadLetter.upsert({
      where: {
        sourceSystem_sourceRecordId_entityType_stage: {
          sourceSystem,
          sourceRecordId,
          entityType,
          stage,
        },
      },
      create: {
        sourceSystem,
        sourceRecordId,
        entityType,
        stage,
        rawPayload: rawPayload as object,
        error,
      },
      update: {
        rawPayload: rawPayload as object,
        error,
        lastSeenAt: new Date(),
        retryCount: { increment: 1 },
      },
    });
  }

  private async finalizeSyncRun(
    syncRunId: string,
    status: SyncRunStatus,
    cursorAfter: string | null,
    counts: {
      recordsFetched: number;
      recordsUpserted: number;
      recordsSkipped: number;
      recordsFailed: number;
    },
    error?: string,
  ): Promise<SyncRunSummary> {
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: { status, finishedAt: new Date(), cursorAfter, ...counts, error },
    });
    return { syncRunId, status, cursorAfter, ...counts };
  }
}
