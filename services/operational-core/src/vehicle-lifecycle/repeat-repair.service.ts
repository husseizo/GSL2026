import { Injectable, NotFoundException } from '@nestjs/common';
import { RepeatRepairStatus } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { detectRepeatRepairs, JobRepairSignature, normalizeComplaint } from './repeat-repair-math';

const DEFAULT_WINDOW_DAYS = 180;

@Injectable()
export class RepeatRepairService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async detectForJob(jobId: string, windowDays: number = DEFAULT_WINDOW_DAYS): Promise<{ flagsCreated: number }> {
    const job = await this.prisma.garageJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Garage job ${jobId} not found`);

    const since = new Date(job.openedAt.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const priorJobs = await this.prisma.garageJob.findMany({
      where: { vehicleId: job.vehicleId, id: { not: jobId }, openedAt: { gte: since } },
    });

    const current = await this.buildSignature(jobId);
    const priorSignatures = await Promise.all(priorJobs.map((j) => this.buildSignature(j.id)));

    const matches = detectRepeatRepairs(current, priorSignatures);

    let flagsCreated = 0;
    for (const match of matches) {
      const status = job.isWarranty ? RepeatRepairStatus.WARRANTY_CANDIDATE : RepeatRepairStatus.POSSIBLE;
      await this.prisma.repeatRepairFlag.upsert({
        where: { jobId_relatedJobId_matchReason: { jobId, relatedJobId: match.relatedJobId, matchReason: match.matchReason } },
        create: { vehicleId: job.vehicleId, jobId, relatedJobId: match.relatedJobId, matchReason: match.matchReason, status },
        update: {},
      });
      flagsCreated += 1;
    }

    return { flagsCreated };
  }

  listForVehicle(vehicleId: string) {
    return this.prisma.repeatRepairFlag.findMany({ where: { vehicleId }, orderBy: { detectedAt: 'desc' } });
  }

  // Routed through the generic Phase 2 AuditService rather than a dedicated
  // history table — unlike job transitions (JobStatusHistory), approvals
  // (ApprovalHistory), or estimates (EstimateRevision), a repeat-repair
  // resolution has no other domain-specific audit trail of its own. See
  // decision-log-phase3.md.
  async resolve(id: string, status: RepeatRepairStatus, resolvedById?: string, note?: string) {
    const before = await this.prisma.repeatRepairFlag.findUnique({ where: { id } });
    if (!before) throw new NotFoundException(`Repeat-repair flag ${id} not found`);

    const after = await this.prisma.repeatRepairFlag.update({
      where: { id },
      data: { status, resolvedById, resolvedAt: new Date(), note },
    });

    await this.audit.log({
      action: 'REPEAT_REPAIR_FLAG_RESOLVED',
      actorId: resolvedById,
      entityType: 'RepeatRepairFlag',
      entityId: id,
      beforeState: before,
      afterState: after,
    });

    return after;
  }

  private async buildSignature(jobId: string): Promise<JobRepairSignature> {
    const [complaints, diagnosticCodes, lines] = await Promise.all([
      this.prisma.customerComplaint.findMany({ where: { jobId } }),
      this.prisma.diagnosticCode.findMany({ where: { session: { jobId } } }),
      this.prisma.garageJobLine.findMany({ where: { jobId, lineType: 'PART' }, include: { part: true } }),
    ]);

    return {
      jobId,
      complaintDescriptions: complaints.map((c) => normalizeComplaint(c.description)),
      dtcCodes: diagnosticCodes.map((d) => d.code),
      partIds: lines.filter((l) => l.partId).map((l) => l.partId!),
      partCategories: lines.map((l) => l.part?.category).filter((c): c is string => !!c),
    };
  }
}
