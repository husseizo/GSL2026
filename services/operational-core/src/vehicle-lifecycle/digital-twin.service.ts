import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeMaintenanceRiskScore,
  computeOverallConfidence,
  computePredictedMaintenance,
  computeServiceCompliance,
  computeSystemRisks,
  computeVehicleHealthScore,
  computeWarrantyRisk,
  predictRecurrences,
} from '../twin-intelligence/twin-intelligence-math';

// The headline Phase 3 feature: a single, comprehensive read model over
// every domain this vehicle has ever touched — not a new data store. Every
// field below is aggregated from data that already exists in Vehicle,
// GarageJob and its children, SalesDocumentLine, and Phase 1/2 tables; see
// docs/architecture/vehicle-history.md for why this is a computed view
// rather than a duplicated ledger.
//
// `predictedMaintenance`/`aiConfidenceScore` were Phase 3 placeholders
// (always null) — Phase 4 replaces them with real, deterministic,
// evidence-cited scoring (twin-intelligence-math.ts), never a trained model
// fit to this system's still-small per-vehicle history. See
// docs/architecture/digital-twin-intelligence.md.
@Injectable()
export class VehicleDigitalTwinService {
  constructor(private readonly prisma: PrismaService) {}

  async getDigitalTwin(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        attributeHistory: { orderBy: { changedAt: 'desc' } },
        customerLinks: { include: { customer: true } },
      },
    });
    if (!vehicle) throw new NotFoundException(`Vehicle ${vehicleId} not found`);

    const [
      jobs,
      diagnosticCodes,
      complaints,
      inspectionResults,
      partLines,
      lubricantLines,
      salesLines,
      assignments,
      repeatRepairFlags,
    ] = await Promise.all([
      this.prisma.garageJob.findMany({ where: { vehicleId }, orderBy: { openedAt: 'desc' } }),
      this.prisma.diagnosticCode.findMany({ where: { session: { job: { vehicleId } } }, include: { session: true } }),
      this.prisma.customerComplaint.findMany({ where: { vehicleId }, orderBy: { reportedAt: 'desc' } }),
      this.prisma.inspectionResult.findMany({ where: { job: { vehicleId } }, include: { item: true } }),
      this.prisma.garageJobLine.findMany({ where: { job: { vehicleId }, lineType: 'PART' }, include: { part: true } }),
      this.prisma.garageJobLine.findMany({ where: { job: { vehicleId }, lineType: 'LUBRICANT' }, include: { lubricantProduct: true } }),
      this.prisma.salesDocumentLine.findMany({ where: { vehicleId }, include: { salesDocument: true } }),
      this.prisma.jobAssignment.findMany({ where: { job: { vehicleId } }, include: { technician: true } }),
      this.prisma.repeatRepairFlag.findMany({ where: { vehicleId } }),
    ]);

    const technicianById = new Map(assignments.map((a) => [a.technicianId, a.technician]));
    const totalInvoiced = salesLines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
    const warrantyJobs = jobs.filter((j) => j.isWarranty);

    return {
      vehicleId,
      identity: {
        vin: vehicle.vin,
        registrationNumber: vehicle.registrationNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        variant: vehicle.variant,
        modelYear: vehicle.modelYear,
        engineCode: vehicle.engineCode,
        decodeConfidence: vehicle.decodeConfidence,
      },
      attributeChangeHistory: vehicle.attributeHistory,
      ownershipHistory: vehicle.customerLinks.map((link) => ({
        customerId: link.customerId,
        customerName: link.customer.displayName,
        relationship: link.relationship,
        isActive: link.isActive,
        since: link.createdAt,
      })),
      repairHistory: jobs.map((j) => ({
        jobId: j.id,
        jobNumber: j.jobNumber,
        status: j.status,
        isWarranty: j.isWarranty,
        openedAt: j.openedAt,
        closedAt: j.closedAt,
      })),
      dtcHistory: diagnosticCodes.map((c) => ({
        code: c.code,
        source: c.source,
        description: c.description,
        recordedAt: c.recordedAt,
        sessionId: c.sessionId,
      })),
      partsReplaced: partLines.map((l) => ({
        jobId: l.jobId,
        partId: l.partId,
        partName: l.part?.productName ?? l.description,
        quantity: Number(l.quantity),
        installedAt: l.createdAt,
      })),
      lubricantsUsed: lubricantLines.map((l) => ({
        jobId: l.jobId,
        lubricantProductId: l.lubricantProductId,
        productName: l.lubricantProduct?.productName ?? l.description,
        quantity: Number(l.quantity),
        usedAt: l.createdAt,
      })),
      techniciansInvolved: [...technicianById.values()].map((t) => ({ id: t.id, name: t.name, employeeCode: t.employeeCode })),
      inspectionHistory: inspectionResults.map((r) => ({
        jobId: r.jobId,
        item: r.item.label,
        finding: r.finding,
        severity: r.severity,
        inspectedAt: r.inspectedAt,
      })),
      complaintHistory: complaints,
      costOfOwnership: {
        totalInvoiced,
        currency: salesLines[0]?.salesDocument.currency ?? 'TZS',
        invoiceCount: new Set(salesLines.map((l) => l.salesDocumentId)).size,
      },
      warrantyHistory: warrantyJobs.map((j) => ({ jobId: j.id, jobNumber: j.jobNumber, status: j.status, openedAt: j.openedAt })),
      repeatRepairFlags,
      ...this.computeIntelligence({ jobs, diagnosticCodes, partLines, lubricantLines, inspectionResults, complaints, warrantyJobs, repeatRepairFlags }),
      generatedAt: new Date(),
    };
  }

  // All Digital Twin Intelligence fields the spec's §7 asks for
  // (health/risk/compliance scores, predicted maintenance/parts/lubricants,
  // confidence) computed from evidence this method already has in hand — no
  // extra queries, no duplicated aggregation logic. Pure math lives in
  // twin-intelligence-math.ts; this method only shapes the evidence into the
  // small event lists that math expects.
  private computeIntelligence(evidence: {
    jobs: { id: string; isWarranty: boolean; openedAt: Date }[];
    diagnosticCodes: { description: string | null; code: string; recordedAt: Date }[];
    partLines: { partId: string | null; part: { productName: string } | null; description: string; createdAt: Date }[];
    lubricantLines: { lubricantProductId: string | null; lubricantProduct: { productName: string } | null; description: string; createdAt: Date }[];
    inspectionResults: { item: { label: string }; finding: string; inspectedAt: Date }[];
    complaints: { description: string; reportedAt: Date }[];
    warrantyJobs: { id: string }[];
    repeatRepairFlags: { status: string }[];
  }) {
    const riskEvents = [
      ...evidence.diagnosticCodes.map((c) => ({ text: c.description ?? c.code, occurredAt: c.recordedAt })),
      ...evidence.partLines.map((l) => ({ text: l.part?.productName ?? l.description, occurredAt: l.createdAt })),
      ...evidence.inspectionResults
        .filter((r) => r.finding === 'FAIL' || r.finding === 'WARNING')
        .map((r) => ({ text: r.item.label, occurredAt: r.inspectedAt })),
      ...evidence.complaints.map((c) => ({ text: c.description, occurredAt: c.reportedAt })),
    ];

    const systemRisks = computeSystemRisks(riskEvents);
    const warrantyCandidateCount = evidence.repeatRepairFlags.filter((f) => f.status === 'WARRANTY_CANDIDATE').length;

    const serviceCompliance = computeServiceCompliance(evidence.jobs.map((j) => ({ occurredAt: j.openedAt })));

    const partRecurrences = predictRecurrences(
      evidence.partLines
        .filter((l) => l.partId)
        .map((l) => ({ key: l.partId!, label: l.part?.productName ?? l.description, occurredAt: l.createdAt })),
    );
    const lubricantRecurrences = predictRecurrences(
      evidence.lubricantLines
        .filter((l) => l.lubricantProductId)
        .map((l) => ({ key: l.lubricantProductId!, label: l.lubricantProduct?.productName ?? l.description, occurredAt: l.createdAt })),
    );

    return {
      healthScore: computeVehicleHealthScore(systemRisks),
      maintenanceRiskScore: computeMaintenanceRiskScore(systemRisks, evidence.repeatRepairFlags.length),
      systemRisks,
      serviceComplianceScore: serviceCompliance.score,
      warrantyRiskScore: computeWarrantyRisk(evidence.warrantyJobs.length, evidence.jobs.length, warrantyCandidateCount),
      predictedMaintenance: computePredictedMaintenance(systemRisks),
      predictedFutureParts: partRecurrences,
      predictedLubricantNeeds: lubricantRecurrences,
      aiConfidenceScore: computeOverallConfidence(evidence.jobs.length),
    };
  }
}
