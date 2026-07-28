import { Inject, Injectable } from '@nestjs/common';
import { AppEvent, AppEventType, LostSaleReason, RecommendationConfidence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeLostSaleDedupeKey, computeTimeBucket } from './dedupe-key';
import { DEFAULT_LOST_SALES_CONFIG, LOST_SALES_CONFIG, LostSalesRulesConfig } from './lost-sales.config';

const DIRECT_TRIGGER_REASONS: Partial<Record<AppEventType, LostSaleReason>> = {
  [AppEventType.ZERO_RESULT_SEARCH]: LostSaleReason.ZERO_RESULT_SEARCH,
  [AppEventType.OUT_OF_STOCK_VIEW]: LostSaleReason.OUT_OF_STOCK_VIEW,
  [AppEventType.QUOTE_ABANDONED]: LostSaleReason.QUOTE_ABANDONED,
};

export interface DetectionResult {
  eventsScanned: number;
  candidatesCreatedOrUpdated: number;
}

// Deterministic, rule-based only — no ML. Every candidate traces back to the
// specific AppEvent row(s) that triggered it via LostSaleEvidence. See
// docs/architecture/lost-sales-detection.md.
@Injectable()
export class LostSalesEngineService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOST_SALES_CONFIG) private readonly config: LostSalesRulesConfig = DEFAULT_LOST_SALES_CONFIG,
  ) {}

  async detect(since?: Date): Promise<DetectionResult> {
    const events = await this.prisma.appEvent.findMany({
      where: { occurredAt: since ? { gte: since } : undefined },
      orderBy: { occurredAt: 'asc' },
    });

    let candidatesCreatedOrUpdated = 0;

    for (const event of events) {
      const reason = DIRECT_TRIGGER_REASONS[event.eventType];
      if (reason) {
        await this.upsertDirectCandidate(event, reason);
        candidatesCreatedOrUpdated += 1;
      }

      if (event.eventType === AppEventType.STOCK_CHECK && this.isInsufficientStockCheck(event)) {
        await this.upsertDirectCandidate(event, LostSaleReason.INSUFFICIENT_STOCK_CHECK);
        candidatesCreatedOrUpdated += 1;
      }

      if (event.eventType === AppEventType.ORDER_FAILED && this.isStockRelatedFailure(event)) {
        await this.upsertDirectCandidate(event, LostSaleReason.ORDER_FAILED_STOCK);
        candidatesCreatedOrUpdated += 1;
      }
    }

    candidatesCreatedOrUpdated += await this.detectRepeatedSearches(events);

    return { eventsScanned: events.length, candidatesCreatedOrUpdated };
  }

  // A human-recorded lost sale needs no log evidence at all.
  async recordManual(input: {
    partId?: string;
    lubricantProductId?: string;
    customerId?: string;
    vehicleId?: string;
    branchId?: string;
    warehouseId?: string;
    requestedQuantity?: number;
    estimatedValue?: number;
    note?: string;
  }) {
    const itemKey = input.partId ?? input.lubricantProductId ?? 'unknown';
    const dedupeKey = computeLostSaleDedupeKey({
      reason: LostSaleReason.MANUAL_REPORT,
      itemKey,
      sessionOrCustomerKey: input.customerId ?? 'anon',
      timeBucket: computeTimeBucket(new Date(), 1), // manual reports are never deduped against each other
    });

    return this.prisma.lostSaleCandidate.create({
      data: {
        reason: LostSaleReason.MANUAL_REPORT,
        partId: input.partId,
        lubricantProductId: input.lubricantProductId,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        requestedQuantity: input.requestedQuantity,
        estimatedValue: input.estimatedValue,
        confidence: RecommendationConfidence.HIGH, // a human directly observed it
        dedupeKey: `${dedupeKey}:${Date.now()}`,
        resolutionReason: input.note,
      },
    });
  }

  private isInsufficientStockCheck(event: AppEvent): boolean {
    const metadata = event.metadata as { requestedQuantity?: number; availableQuantity?: number } | null;
    if (!metadata) return false;
    return (metadata.availableQuantity ?? 0) < (metadata.requestedQuantity ?? 1);
  }

  private isStockRelatedFailure(event: AppEvent): boolean {
    return event.errorCode === 'INSUFFICIENT_STOCK' || event.errorCode === 'OUT_OF_STOCK';
  }

  private async upsertDirectCandidate(event: AppEvent, reason: LostSaleReason) {
    const itemKey = event.partId ?? event.lubricantProductId ?? event.itemCode ?? event.searchQuery ?? 'unknown';
    const sessionOrCustomerKey = event.sessionId ?? event.customerExternalId ?? 'anon';
    const timeBucket = computeTimeBucket(event.occurredAt, this.config.sessionWindowMinutes);
    const dedupeKey = computeLostSaleDedupeKey({ reason, itemKey, sessionOrCustomerKey, timeBucket });

    const candidate = await this.prisma.lostSaleCandidate.upsert({
      where: { dedupeKey },
      create: {
        reason,
        rawQuery: event.searchQuery ?? event.itemCode,
        partId: event.partId,
        lubricantProductId: event.lubricantProductId,
        vehicleId: event.vehicleId,
        confidence: event.partId || event.lubricantProductId ? RecommendationConfidence.MEDIUM : RecommendationConfidence.LOW,
        dedupeKey,
      },
      update: {}, // repeated events in the same window collapse onto the existing candidate
    });

    await this.prisma.lostSaleEvidence.upsert({
      where: { lostSaleCandidateId_appEventId: { lostSaleCandidateId: candidate.id, appEventId: event.id } },
      create: { lostSaleCandidateId: candidate.id, appEventId: event.id },
      update: {},
    });

    return candidate;
  }

  private async detectRepeatedSearches(events: AppEvent[]): Promise<number> {
    const searches = events.filter((e) => e.eventType === AppEventType.SEARCH && e.searchQuery && e.sessionId);
    const groups = new Map<string, AppEvent[]>();
    for (const event of searches) {
      const key = `${event.sessionId}::${event.searchQuery!.toLowerCase().trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    }

    const sessionsWithOrder = new Set(
      events.filter((e) => e.eventType === AppEventType.ORDER_CREATED && e.sessionId).map((e) => e.sessionId),
    );

    let created = 0;
    for (const [key, groupEvents] of groups) {
      if (groupEvents.length < this.config.repeatSearchThreshold) continue;
      const [sessionId] = key.split('::');
      if (sessionsWithOrder.has(sessionId)) continue; // the session did convert eventually

      const latest = groupEvents[groupEvents.length - 1];
      const candidate = await this.upsertDirectCandidate(latest, LostSaleReason.REPEATED_SEARCH_NO_SALE);
      for (const event of groupEvents) {
        await this.prisma.lostSaleEvidence.upsert({
          where: { lostSaleCandidateId_appEventId: { lostSaleCandidateId: candidate.id, appEventId: event.id } },
          create: { lostSaleCandidateId: candidate.id, appEventId: event.id },
          update: {},
        });
      }
      created += 1;
    }
    return created;
  }
}
