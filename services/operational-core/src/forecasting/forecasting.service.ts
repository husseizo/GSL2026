import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ForecastTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../observability/metrics.service';
import {
  backtestAndCompare,
  buildDailySeries,
  computeForecastConfidence,
  ForecastMethodName,
  generateForecast,
  pickBestMethod,
  TimeSeriesPoint,
} from './forecast-math';

const LOOKBACK_DAYS = 180;

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

// Orchestrates the pure forecast-math functions against real operational
// history (SalesDocumentLine/PurchaseDocumentLine/GarageJob — the same
// tables Phase 2's inventory analytics already reads, no parallel demand
// pipeline invented for this). Every method is backtested and its own
// ForecastRun row is persisted with its measured error, so "automatically
// compare forecasting models" produces an inspectable audit trail, not a
// single number presented as fact. See docs/architecture/forecasting.md.
@Injectable()
export class ForecastingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async generate(targetType: ForecastTargetType, targetId: string | undefined, windowDays: number) {
    const startedAt = Date.now();
    try {
      const history = await this.getHistoricalSeries(targetType, targetId);
      // buildDailySeries always zero-fills the full lookback window, so an
      // empty result set still produces a dense series of zeros — "no data"
      // means no real activity anywhere in it, not zero rows returned.
      if (history.length === 0 || history.every((p) => p.value === 0)) {
        this.metrics?.recordForecastFailure('NO_HISTORICAL_DATA');
        throw new BadRequestException(`No historical data available to forecast ${targetType}${targetId ? ` ${targetId}` : ''}`);
      }

      const testHoldoutDays = Math.max(1, Math.min(14, Math.floor(history.length * 0.2)));
      const evaluations = backtestAndCompare(history, testHoldoutDays);
      const best = pickBestMethod(evaluations);

      const runs = [];
      for (const evaluation of evaluations) {
        const isBest = best !== null && best.method === evaluation.method;
        const confidence = computeForecastConfidence(history.length, evaluation.mape);

        const run = await this.prisma.forecastRun.create({
          data: {
            targetType,
            targetId,
            windowDays,
            method: evaluation.method,
            mape: finiteOrNull(evaluation.mape),
            rmse: finiteOrNull(evaluation.rmse),
            mae: finiteOrNull(evaluation.mae),
            bias: finiteOrNull(evaluation.bias),
            // Phase II Sprint 2 fix (see docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md
            // §7, critical-path item "WAPE/MASE persistence"): both were
            // already computed correctly by computeErrorMetrics() but never
            // written here, despite the columns existing since the Data
            // Validation & Business Baselining phase. Real gap, now closed.
            wape: finiteOrNull(evaluation.wape),
            mase: finiteOrNull(evaluation.mase),
            confidence,
            chosenAsBest: isBest,
            // DGX 2.0 Certification Standard Amendment v1.1 (Remediation
            // Cycle 2): testActualSum is persisted at generation time —
            // never recomputed at certification time — so a later
            // certification run can verify "zero real business activity"
            // (Amendment v1.1 §6A condition 2/3) from this row alone.
            evidence: { historyDays: history.length, testHoldoutDays, testActualSum: evaluation.testActualSum },
          },
        });

        if (isBest) {
          const points = generateForecast(history, windowDays, evaluation.method as ForecastMethodName);
          await this.prisma.forecastPoint.createMany({
            data: points.map((p) => ({ forecastRunId: run.id, forecastDate: p.date, predictedValue: p.predictedValue })),
          });

          this.metrics?.recordForecastExecution(targetType, evaluation.method);
          this.metrics?.recordForecastConfidence(confidence);
          if (Number.isFinite(evaluation.wape)) this.metrics?.setForecastAccuracyWape(evaluation.wape);
        }

        runs.push(run);
      }

      return { runs, bestMethod: best?.method ?? null, historyDays: history.length };
    } finally {
      this.metrics?.recordForecastDuration((Date.now() - startedAt) / 1000);
    }
  }

  list(filter: { targetType?: ForecastTargetType; targetId?: string; chosenAsBest?: boolean } = {}) {
    return this.prisma.forecastRun.findMany({
      where: filter,
      include: { points: { orderBy: { forecastDate: 'asc' } } },
      orderBy: { generatedAt: 'desc' },
    });
  }

  private async getHistoricalSeries(targetType: ForecastTargetType, targetId?: string): Promise<TimeSeriesPoint[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    switch (targetType) {
      case 'PART': {
        const lines = await this.prisma.salesDocumentLine.findMany({
          where: { partId: targetId, salesDocument: { documentDate: { gte: startDate } } },
          include: { salesDocument: true },
        });
        return buildDailySeries(lines.map((l) => ({ date: l.salesDocument.documentDate, quantity: Number(l.quantity) })), startDate, endDate);
      }
      case 'LUBRICANT': {
        const lines = await this.prisma.salesDocumentLine.findMany({
          where: { lubricantProductId: targetId, salesDocument: { documentDate: { gte: startDate } } },
          include: { salesDocument: true },
        });
        return buildDailySeries(lines.map((l) => ({ date: l.salesDocument.documentDate, quantity: Number(l.quantity) })), startDate, endDate);
      }
      case 'GARAGE_WORKLOAD': {
        const jobs = await this.prisma.garageJob.findMany({
          where: { branchId: targetId, openedAt: { gte: startDate } },
        });
        return buildDailySeries(jobs.map((j) => ({ date: j.openedAt, quantity: 1 })), startDate, endDate);
      }
      case 'BRANCH': {
        const lines = await this.prisma.salesDocumentLine.findMany({
          where: { salesDocument: { branchId: targetId, documentDate: { gte: startDate } } },
          include: { salesDocument: true },
        });
        return buildDailySeries(lines.map((l) => ({ date: l.salesDocument.documentDate, quantity: Number(l.quantity) })), startDate, endDate);
      }
      case 'SUPPLIER': {
        const lines = await this.prisma.purchaseDocumentLine.findMany({
          where: { purchaseDocument: { supplierId: targetId, documentDate: { gte: startDate } } },
          include: { purchaseDocument: true },
        });
        return buildDailySeries(
          lines.map((l) => ({ date: l.purchaseDocument.documentDate, quantity: Number(l.orderedQuantity) })),
          startDate,
          endDate,
        );
      }
      case 'CUSTOMER': {
        const docs = await this.prisma.salesDocument.findMany({
          where: { customerId: targetId, documentDate: { gte: startDate } },
        });
        return buildDailySeries(docs.map((d) => ({ date: d.documentDate, quantity: 1 })), startDate, endDate);
      }
      default:
        return [];
    }
  }
}
