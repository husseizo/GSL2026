import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stableChecksum } from '../../integration/checksum';
import { InventoryReadinessService } from '../inventory-readiness.service';

export interface MetricResult {
  metricName: string;
  definition: string;
  formula: string;
  value: number;
  currency?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_READY' | 'NOT_AVAILABLE';
  segment?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

const BASELINE_CODE_VERSION = 'data-readiness-baseline-v1';

// Real KPI computation against the real, already-imported data (customers,
// sales orders/lines, parts) — nothing here is estimated or simulated.
// Inventory and garage metrics are explicitly marked NOT_READY/
// NOT_AVAILABLE per the phase's rule against fabricating a value the real
// data can't support. See docs/data-readiness/baseline-metrics-catalogue.md.
@Injectable()
export class BaselineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryReadiness: InventoryReadinessService,
  ) {}

  async computeCustomerMetrics(asOf: Date): Promise<MetricResult[]> {
    const customers = await this.prisma.customer.findMany({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' }, select: { id: true, isActive: true, createdAt: true } });
    const activeCount = customers.filter((c) => c.isActive).length;

    const inactivityWindows = [30, 60, 90, 180, 365];
    const inactivityResults: MetricResult[] = [];
    for (const days of inactivityWindows) {
      const cutoff = new Date(asOf.getTime() - days * 24 * 60 * 60 * 1000);
      const withRecentSale = await this.prisma.salesDocument.groupBy({ by: ['customerId'], where: { customerId: { not: null }, documentDate: { gte: cutoff } } });
      const activeCustomerIds = new Set(withRecentSale.map((r) => r.customerId));
      const inactiveCount = customers.filter((c) => c.isActive && !activeCustomerIds.has(c.id)).length;
      inactivityResults.push({
        metricName: `customers_inactive_${days}d`,
        definition: `Active customers with no SalesDocument.documentDate within the last ${days} days`,
        formula: `count(Customer WHERE isActive AND id NOT IN (SalesDocument.customerId WHERE documentDate >= now() - ${days}d))`,
        value: inactiveCount,
        confidence: 'HIGH',
      });
    }

    const repeatCustomers = await this.prisma.salesDocument.groupBy({ by: ['customerId'], where: { customerId: { not: null } }, _count: true });
    const repeatCount = repeatCustomers.filter((r) => r._count > 1).length;
    const withAnyOrder = repeatCustomers.length;

    return [
      { metricName: 'active_customers', definition: 'Customers with isActive=true', formula: 'count(Customer WHERE isActive)', value: activeCount, confidence: 'HIGH' },
      { metricName: 'total_customers', definition: 'All imported real customers (lubricants source)', formula: 'count(Customer)', value: customers.length, confidence: 'HIGH' },
      {
        metricName: 'repeat_customer_rate',
        definition: 'Share of customers with more than one real SalesDocument',
        formula: 'count(customers with >1 SalesDocument) / count(customers with >=1 SalesDocument)',
        value: withAnyOrder > 0 ? round(repeatCount / withAnyOrder) : 0,
        confidence: withAnyOrder > 0 ? 'HIGH' : 'LOW',
      },
      ...inactivityResults,
    ];
  }

  async computeSalesMetrics(dateRangeStart: Date, dateRangeEnd: Date): Promise<MetricResult[]> {
    const docs = await this.prisma.salesDocument.findMany({
      where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS', documentDate: { gte: dateRangeStart, lte: dateRangeEnd } },
      select: { grandTotal: true, status: true },
    });

    const total = docs.reduce((sum, d) => sum.plus(d.grandTotal), new Prisma.Decimal(0));
    const count = docs.length;
    const avg = count > 0 ? total.dividedBy(count) : new Prisma.Decimal(0);
    const sorted = [...docs].sort((a, b) => Number(a.grandTotal) - Number(b.grandTotal));
    const median = sorted.length > 0 ? Number(sorted[Math.floor(sorted.length / 2)].grandTotal) : 0;
    const cancelledCount = docs.filter((d) => d.status === 'CANCELLED').length;
    const openCount = docs.filter((d) => d.status === 'OPEN').length;

    return [
      { metricName: 'total_sales_order_value', definition: 'Sum of SalesDocument.grandTotal for SALES_ORDER documents in range', formula: 'SUM(grandTotal)', value: Number(total), currency: 'TZS', confidence: 'HIGH', evidence: { dateRangeStart, dateRangeEnd } },
      { metricName: 'sales_order_count', definition: 'Count of SALES_ORDER documents in range', formula: 'COUNT(*)', value: count, confidence: 'HIGH' },
      { metricName: 'average_order_value', definition: 'Mean SalesDocument.grandTotal in range', formula: 'SUM(grandTotal) / COUNT(*)', value: Number(avg), currency: 'TZS', confidence: count > 0 ? 'HIGH' : 'LOW' },
      { metricName: 'median_order_value', definition: 'Median SalesDocument.grandTotal in range', formula: 'MEDIAN(grandTotal)', value: median, currency: 'TZS', confidence: count > 0 ? 'HIGH' : 'LOW' },
      { metricName: 'cancelled_order_rate', definition: 'Share of orders with status=CANCELLED', formula: 'count(CANCELLED) / count(*)', value: count > 0 ? round(cancelledCount / count) : 0, confidence: 'HIGH' },
      { metricName: 'open_order_rate', definition: 'Share of orders with status=OPEN', formula: 'count(OPEN) / count(*)', value: count > 0 ? round(openCount / count) : 0, confidence: 'HIGH' },
    ];
  }

  async computeDataPipelineMetrics(): Promise<MetricResult[]> {
    const [totalRaw, importedRaw, manualReviewRaw, failedRaw] = await Promise.all([
      this.prisma.rawSourceRecord.count(),
      this.prisma.rawSourceRecord.count({ where: { processingStatus: 'IMPORTED' } }),
      this.prisma.rawSourceRecord.count({ where: { processingStatus: 'MANUAL_REVIEW' } }),
      this.prisma.syncDeadLetter.count({ where: { resolvedAt: null } }),
    ]);

    return [
      { metricName: 'import_success_rate', definition: 'Share of staged records that reached IMPORTED status', formula: 'count(IMPORTED) / count(*)', value: totalRaw > 0 ? round(importedRaw / totalRaw) : 0, confidence: 'HIGH' },
      { metricName: 'manual_review_rate', definition: 'Share of staged records routed to manual review', formula: 'count(MANUAL_REVIEW) / count(*)', value: totalRaw > 0 ? round(manualReviewRaw / totalRaw) : 0, confidence: 'HIGH' },
      { metricName: 'open_dead_letter_count', definition: 'Unresolved SyncDeadLetter rows', formula: 'count(SyncDeadLetter WHERE resolvedAt IS NULL)', value: failedRaw, confidence: 'HIGH' },
    ];
  }

  // Inventory KPIs are explicitly NOT_READY — see InventoryReadinessService
  // and docs/data-consolidation/inventory-reconstruction.md. Reported
  // honestly rather than computed from an unapproved opening balance.
  computeInventoryMetrics(): MetricResult[] {
    const scores = this.inventoryReadiness.score();
    return scores.map((s) => ({
      metricName: `inventory_readiness_${s.businessUnit.toLowerCase()}`,
      definition: `Inventory KPI readiness for ${s.businessUnit}`,
      formula: 'N/A — no approved opening balance or movement ledger exists',
      value: 0,
      confidence: 'NOT_READY' as const,
      evidence: { recommendedStrategy: s.recommendedStrategy, rationale: s.rationale },
    }));
  }

  // Garage KPIs are explicitly NOT_AVAILABLE — no real Odoo/garage
  // operational data source has been confirmed (see docs/data-sources/odoo-garage-profile.md).
  computeGarageMetrics(): MetricResult[] {
    return [
      { metricName: 'workshop_turnaround_time', definition: 'Not computable without real garage job data', formula: 'N/A', value: 0, confidence: 'NOT_AVAILABLE' },
      { metricName: 'technician_productivity', definition: 'Not computable without real garage job data', formula: 'N/A', value: 0, confidence: 'NOT_AVAILABLE' },
      { metricName: 'repeat_repair_rate', definition: 'Not computable without real garage job data', formula: 'N/A', value: 0, confidence: 'NOT_AVAILABLE' },
    ];
  }

  // Orchestrates a full, reproducible baseline run: computes every metric
  // above, records real input row counts/source cursors, and computes a
  // real checksum of both the computation itself (code version) and its
  // output (so the exact same inputs + code always produce the exact same
  // checksums — the reproducibility the phase requires).
  async runBaseline(dateRangeStart: Date, dateRangeEnd: Date, triggeredById?: string) {
    const asOf = new Date();
    const [customerMetrics, salesMetrics, pipelineMetrics, inventoryMetrics, garageMetrics] = await Promise.all([
      this.computeCustomerMetrics(asOf),
      this.computeSalesMetrics(dateRangeStart, dateRangeEnd),
      this.computeDataPipelineMetrics(),
      Promise.resolve(this.computeInventoryMetrics()),
      Promise.resolve(this.computeGarageMetrics()),
    ]);

    const allMetrics = [...customerMetrics, ...salesMetrics, ...pipelineMetrics, ...inventoryMetrics, ...garageMetrics];

    const sourceCursors = await this.prisma.integrationSource.findMany({ select: { name: true, lastCommittedCursor: true } });
    const inputRowCounts = {
      customers: await this.prisma.customer.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
      salesDocuments: await this.prisma.salesDocument.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
      salesDocumentLines: await this.prisma.salesDocumentLine.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
    };

    const calculationChecksum = stableChecksum({ version: BASELINE_CODE_VERSION, metricNames: allMetrics.map((m) => m.metricName).sort() });
    const outputChecksum = stableChecksum(allMetrics.map((m) => ({ name: m.metricName, value: m.value })));

    const run = await this.prisma.baselineRun.create({
      data: {
        dataCutoffAt: asOf,
        sourceCursors: sourceCursors as unknown as object,
        inputRowCounts: inputRowCounts as object,
        calculationChecksum,
        outputChecksum,
        triggeredById,
      },
    });

    for (const metric of allMetrics) {
      const definition = await this.getOrCreateDefinition(metric);
      await this.prisma.baselineMetric.create({
        data: {
          baselineRunId: run.id,
          baselineDefinitionId: definition.id,
          segment: (metric.segment ?? {}) as object,
          value: new Prisma.Decimal(metric.value),
          currency: metric.currency,
          dateRangeStart,
          dateRangeEnd,
          confidence: metric.confidence,
          evidence: (metric.evidence ?? {}) as object,
        },
      });
    }

    return { run, metricCount: allMetrics.length, calculationChecksum, outputChecksum };
  }

  async approveBaseline(baselineRunId: string, approvedById: string) {
    return this.prisma.baselineRun.update({ where: { id: baselineRunId }, data: { status: 'APPROVED', approvedById, approvedAt: new Date() } });
  }

  async compareBaselineRuns(runIdA: string, runIdB: string) {
    const [metricsA, metricsB] = await Promise.all([
      this.prisma.baselineMetric.findMany({ where: { baselineRunId: runIdA }, include: { baselineDefinition: true } }),
      this.prisma.baselineMetric.findMany({ where: { baselineRunId: runIdB }, include: { baselineDefinition: true } }),
    ]);

    const byName = new Map(metricsB.map((m) => [m.baselineDefinition.metricName, m]));
    return metricsA.map((a) => {
      const b = byName.get(a.baselineDefinition.metricName);
      return {
        metricName: a.baselineDefinition.metricName,
        valueA: Number(a.value),
        valueB: b ? Number(b.value) : null,
        delta: b ? Number(a.value) - Number(b.value) : null,
      };
    });
  }

  private async getOrCreateDefinition(metric: MetricResult) {
    const existing = await this.prisma.baselineDefinition.findFirst({ where: { metricName: metric.metricName }, orderBy: { version: 'desc' } });
    if (existing && existing.formula === metric.formula) return existing;
    return this.prisma.baselineDefinition.create({
      data: {
        metricName: metric.metricName,
        version: (existing?.version ?? 0) + 1,
        definition: metric.definition,
        formula: metric.formula,
        sourceSystems: ['MOLAS_CACHE_LUBRICANTS'] as unknown as object,
      },
    });
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
