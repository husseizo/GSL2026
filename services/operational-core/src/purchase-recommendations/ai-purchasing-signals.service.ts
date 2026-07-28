import { Injectable } from '@nestjs/common';
import { ForecastTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SEARCH_DEMAND_WINDOW_DAYS = 90;
const SEARCH_DEMAND_EVENT_TYPES = ['OUT_OF_STOCK_VIEW', 'ZERO_RESULT_SEARCH', 'STOCK_CHECK'] as const;

export interface AiPurchasingSignals {
  forecastedDemandNextWindow: number | null;
  forecastMethod: string | null;
  forecastConfidence: string | null;
  repeatRepairPartCount: number;
  searchDemandEvents90d: number;
  evidence: string[];
}

// Phase 4 §10: "Enhance Phase 2 recommendation engine. Add AI signals...
// Recommendations must remain explainable. AI never places purchase
// orders." Implemented as a strictly additive, read-only overlay:
// PurchaseRecommendationsService's deterministic action/quantity math
// (purchase-recommendation-math.ts, unchanged) still decides everything —
// this service only adds supplementary, cited evidence to the same
// recommendation's `evidence` JSON for a human reviewer to weigh. It has no
// path back into the decision itself. Every signal here reads data another
// Phase 2/3/4 module already produced (ForecastRun, RepeatRepairFlag,
// AppEvent) — nothing is recomputed or duplicated.
@Injectable()
export class AiPurchasingSignalsService {
  constructor(private readonly prisma: PrismaService) {}

  async computeSignals(params: {
    itemType: 'PART' | 'LUBRICANT';
    partId?: string | null;
    lubricantProductId?: string | null;
  }): Promise<AiPurchasingSignals> {
    const targetId = params.partId ?? params.lubricantProductId ?? undefined;
    const targetType: ForecastTargetType = params.itemType === 'PART' ? 'PART' : 'LUBRICANT';

    const [forecastRun, searchDemandEvents90d, repeatRepairPartCount] = await Promise.all([
      targetId
        ? this.prisma.forecastRun.findFirst({
            where: { targetType, targetId, chosenAsBest: true },
            include: { points: true },
            orderBy: { generatedAt: 'desc' },
          })
        : Promise.resolve(null),
      params.partId || params.lubricantProductId
        ? this.prisma.appEvent.count({
            where: {
              partId: params.partId ?? undefined,
              lubricantProductId: params.lubricantProductId ?? undefined,
              eventType: { in: [...SEARCH_DEMAND_EVENT_TYPES] },
              occurredAt: { gte: new Date(Date.now() - SEARCH_DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
            },
          })
        : Promise.resolve(0),
      params.partId ? this.countRepeatRepairsForPart(params.partId) : Promise.resolve(0),
    ]);

    const forecastedDemandNextWindow = forecastRun ? forecastRun.points.reduce((sum, p) => sum + Number(p.predictedValue), 0) : null;

    const evidence: string[] = [];
    if (forecastRun) {
      evidence.push(
        `Forecasted demand over next ${forecastRun.windowDays} day(s): ${forecastedDemandNextWindow!.toFixed(2)} ` +
          `(method ${forecastRun.method}, confidence ${forecastRun.confidence})`,
      );
    }
    if (repeatRepairPartCount > 0) {
      evidence.push(`${repeatRepairPartCount} repeat-repair job(s) on record involve this part`);
    }
    if (searchDemandEvents90d > 0) {
      evidence.push(`${searchDemandEvents90d} stock-check/out-of-stock/zero-result search event(s) in the last ${SEARCH_DEMAND_WINDOW_DAYS} days`);
    }

    return {
      forecastedDemandNextWindow,
      forecastMethod: forecastRun?.method ?? null,
      forecastConfidence: forecastRun?.confidence ?? null,
      repeatRepairPartCount,
      searchDemandEvents90d,
      evidence,
    };
  }

  private async countRepeatRepairsForPart(partId: string): Promise<number> {
    const lines = await this.prisma.garageJobLine.findMany({ where: { partId }, select: { jobId: true } });
    const jobIds = [...new Set(lines.map((l) => l.jobId))];
    if (jobIds.length === 0) return 0;
    return this.prisma.repeatRepairFlag.count({ where: { OR: [{ jobId: { in: jobIds } }, { relatedJobId: { in: jobIds } }] } });
  }
}
