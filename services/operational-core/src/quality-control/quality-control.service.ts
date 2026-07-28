import { Injectable } from '@nestjs/common';
import { NotificationEventType, QualityResult } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQualityInspectionDto } from './dto/create-quality-inspection.dto';

@Injectable()
export class QualityControlService {
  constructor(private readonly prisma: PrismaService) {}

  async createInspection(dto: CreateQualityInspectionDto) {
    const inspection = await this.prisma.qualityInspection.create({
      data: {
        jobId: dto.jobId,
        inspectorId: dto.inspectorId,
        result: dto.result,
        notes: dto.notes,
        issues: dto.issues ? { create: dto.issues } : undefined,
      },
      include: { issues: true, job: true },
    });

    if (dto.result === QualityResult.FAIL) {
      await this.prisma.notificationEvent.create({
        data: {
          eventType: NotificationEventType.QC_FAILED,
          jobId: dto.jobId,
          vehicleId: inspection.job.vehicleId,
          message: `Quality inspection failed for job ${inspection.job.jobNumber}`,
        },
      });
    } else {
      await this.prisma.notificationEvent.create({
        data: {
          eventType: NotificationEventType.ROAD_TEST_REQUIRED,
          jobId: dto.jobId,
          vehicleId: inspection.job.vehicleId,
          message: `Job ${inspection.job.jobNumber} passed QC — road test required`,
        },
      });
    }

    return inspection;
  }

  resolveIssue(issueId: string) {
    return this.prisma.qualityIssue.update({ where: { id: issueId }, data: { resolvedAt: new Date() } });
  }

  createRoadTest(data: { jobId: string; driverId?: string; distanceKm?: number; result: QualityResult; notes?: string }) {
    return this.prisma.roadTest.create({ data });
  }

  createApproval(jobId: string, approvedById?: string, note?: string) {
    return this.prisma.qualityApproval.create({ data: { jobId, approvedById, note } });
  }

  async listForJob(jobId: string) {
    const [inspections, roadTests, approvals] = await Promise.all([
      this.prisma.qualityInspection.findMany({ where: { jobId }, include: { issues: true } }),
      this.prisma.roadTest.findMany({ where: { jobId } }),
      this.prisma.qualityApproval.findMany({ where: { jobId } }),
    ]);
    return { inspections, roadTests, approvals };
  }

  async hasPassed(jobId: string): Promise<{ hasQualityInspection: boolean; hasRoadTest: boolean; isCustomerReady: boolean }> {
    const [inspection, roadTest, approval] = await Promise.all([
      this.prisma.qualityInspection.findFirst({ where: { jobId, result: { in: [QualityResult.PASS, QualityResult.CONDITIONAL_PASS] } } }),
      this.prisma.roadTest.findFirst({ where: { jobId, result: { in: [QualityResult.PASS, QualityResult.CONDITIONAL_PASS] } } }),
      this.prisma.qualityApproval.findFirst({ where: { jobId } }),
    ]);
    return { hasQualityInspection: !!inspection, hasRoadTest: !!roadTest, isCustomerReady: !!approval };
  }
}
