import { Injectable, Logger } from '@nestjs/common';
import { DeadLetterStage, RawRecordProcessingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { stableChecksum } from '../integration/checksum';
import { SourceAdapter } from '../integration/adapters/source-adapter.interface';
import { IntegrationService } from '../integration/integration.service';

export interface StagingBatchSummary {
  syncRunId: string;
  feedName: string;
  recordsFetched: number;
  recordsStaged: number;
  recordsUnchanged: number;
  recordsFailed: number;
  cursorAfter: string | null;
}

export interface StagingTableInfo {
  sourceSystem: string;
  sourceDatabase: string;
  sourceSchema: string;
  sourceTable: string;
}

// The one thing genuinely new about this phase's integration pipeline:
// every record lands in RawSourceRecord BEFORE anything touches a domain
// table (Customer, Part, LubricantProduct, ...) — "Do not import raw data
// directly into domain tables." Reuses IntegrationSource/SyncRun for
// checkpointing (same unique-feed-identity fix as every other Phase 5
// adapter) and IntegrationService.recordDeadLetter() for the dead-letter
// store, rather than re-implementing either. See
// docs/data-consolidation/staging-model.md.
@Injectable()
export class StagingService {
  private readonly logger = new Logger(StagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationService: IntegrationService,
  ) {}

  async stageBatch<TRaw extends { sourceRecordKey: string }>(
    adapter: SourceAdapter<TRaw>,
    feedName: string,
    table: StagingTableInfo,
  ): Promise<StagingBatchSummary> {
    const source = await this.getOrCreateSource(feedName, adapter.constructor.name);
    const syncRun = await this.prisma.syncRun.create({
      data: { sourceId: source.id, cursorBefore: source.lastCommittedCursor },
    });

    let cursor = source.lastCommittedCursor;
    let recordsFetched = 0;
    let recordsStaged = 0;
    let recordsUnchanged = 0;
    let recordsFailed = 0;

    try {
      for await (const batch of adapter.fetchChanges(cursor)) {
        for (const record of batch.records) {
          recordsFetched += 1;

          if (record.operation === 'DELETE') {
            recordsFailed += 1;
            continue;
          }

          const rawChecksum = stableChecksum(record.payload);

          try {
            const existing = await this.prisma.rawSourceRecord.findUnique({
              where: { feedName_sourceRecordKey: { feedName, sourceRecordKey: record.sourceRecordId } },
            });

            if (existing && existing.rawChecksum === rawChecksum) {
              // Identical re-extraction — the same idempotent-replay
              // guarantee as Phase 1's checksum-based dedup, just applied one
              // layer earlier (at staging, not at domain upsert).
              recordsUnchanged += 1;
              continue;
            }

            await this.prisma.rawSourceRecord.upsert({
              where: { feedName_sourceRecordKey: { feedName, sourceRecordKey: record.sourceRecordId } },
              create: {
                sourceSystem: table.sourceSystem,
                sourceDatabase: table.sourceDatabase,
                sourceSchema: table.sourceSchema,
                sourceTable: table.sourceTable,
                sourceRecordKey: record.sourceRecordId,
                feedName,
                batchId: syncRun.id,
                rawPayload: record.payload as object,
                rawChecksum,
                sourceUpdatedAt: record.sourceTimestamp,
                processingStatus: RawRecordProcessingStatus.STAGED,
              },
              update: {
                batchId: syncRun.id,
                rawPayload: record.payload as object,
                rawChecksum,
                sourceUpdatedAt: record.sourceTimestamp,
                // A re-extraction with genuinely different content resets
                // downstream processing status — it must be re-validated/
                // re-normalized/re-matched, not assumed still valid.
                processingStatus: RawRecordProcessingStatus.STAGED,
                validationStatus: 'PENDING',
                normalizationStatus: 'NOT_NORMALIZED',
                matchingStatus: null,
              },
            });
            recordsStaged += 1;
          } catch (err) {
            await this.integrationService.recordDeadLetter({
              sourceSystem: table.sourceSystem,
              sourceRecordId: record.sourceRecordId,
              entityType: adapter.entityType,
              stage: DeadLetterStage.VALIDATE,
              rawPayload: record.payload,
              error: (err as Error).message,
            });
            recordsFailed += 1;
          }
        }

        cursor = batch.cursor;
        await this.prisma.integrationSource.update({ where: { id: source.id }, data: { lastCommittedCursor: cursor } });
      }

      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          cursorAfter: cursor,
          recordsFetched,
          recordsUpserted: recordsStaged,
          recordsSkipped: recordsUnchanged,
          recordsFailed,
        },
      });

      return { syncRunId: syncRun.id, feedName, recordsFetched, recordsStaged, recordsUnchanged, recordsFailed, cursorAfter: cursor };
    } catch (err) {
      this.logger.error(`Staging batch for feed ${feedName} failed`, err as Error);
      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          cursorAfter: cursor,
          recordsFetched,
          recordsUpserted: recordsStaged,
          recordsSkipped: recordsUnchanged,
          recordsFailed,
          error: (err as Error).message,
        },
      });
      return { syncRunId: syncRun.id, feedName, recordsFetched, recordsStaged, recordsUnchanged, recordsFailed, cursorAfter: cursor };
    }
  }

  listStaged(feedName: string, status?: RawRecordProcessingStatus) {
    return this.prisma.rawSourceRecord.findMany({ where: { feedName, processingStatus: status }, orderBy: { extractedAt: 'asc' } });
  }

  private async getOrCreateSource(name: string, adapterType: string) {
    const existing = await this.prisma.integrationSource.findUnique({ where: { name } });
    if (existing) return existing;
    return this.prisma.integrationSource.create({ data: { name, adapterType, extractionMode: 'DATE_RANGE' } });
  }
}
