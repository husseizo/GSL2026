import { Injectable } from '@nestjs/common';
import { GarageJobStatus, InspectionFinding } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WAITING_PARTS_STATUSES: GarageJobStatus[] = [GarageJobStatus.WAITING_PARTS];
const WAITING_APPROVAL_STATUSES: GarageJobStatus[] = [
  GarageJobStatus.WAITING_CUSTOMER_APPROVAL,
  GarageJobStatus.WAITING_ADDITIONAL_APPROVAL,
];
const IN_WORKSHOP_STATUSES: GarageJobStatus[] = Object.values(GarageJobStatus).filter(
  (s) => s !== GarageJobStatus.COMPLETED && s !== GarageJobStatus.CANCELLED,
);

// Every figure here is computed on demand from existing tables — no
// duplicate analytics table, the same choice Phase 2 made for
// TechnicianProductivity (see decision-log-phase3.md). Fine at Phase 3's
// data volume; a high-volume deployment would push this into the Phase 4
// analytics warehouse, same scale note as Phase 2's InventoryAnalyticsService.
@Injectable()
export class WorkshopAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(branchId?: string) {
    const [
      vehiclesInWorkshop,
      jobsByStatusRaw,
      waitingParts,
      waitingApproval,
      warrantyJobs,
      repeatRepairs,
      inspectionFailures,
    ] = await Promise.all([
      this.prisma.garageJob.count({ where: { branchId, status: { in: IN_WORKSHOP_STATUSES } } }),
      this.prisma.garageJob.groupBy({ by: ['status'], where: { branchId }, _count: true }),
      this.prisma.garageJob.count({ where: { branchId, status: { in: WAITING_PARTS_STATUSES } } }),
      this.prisma.garageJob.count({ where: { branchId, status: { in: WAITING_APPROVAL_STATUSES } } }),
      this.prisma.garageJob.count({ where: { branchId, isWarranty: true } }),
      this.prisma.repeatRepairFlag.count({ where: { job: { branchId } } }),
      this.prisma.inspectionResult.count({ where: { job: { branchId }, finding: InspectionFinding.FAIL } }),
    ]);

    return {
      vehiclesInWorkshop,
      jobsByStatus: Object.fromEntries(jobsByStatusRaw.map((r) => [r.status, r._count])),
      jobsWaitingParts: waitingParts,
      jobsWaitingApproval: waitingApproval,
      warrantyJobs,
      repeatRepairFlags: repeatRepairs,
      inspectionFailures,
    };
  }

  async getAverageRepairDurationHours(branchId?: string) {
    const completedJobs = await this.prisma.garageJob.findMany({
      where: { branchId, status: GarageJobStatus.COMPLETED, closedAt: { not: null } },
      select: { openedAt: true, closedAt: true },
    });
    if (completedJobs.length === 0) return null;
    const totalHours = completedJobs.reduce((sum, j) => sum + (j.closedAt!.getTime() - j.openedAt.getTime()) / 3_600_000, 0);
    return totalHours / completedJobs.length;
  }

  async getLabourRevenue(branchId?: string) {
    const lines = await this.prisma.garageJobLine.findMany({
      where: { lineType: 'LABOUR', job: branchId ? { branchId } : undefined },
    });
    return lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
  }

  async getTechnicianUtilization(technicianId: string, sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const logs = await this.prisma.technicianTimeLog.findMany({
      where: { technicianId, startedAt: { gte: since }, endedAt: { not: null } },
    });
    const totalMinutesLogged = logs.reduce((sum, l) => sum + (l.actualMinutes ?? 0), 0);
    const availableMinutes = sinceDays * 8 * 60; // 8-hour working day assumption
    return {
      technicianId,
      jobsWorked: new Set(logs.map((l) => l.jobId)).size,
      totalHoursLogged: totalMinutesLogged / 60,
      utilizationPct: availableMinutes > 0 ? (totalMinutesLogged / availableMinutes) * 100 : 0,
    };
  }

  async getMostCommonRepairs(branchId?: string, limit = 10) {
    const lines = await this.prisma.garageJobLine.groupBy({
      by: ['labourOperationId'],
      where: { lineType: 'LABOUR', labourOperationId: { not: null }, job: branchId ? { branchId } : undefined },
      _count: true,
      orderBy: { _count: { labourOperationId: 'desc' } },
      take: limit,
    });
    const operations = await this.prisma.labourOperation.findMany({
      where: { id: { in: lines.map((l) => l.labourOperationId!) } },
    });
    const opById = new Map(operations.map((o) => [o.id, o]));
    return lines.map((l) => ({ operation: opById.get(l.labourOperationId!)?.name ?? 'Unknown', count: l._count }));
  }

  async getPartsConsumed(branchId?: string) {
    const lines = await this.prisma.garageJobLine.groupBy({
      by: ['partId'],
      where: { lineType: 'PART', partId: { not: null }, job: branchId ? { branchId } : undefined },
      _sum: { quantity: true },
    });
    const parts = await this.prisma.part.findMany({ where: { id: { in: lines.map((l) => l.partId!) } } });
    const partById = new Map(parts.map((p) => [p.id, p]));
    return lines.map((l) => ({ part: partById.get(l.partId!)?.productName ?? 'Unknown', quantity: Number(l._sum.quantity ?? 0) }));
  }

  async getLubricantsConsumed(branchId?: string) {
    const lines = await this.prisma.garageJobLine.groupBy({
      by: ['lubricantProductId'],
      where: { lineType: 'LUBRICANT', lubricantProductId: { not: null }, job: branchId ? { branchId } : undefined },
      _sum: { quantity: true },
    });
    const lubricants = await this.prisma.lubricantProduct.findMany({ where: { id: { in: lines.map((l) => l.lubricantProductId!) } } });
    const lubricantById = new Map(lubricants.map((l) => [l.id, l]));
    return lines.map((l) => ({
      lubricant: lubricantById.get(l.lubricantProductId!)?.productName ?? 'Unknown',
      quantity: Number(l._sum.quantity ?? 0),
    }));
  }

  async getDelayedJobs(branchId?: string) {
    const now = new Date();
    return this.prisma.garageJob.findMany({
      where: {
        branchId,
        status: { in: IN_WORKSHOP_STATUSES },
        reception: { expectedCompletionAt: { lt: now } },
      },
      include: { reception: true },
    });
  }
}
