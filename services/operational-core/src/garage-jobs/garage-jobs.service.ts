import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataQualitySeverity, GarageJobStatus, NotificationEventType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { QualityControlService } from '../quality-control/quality-control.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddJobLineDto } from './dto/add-job-line.dto';
import { CreateGarageJobDto } from './dto/create-garage-job.dto';
import { TransitionJobDto } from './dto/transition-job.dto';
import { assertValidTransition } from './job-workflow';

const OPEN_JOB_STATUSES: GarageJobStatus[] = Object.values(GarageJobStatus).filter(
  (s) => s !== GarageJobStatus.COMPLETED && s !== GarageJobStatus.CANCELLED,
);

// Statuses that mean "the job is about to hand the vehicle back" — this is
// where the missing-QC/road-test/estimate-approval data-quality checks apply.
// Flagged, not blocked — consistent with Phase 2's MANUAL_REVIEW pattern.
const COMPLETION_STATUSES: GarageJobStatus[] = [GarageJobStatus.READY_FOR_COLLECTION, GarageJobStatus.COMPLETED];

// Immutable audit history: every status change is a new JobStatusHistory +
// JobTimeline row, never an edit to an existing one. See
// docs/architecture/job-workflow.md.
@Injectable()
export class GarageJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
    private readonly qualityControl: QualityControlService,
  ) {}

  async create(dto: CreateGarageJobDto) {
    if (dto.receptionId) {
      const reception = await this.prisma.vehicleReception.findUnique({ where: { id: dto.receptionId } });
      if (!reception) throw new NotFoundException(`Reception ${dto.receptionId} not found`);
      if (reception.vehicleId !== dto.vehicleId) {
        await this.dataQuality.record({
          checkName: 'vehicle_mismatch',
          severity: DataQualitySeverity.MANUAL_REVIEW,
          entityType: 'GarageJob',
          message: `Job requested for vehicle ${dto.vehicleId} but reception ${dto.receptionId} is for vehicle ${reception.vehicleId}`,
          context: { vehicleId: dto.vehicleId, receptionId: dto.receptionId, receptionVehicleId: reception.vehicleId },
        });
      }
    }

    const existingOpenJob = await this.prisma.garageJob.findFirst({
      where: { vehicleId: dto.vehicleId, status: { in: OPEN_JOB_STATUSES } },
    });
    if (existingOpenJob) {
      await this.dataQuality.record({
        checkName: 'duplicate_job_card',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'GarageJob',
        entityId: existingOpenJob.id,
        message: `Vehicle ${dto.vehicleId} already has an open job card ${existingOpenJob.jobNumber} (status ${existingOpenJob.status})`,
        context: { vehicleId: dto.vehicleId, existingJobId: existingOpenJob.id },
      });
    }

    const jobNumber = `JOB-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.garageJob.create({
        data: {
          jobNumber,
          vehicleId: dto.vehicleId,
          customerId: dto.customerId,
          receptionId: dto.receptionId,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          supervisorId: dto.supervisorId,
          isWarranty: dto.isWarranty ?? false,
          mileageAtCheckIn: dto.mileageAtCheckIn,
        },
      });

      await tx.jobStatusHistory.create({
        data: { jobId: job.id, previousStatus: null, newStatus: GarageJobStatus.DRAFT, reason: 'Job created' },
      });
      await tx.jobTimeline.create({
        data: { jobId: job.id, eventType: 'JOB_CREATED', description: `Job ${jobNumber} created` },
      });

      return job;
    });
  }

  async findById(id: string) {
    const job = await this.prisma.garageJob.findUnique({
      where: { id },
      include: {
        lines: true,
        statusHistory: { orderBy: { changedAt: 'desc' } },
        assignments: { include: { technician: true } },
        vehicle: true,
        customer: true,
      },
    });
    if (!job) throw new NotFoundException(`Garage job ${id} not found`);
    return job;
  }

  list(filter: { vehicleId?: string; branchId?: string; status?: GarageJobStatus }) {
    return this.prisma.garageJob.findMany({
      where: filter,
      orderBy: { openedAt: 'desc' },
    });
  }

  async transition(jobId: string, dto: TransitionJobDto) {
    const job = await this.prisma.garageJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Garage job ${jobId} not found`);

    assertValidTransition(job.status, dto.newStatus);

    if (COMPLETION_STATUSES.includes(dto.newStatus)) {
      await this.checkCompletionReadiness(jobId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.garageJob.update({
        where: { id: jobId },
        data: {
          status: dto.newStatus,
          closedAt: dto.newStatus === GarageJobStatus.COMPLETED ? new Date() : job.closedAt,
        },
      });

      await tx.jobStatusHistory.create({
        data: {
          jobId,
          previousStatus: job.status,
          newStatus: dto.newStatus,
          changedById: dto.changedById,
          reason: dto.reason,
          correlationId: dto.correlationId,
        },
      });
      await tx.jobTimeline.create({
        data: {
          jobId,
          eventType: 'STATUS_CHANGED',
          description: `${job.status} -> ${dto.newStatus}`,
          actorId: dto.changedById,
          metadata: { previousStatus: job.status, newStatus: dto.newStatus, reason: dto.reason },
        },
      });

      if (dto.newStatus === GarageJobStatus.READY_FOR_COLLECTION) {
        await tx.notificationEvent.create({
          data: {
            eventType: NotificationEventType.VEHICLE_READY,
            jobId,
            vehicleId: job.vehicleId,
            message: `Vehicle for job ${job.jobNumber} is ready for collection`,
          },
        });
      }
      if (dto.newStatus === GarageJobStatus.WAITING_CUSTOMER_APPROVAL) {
        await tx.notificationEvent.create({
          data: {
            eventType: NotificationEventType.APPROVAL_REQUIRED,
            jobId,
            vehicleId: job.vehicleId,
            message: `Job ${job.jobNumber} is waiting on customer approval`,
          },
        });
      }

      return updated;
    });
  }

  async addLine(jobId: string, dto: AddJobLineDto) {
    await this.getJobOrThrow(jobId);
    if (dto.quantity < 0 || dto.unitPrice < 0) {
      throw new BadRequestException('Job line quantity and unit price must not be negative');
    }
    const lineTotal = dto.quantity * dto.unitPrice;
    return this.prisma.garageJobLine.create({ data: { jobId, ...dto, lineTotal } });
  }

  listLines(jobId: string) {
    return this.prisma.garageJobLine.findMany({ where: { jobId } });
  }

  async assignTechnician(jobId: string, technicianId: string, role: 'TECHNICIAN' | 'SUPERVISOR', assignedById?: string) {
    const job = await this.getJobOrThrow(jobId);
    const technician = await this.prisma.technician.findUnique({ where: { id: technicianId } });
    if (!technician) throw new NotFoundException(`Technician ${technicianId} not found`);

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.jobAssignment.create({ data: { jobId, technicianId, role, assignedById } });
      await tx.jobTimeline.create({
        data: {
          jobId,
          eventType: 'TECHNICIAN_ASSIGNED',
          description: `${technician.name} assigned as ${role}`,
          actorId: assignedById,
        },
      });
      await tx.notificationEvent.create({
        data: {
          eventType: NotificationEventType.TECHNICIAN_ASSIGNED,
          jobId,
          vehicleId: job.vehicleId,
          recipientId: technicianId,
          message: `${technician.name} assigned to job ${job.jobNumber}`,
        },
      });
      return assignment;
    });
  }

  private async getJobOrThrow(jobId: string) {
    const job = await this.prisma.garageJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Garage job ${jobId} not found`);
    return job;
  }

  // Data quality §20: "missing QC", "missing road test", "missing estimate
  // approval" — flagged as MANUAL_REVIEW, not blocked, so a supervisor can
  // still push a job through in a genuine exception case but it's visible.
  private async checkCompletionReadiness(jobId: string) {
    const [{ hasQualityInspection, hasRoadTest }, estimates] = await Promise.all([
      this.qualityControl.hasPassed(jobId),
      this.prisma.estimate.findMany({ where: { jobId } }),
    ]);

    if (!hasQualityInspection) {
      await this.dataQuality.record({
        checkName: 'missing_quality_control',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'GarageJob',
        entityId: jobId,
        message: `Job ${jobId} is moving toward completion without a passing quality inspection`,
      });
    }
    if (!hasRoadTest) {
      await this.dataQuality.record({
        checkName: 'missing_road_test',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'GarageJob',
        entityId: jobId,
        message: `Job ${jobId} is moving toward completion without a passing road test`,
      });
    }
    // A job with zero estimates at all is at least as much "missing estimate
    // approval" as one whose only estimate was rejected — both cases flag.
    const hasApprovedEstimate = estimates.some(
      (e) => e.status === 'APPROVED' || e.status === 'PARTIALLY_APPROVED',
    );
    if (!hasApprovedEstimate) {
      await this.dataQuality.record({
        checkName: 'missing_estimate_approval',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'GarageJob',
        entityId: jobId,
        message: `Job ${jobId} is moving toward completion without an approved estimate`,
      });
    }
  }
}
