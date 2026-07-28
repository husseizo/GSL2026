import { Injectable } from '@nestjs/common';
import { AppEventType, DeadLetterStage, Prisma } from '@prisma/client';
import { PaginationQueryDto, paginate, toSkipTake } from '../common/pagination/pagination.dto';
import { stableChecksum } from '../integration/checksum';
import { IntegrationService } from '../integration/integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { IngestAppEventDto } from './dto/ingest-event.dto';

export interface IngestBatchResult {
  accepted: number;
  rejected: number;
}

// Not every log record is valid — invalid ones are routed to the same
// dead-letter store Phase 1's integration engine uses, rather than silently
// dropped or allowed to crash the batch. See
// docs/architecture/log-event-schema.md.
@Injectable()
export class AppEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: IntegrationService,
  ) {}

  async ingestBatch(sourceApplication: string, events: IngestAppEventDto[]): Promise<IngestBatchResult> {
    let accepted = 0;
    let rejected = 0;

    for (const event of events) {
      const occurredAt = new Date(event.occurredAt);
      const validEventType = event.eventType in AppEventType;
      const validTimestamp = !Number.isNaN(occurredAt.getTime());

      if (!validEventType || !validTimestamp) {
        await this.integration.recordDeadLetter({
          sourceSystem: sourceApplication,
          sourceRecordId: event.sourceEventId,
          entityType: 'APP_EVENT',
          stage: DeadLetterStage.VALIDATE,
          rawPayload: event,
          error: !validEventType ? `unknown eventType "${event.eventType}"` : `invalid occurredAt "${event.occurredAt}"`,
        });
        rejected += 1;
        continue;
      }

      const [part, lubricant, vehicle] = await Promise.all([
        event.itemCode
          ? this.prisma.part.findFirst({ where: { OR: [{ internalItemCode: event.itemCode }, { oemNumber: event.itemCode }] } })
          : null,
        event.itemCode ? this.prisma.lubricantProduct.findFirst({ where: { internalCode: event.itemCode } }) : null,
        event.vin ? this.prisma.vehicle.findUnique({ where: { vin: event.vin.toUpperCase() } }) : null,
      ]);

      // Hashed separately from the Prisma payload so the checksum never
      // depends on which fields Prisma's input type happens to require.
      const checksumInput = {
        eventType: event.eventType,
        occurredAt: occurredAt.toISOString(),
        userExternalId: event.userExternalId,
        customerExternalId: event.customerExternalId,
        branchCode: event.branchCode,
        warehouseCode: event.warehouseCode,
        searchQuery: event.searchQuery,
        itemCode: event.itemCode,
        partId: part?.id,
        lubricantProductId: lubricant?.id,
        vin: event.vin,
        vehicleId: vehicle?.id,
        sessionId: event.sessionId,
        correlationId: event.correlationId,
        endpoint: event.endpoint,
        durationMs: event.durationMs,
        statusCode: event.statusCode,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
        metadata: event.metadata,
      };
      const checksum = stableChecksum(checksumInput);

      const data: Prisma.AppEventUncheckedCreateInput = {
        sourceApplication,
        sourceEventId: event.sourceEventId,
        checksum,
        eventType: event.eventType as AppEventType,
        occurredAt,
        userExternalId: event.userExternalId,
        customerExternalId: event.customerExternalId,
        branchCode: event.branchCode,
        warehouseCode: event.warehouseCode,
        searchQuery: event.searchQuery,
        itemCode: event.itemCode,
        partId: part?.id,
        lubricantProductId: lubricant?.id,
        vin: event.vin,
        vehicleId: vehicle?.id,
        sessionId: event.sessionId,
        correlationId: event.correlationId,
        endpoint: event.endpoint,
        durationMs: event.durationMs,
        statusCode: event.statusCode,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      };

      await this.prisma.appEvent.upsert({
        where: { sourceApplication_sourceEventId: { sourceApplication, sourceEventId: event.sourceEventId } },
        create: data,
        update: data,
      });
      accepted += 1;
    }

    return { accepted, rejected };
  }

  search(query: PaginationQueryDto & { eventType?: AppEventType; sessionId?: string }) {
    const where = {
      eventType: query.eventType,
      sessionId: query.sessionId,
      searchQuery: query.search ? { contains: query.search, mode: 'insensitive' as const } : undefined,
      occurredAt:
        query.dateFrom || query.dateTo
          ? { gte: query.dateFrom ? new Date(query.dateFrom) : undefined, lte: query.dateTo ? new Date(query.dateTo) : undefined }
          : undefined,
    };
    return this.prisma.appEvent
      .findMany({ where, ...toSkipTake(query), orderBy: { occurredAt: 'desc' } })
      .then(async (data) => paginate(data, await this.prisma.appEvent.count({ where }), query));
  }

  listFailed() {
    return this.integration.listDeadLetters('APP_EVENT');
  }

  listZeroResultSearches(query: PaginationQueryDto) {
    return this.searchByType(AppEventType.ZERO_RESULT_SEARCH, query);
  }

  listOutOfStockInteractions(query: PaginationQueryDto) {
    return this.searchByType(AppEventType.OUT_OF_STOCK_VIEW, query);
  }

  private async searchByType(eventType: AppEventType, query: PaginationQueryDto) {
    const where = { eventType };
    const [data, total] = await Promise.all([
      this.prisma.appEvent.findMany({ where, ...toSkipTake(query), orderBy: { occurredAt: 'desc' } }),
      this.prisma.appEvent.count({ where }),
    ]);
    return paginate(data, total, query);
  }
}
