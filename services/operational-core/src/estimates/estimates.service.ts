import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalDecision, EstimateStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstimateDto, EstimateLineDto } from './dto/create-estimate.dto';
import { RespondApprovalDto } from './dto/respond-approval.dto';

// Estimate is a garage-specific pre-sale workflow (revisions, per-line
// approval) that SalesDocument doesn't model — see
// docs/architecture/phase-2-commercial-foundation.md and
// docs/architecture/decision-log-phase3.md for why this isn't a duplicate of
// the Sales domain. EstimatesService deliberately does NOT transition the
// GarageJob's status itself — that stays an explicit, separate call so the
// job's audit history always shows a human/API decision, not an implicit
// side effect of an estimate response.
@Injectable()
export class EstimatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEstimateDto) {
    const totals = computeTotals(dto.lines);
    const estimateNumber = `EST-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;

    return this.prisma.estimate.create({
      data: {
        jobId: dto.jobId,
        estimateNumber,
        createdById: dto.createdById,
        ...totals,
        lines: { create: dto.lines.map((line) => ({ ...line, lineTotal: lineTotal(line) })) },
      },
      include: { lines: true },
    });
  }

  async findById(id: string) {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id },
      include: { lines: true, revisions: true, approvalRequests: { include: { history: true } } },
    });
    if (!estimate) throw new NotFoundException(`Estimate ${id} not found`);
    return estimate;
  }

  listForJob(jobId: string) {
    return this.prisma.estimate.findMany({ where: { jobId }, include: { lines: true }, orderBy: { createdAt: 'desc' } });
  }

  async revise(estimateId: string, lines: EstimateLineDto[], reason: string | undefined, createdById: string | undefined) {
    const estimate = await this.prisma.estimate.findUnique({ where: { id: estimateId }, include: { lines: true } });
    if (!estimate) throw new NotFoundException(`Estimate ${estimateId} not found`);

    const totals = computeTotals(lines);

    return this.prisma.$transaction(async (tx) => {
      await tx.estimateRevision.create({
        data: {
          estimateId,
          version: estimate.version,
          snapshot: estimate.lines as unknown as Prisma.InputJsonValue,
          reason,
          createdById,
        },
      });

      await tx.estimateLine.deleteMany({ where: { estimateId } });

      return tx.estimate.update({
        where: { id: estimateId },
        data: {
          version: estimate.version + 1,
          status: EstimateStatus.REVISED,
          ...totals,
          lines: { create: lines.map((line) => ({ ...line, lineTotal: lineTotal(line) })) },
        },
        include: { lines: true },
      });
    });
  }

  async sendForApproval(estimateId: string) {
    await this.getEstimateOrThrow(estimateId);
    return this.prisma.$transaction(async (tx) => {
      await tx.estimate.update({ where: { id: estimateId }, data: { status: EstimateStatus.SENT, sentAt: new Date() } });
      return tx.approvalRequest.create({ data: { estimateId } });
    });
  }

  async respond(approvalRequestId: string, dto: RespondApprovalDto) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: approvalRequestId },
      include: { estimate: { include: { lines: true } } },
    });
    if (!request) throw new NotFoundException(`Approval request ${approvalRequestId} not found`);
    if (request.decision !== ApprovalDecision.PENDING) {
      throw new BadRequestException(`Approval request ${approvalRequestId} already has a decision recorded`);
    }

    const lineDecisions = dto.lineDecisions ?? request.estimate.lines.map((l) => ({ estimateLineId: l.id, decision: dto.overallDecision ?? ApprovalDecision.APPROVED }));
    const overallDecision = deriveOverallDecision(lineDecisions.map((d) => d.decision));

    return this.prisma.$transaction(async (tx) => {
      for (const lineDecision of lineDecisions) {
        await tx.estimateLine.update({
          where: { id: lineDecision.estimateLineId },
          data: { approvalDecision: lineDecision.decision },
        });
      }

      const updatedRequest = await tx.approvalRequest.update({
        where: { id: approvalRequestId },
        data: { decision: overallDecision, respondedAt: new Date(), respondedByName: dto.respondedByName, note: dto.note },
      });

      await tx.approvalHistory.create({
        data: { approvalRequestId, decision: overallDecision, note: dto.note, actorId: dto.actorId },
      });

      // Computed from the real per-line mix, not from `overallDecision` —
      // that value is already collapsed to APPROVED/REJECTED (ApprovalDecision
      // has no PARTIALLY_APPROVED value) and so cannot distinguish "all
      // approved" from "some approved, some rejected" on its own. This is
      // exactly the bug an integration test caught: a mixed response was
      // silently recorded as a fully APPROVED estimate.
      const allApproved = lineDecisions.every((d) => d.decision === ApprovalDecision.APPROVED);
      const allRejected = lineDecisions.every((d) => d.decision === ApprovalDecision.REJECTED);
      const estimateStatus = allApproved
        ? EstimateStatus.APPROVED
        : allRejected
          ? EstimateStatus.REJECTED
          : EstimateStatus.PARTIALLY_APPROVED;

      await tx.estimate.update({ where: { id: request.estimateId }, data: { status: estimateStatus } });

      return updatedRequest;
    });
  }

  // Operationalizes the "reuse SalesDocument for the executed sale" decision
  // (see decision-log-phase3.md): only APPROVED lines are billed — a
  // customer-rejected line (e.g. a declined oil top-up) never appears on the
  // invoice. This is what makes Vehicle Digital Twin's cost-of-ownership
  // figure real instead of permanently zero.
  async convertToInvoice(estimateId: string, params: { branchId?: string; warehouseId?: string; documentNumber?: string }) {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { lines: true, job: true },
    });
    if (!estimate) throw new NotFoundException(`Estimate ${estimateId} not found`);

    const approvedLines = estimate.lines.filter((l) => l.approvalDecision === ApprovalDecision.APPROVED);
    if (approvedLines.length === 0) {
      throw new BadRequestException(`Estimate ${estimateId} has no approved lines to invoice`);
    }

    const documentNumber = params.documentNumber ?? `INV-${estimate.estimateNumber}`;
    const subtotal = approvedLines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0);
    const discountTotal = approvedLines.reduce((sum, l) => sum + Number(l.discountAmount), 0);
    const taxTotal = approvedLines.reduce((sum, l) => sum + Number(l.taxAmount), 0);
    const grandTotal = subtotal - discountTotal + taxTotal;

    return this.prisma.salesDocument.create({
      data: {
        documentNumber,
        documentType: 'INVOICE',
        status: 'FULFILLED',
        customerId: estimate.job.customerId,
        branchId: params.branchId ?? estimate.job.branchId,
        warehouseId: params.warehouseId ?? estimate.job.warehouseId,
        garageJobId: estimate.jobId,
        documentDate: new Date(),
        subtotal,
        discountTotal,
        taxTotal,
        grandTotal,
        paidAmount: grandTotal,
        outstandingAmount: 0,
        lines: {
          create: approvedLines.map((line, index) => ({
            lineNumber: index + 1,
            itemType: line.lineType === 'PART' ? 'PART' : line.lineType === 'LUBRICANT' ? 'LUBRICANT' : 'LABOUR',
            partId: line.partId,
            lubricantProductId: line.lubricantProductId,
            originalDescription: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
            vehicleId: estimate.job.vehicleId,
            warehouseId: params.warehouseId ?? estimate.job.warehouseId ?? undefined,
            garageJobExternalId: estimate.jobId,
          })),
        },
      },
      include: { lines: true },
    });
  }

  private async getEstimateOrThrow(id: string) {
    const estimate = await this.prisma.estimate.findUnique({ where: { id } });
    if (!estimate) throw new NotFoundException(`Estimate ${id} not found`);
    return estimate;
  }
}

function lineTotal(line: EstimateLineDto): number {
  return line.quantity * line.unitPrice - (line.discountAmount ?? 0) + (line.taxAmount ?? 0);
}

function computeTotals(lines: EstimateLineDto[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const discountTotal = lines.reduce((sum, l) => sum + (l.discountAmount ?? 0), 0);
  const taxTotal = lines.reduce((sum, l) => sum + (l.taxAmount ?? 0), 0);
  return { subtotal, discountTotal, taxTotal, grandTotal: subtotal - discountTotal + taxTotal };
}

// ApprovalDecision only has PENDING/APPROVED/REJECTED — there's no
// "partially approved" value at the request level, only at the Estimate
// level (EstimateStatus.PARTIALLY_APPROVED, set separately in respond()).
// A mixed set of line decisions is recorded as an APPROVED request — the
// customer did respond and approve part of it, it wasn't a blanket
// rejection — with the real per-line detail preserved on EstimateLine.
function deriveOverallDecision(decisions: ApprovalDecision[]): ApprovalDecision {
  const allRejected = decisions.every((d) => d === ApprovalDecision.REJECTED);
  return allRejected ? ApprovalDecision.REJECTED : ApprovalDecision.APPROVED;
}
