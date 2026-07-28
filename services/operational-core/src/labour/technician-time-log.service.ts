import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataQualitySeverity } from '@prisma/client';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { PrismaService } from '../prisma/prisma.service';

const MINUTE_MS = 60_000;

// Start/pause/resume/end for a technician's time on a job. Overlapping
// assignments (the same technician with two time logs open at once) are
// flagged as a data-quality issue rather than rejected outright — a
// technician briefly covering two quick tasks is plausible, but it needs a
// human's eyes, per docs/architecture/data-quality-phase-2.md's MANUAL_REVIEW severity.
@Injectable()
export class TechnicianTimeLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
  ) {}

  async start(params: { jobId: string; technicianId: string; labourOperationId?: string }) {
    const openLog = await this.prisma.technicianTimeLog.findFirst({
      where: { technicianId: params.technicianId, endedAt: null },
    });
    if (openLog) {
      await this.dataQuality.record({
        checkName: 'overlapping_technician_assignment',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'TechnicianTimeLog',
        entityId: openLog.id,
        message: `Technician ${params.technicianId} started a new time log on job ${params.jobId} while log ${openLog.id} (job ${openLog.jobId}) is still open`,
        context: { technicianId: params.technicianId, newJobId: params.jobId, openLogId: openLog.id },
      });
    }

    return this.prisma.technicianTimeLog.create({
      data: {
        jobId: params.jobId,
        technicianId: params.technicianId,
        labourOperationId: params.labourOperationId,
        startedAt: new Date(),
      },
    });
  }

  async pause(id: string) {
    await this.getOpenLog(id);
    return this.prisma.technicianTimeLog.update({ where: { id }, data: { pausedAt: new Date() } });
  }

  async resume(id: string) {
    await this.getOpenLog(id);
    return this.prisma.technicianTimeLog.update({ where: { id }, data: { resumedAt: new Date(), pausedAt: null } });
  }

  async end(id: string, isOvertime = false) {
    const log = await this.getOpenLog(id);
    const endedAt = new Date();
    const actualMinutes = Math.max(0, Math.round((endedAt.getTime() - log.startedAt.getTime()) / MINUTE_MS));
    return this.prisma.technicianTimeLog.update({
      where: { id },
      data: { endedAt, actualMinutes, isOvertime },
    });
  }

  listForJob(jobId: string) {
    return this.prisma.technicianTimeLog.findMany({ where: { jobId }, include: { technician: true, labourOperation: true } });
  }

  private async getOpenLog(id: string) {
    const log = await this.prisma.technicianTimeLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`Time log ${id} not found`);
    if (log.endedAt) throw new BadRequestException(`Time log ${id} has already ended`);
    return log;
  }
}
