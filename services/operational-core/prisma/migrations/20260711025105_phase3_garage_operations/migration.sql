-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('RECEPTION', 'JOB', 'QUALITY');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PASS', 'FAIL', 'NA');

-- CreateEnum
CREATE TYPE "ReceptionFuelLevel" AS ENUM ('EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTER', 'FULL');

-- CreateEnum
CREATE TYPE "GarageJobStatus" AS ENUM ('DRAFT', 'CHECKED_IN', 'WAITING_INSPECTION', 'INSPECTION_IN_PROGRESS', 'WAITING_ESTIMATE', 'WAITING_CUSTOMER_APPROVAL', 'PARTIALLY_APPROVED', 'APPROVED', 'WAITING_PARTS', 'READY_TO_START', 'IN_PROGRESS', 'PAUSED', 'WAITING_ADDITIONAL_APPROVAL', 'QUALITY_CONTROL', 'ROAD_TEST', 'READY_FOR_COLLECTION', 'COMPLETED', 'CANCELLED', 'WARRANTY_RETURN');

-- CreateEnum
CREATE TYPE "GarageJobLineType" AS ENUM ('LABOUR', 'PART', 'LUBRICANT', 'MISCELLANEOUS', 'OUTSOURCED');

-- CreateEnum
CREATE TYPE "InspectionFinding" AS ENUM ('PASS', 'WARNING', 'FAIL', 'NOT_INSPECTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InspectionSeverityLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DiagnosticCodeSource" AS ENUM ('MANUFACTURER', 'GENERIC_OBD', 'MANUAL');

-- CreateEnum
CREATE TYPE "CauseConfidence" AS ENUM ('SUSPECTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'REVISED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TechnicianSpecialization" AS ENUM ('BMW', 'MERCEDES', 'LAND_ROVER', 'VAG', 'ELECTRICAL', 'HYBRID', 'EV', 'AUTOMATIC_TRANSMISSION', 'DIAGNOSTICS', 'GENERAL');

-- CreateEnum
CREATE TYPE "QualityResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL_PASS');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('APPROVAL_REQUIRED', 'PARTS_ARRIVED', 'VEHICLE_COMPLETED', 'TECHNICIAN_ASSIGNED', 'QC_FAILED', 'ROAD_TEST_REQUIRED', 'VEHICLE_READY', 'JOB_OVERDUE');

-- CreateEnum
CREATE TYPE "RepeatRepairStatus" AS ENUM ('POSSIBLE', 'CONFIRMED', 'WARRANTY_CANDIDATE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "WorkshopRequestType" AS ENUM ('EMERGENCY', 'INTER_WAREHOUSE', 'BRANCH', 'SUPPLIER', 'URGENT_PROCUREMENT');

-- CreateEnum
CREATE TYPE "WorkshopRequestStatus" AS ENUM ('OPEN', 'LINKED_TO_TRANSFER', 'LINKED_TO_PURCHASE', 'FULFILLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SalesDocument" ADD COLUMN     "garageJobId" TEXT;

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistResponse" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistResponseItem" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,

    CONSTRAINT "ChecklistResponseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleReception" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT,
    "branchId" TEXT NOT NULL,
    "receivedById" TEXT,
    "driverName" TEXT,
    "mileage" INTEGER NOT NULL,
    "fuelLevel" "ReceptionFuelLevel",
    "batteryVoltage" DECIMAL(5,2),
    "arrivalAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedCompletionAt" TIMESTAMP(3),
    "receptionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleReception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCondition" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "severity" "InspectionSeverityLevel" NOT NULL DEFAULT 'NONE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerComplaint" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "jobId" TEXT,
    "description" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehiclePhoto" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT,
    "jobId" TEXT,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAccessory" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "VehicleAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarageJob" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT,
    "receptionId" TEXT,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "supervisorId" TEXT,
    "status" "GarageJobStatus" NOT NULL DEFAULT 'DRAFT',
    "isWarranty" BOOLEAN NOT NULL DEFAULT false,
    "mileageAtCheckIn" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarageJobLine" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "lineType" "GarageJobLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "labourOperationId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(14,4),
    "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reservationId" TEXT,
    "estimateLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarageJobLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStatusHistory" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "previousStatus" "GarageJobStatus",
    "newStatus" "GarageJobStatus" NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "correlationId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TECHNICIAN',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "assignedById" TEXT,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTimeline" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDocument" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "referenceId" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAttachment" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InspectionSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "finding" "InspectionFinding" NOT NULL,
    "severity" "InspectionSeverityLevel" NOT NULL DEFAULT 'NONE',
    "recommendedAction" TEXT,
    "estimatedLabourHours" DECIMAL(6,2),
    "requiredPartId" TEXT,
    "requiredLubricantId" TEXT,
    "safetyWarning" BOOLEAN NOT NULL DEFAULT false,
    "inspectedById" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "InspectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionPhoto" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticSession" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "proceduresPerformed" JSONB,
    "notes" TEXT,

    CONSTRAINT "DiagnosticSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticCode" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" "DiagnosticCodeSource" NOT NULL,
    "description" TEXT,
    "freezeFrame" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Symptom" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL DEFAULT 'TECHNICIAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Symptom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspectedCause" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "diagnosticCodeId" TEXT,
    "description" TEXT NOT NULL,
    "confidence" "CauseConfidence" NOT NULL DEFAULT 'SUSPECTED',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,

    CONSTRAINT "SuspectedCause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticAttachment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiagnosticAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateLine" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "lineType" "GarageJobLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvalDecision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "EstimateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateRevision" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "respondedByName" TEXT,
    "note" TEXT,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "LabourCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourOperation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardHours" DECIMAL(6,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LabourOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabourRate" (
    "id" TEXT NOT NULL,
    "labourOperationId" TEXT,
    "branchId" TEXT,
    "hourlyRate" DECIMAL(12,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "LabourRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianTimeLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "labourOperationId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "actualMinutes" INTEGER,
    "isOvertime" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "TechnicianTimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Technician" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Technician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianSkill" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "specialization" "TechnicianSpecialization" NOT NULL,
    "proficiency" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TechnicianSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianCertification" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TechnicianCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianAvailability" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,

    CONSTRAINT "TechnicianAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianSchedule" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "TechnicianSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopInventoryRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "itemType" "ItemType" NOT NULL,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "requestType" "WorkshopRequestType" NOT NULL,
    "status" "WorkshopRequestStatus" NOT NULL DEFAULT 'OPEN',
    "transferRecommendationId" TEXT,
    "purchaseRecommendationId" TEXT,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "WorkshopInventoryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "result" "QualityResult" NOT NULL DEFAULT 'PASS',
    "notes" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityIssue" (
    "id" TEXT NOT NULL,
    "qualityInspectionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "QualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadTest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "driverId" TEXT,
    "distanceKm" DECIMAL(6,2),
    "result" "QualityResult" NOT NULL DEFAULT 'PASS',
    "notes" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityApproval" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "approvedById" TEXT,
    "customerReadyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "QualityApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepeatRepairFlag" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "relatedJobId" TEXT,
    "matchReason" TEXT NOT NULL,
    "status" "RepeatRepairStatus" NOT NULL DEFAULT 'POSSIBLE',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "RepeatRepairFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "jobId" TEXT,
    "vehicleId" TEXT,
    "recipientRole" TEXT,
    "recipientId" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistResponse_entityType_entityId_idx" ON "ChecklistResponse"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistResponseItem_responseId_templateItemId_key" ON "ChecklistResponseItem"("responseId", "templateItemId");

-- CreateIndex
CREATE INDEX "VehicleReception_vehicleId_idx" ON "VehicleReception"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleReception_branchId_arrivalAt_idx" ON "VehicleReception"("branchId", "arrivalAt");

-- CreateIndex
CREATE INDEX "VehicleCondition_receptionId_idx" ON "VehicleCondition"("receptionId");

-- CreateIndex
CREATE INDEX "CustomerComplaint_vehicleId_idx" ON "CustomerComplaint"("vehicleId");

-- CreateIndex
CREATE INDEX "CustomerComplaint_jobId_idx" ON "CustomerComplaint"("jobId");

-- CreateIndex
CREATE INDEX "VehiclePhoto_receptionId_idx" ON "VehiclePhoto"("receptionId");

-- CreateIndex
CREATE INDEX "VehiclePhoto_jobId_idx" ON "VehiclePhoto"("jobId");

-- CreateIndex
CREATE INDEX "VehicleAccessory_receptionId_idx" ON "VehicleAccessory"("receptionId");

-- CreateIndex
CREATE UNIQUE INDEX "GarageJob_jobNumber_key" ON "GarageJob"("jobNumber");

-- CreateIndex
CREATE INDEX "GarageJob_vehicleId_idx" ON "GarageJob"("vehicleId");

-- CreateIndex
CREATE INDEX "GarageJob_branchId_status_idx" ON "GarageJob"("branchId", "status");

-- CreateIndex
CREATE INDEX "GarageJob_status_idx" ON "GarageJob"("status");

-- CreateIndex
CREATE INDEX "GarageJobLine_jobId_idx" ON "GarageJobLine"("jobId");

-- CreateIndex
CREATE INDEX "JobStatusHistory_jobId_changedAt_idx" ON "JobStatusHistory"("jobId", "changedAt");

-- CreateIndex
CREATE INDEX "JobAssignment_jobId_idx" ON "JobAssignment"("jobId");

-- CreateIndex
CREATE INDEX "JobAssignment_technicianId_idx" ON "JobAssignment"("technicianId");

-- CreateIndex
CREATE INDEX "JobTimeline_jobId_occurredAt_idx" ON "JobTimeline"("jobId", "occurredAt");

-- CreateIndex
CREATE INDEX "JobDocument_jobId_idx" ON "JobDocument"("jobId");

-- CreateIndex
CREATE INDEX "JobAttachment_jobId_idx" ON "JobAttachment"("jobId");

-- CreateIndex
CREATE INDEX "InspectionSection_templateId_idx" ON "InspectionSection"("templateId");

-- CreateIndex
CREATE INDEX "InspectionItem_sectionId_idx" ON "InspectionItem"("sectionId");

-- CreateIndex
CREATE INDEX "InspectionResult_jobId_idx" ON "InspectionResult"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionResult_jobId_itemId_key" ON "InspectionResult"("jobId", "itemId");

-- CreateIndex
CREATE INDEX "InspectionPhoto_resultId_idx" ON "InspectionPhoto"("resultId");

-- CreateIndex
CREATE INDEX "DiagnosticSession_jobId_idx" ON "DiagnosticSession"("jobId");

-- CreateIndex
CREATE INDEX "DiagnosticCode_sessionId_idx" ON "DiagnosticCode"("sessionId");

-- CreateIndex
CREATE INDEX "DiagnosticCode_code_idx" ON "DiagnosticCode"("code");

-- CreateIndex
CREATE INDEX "Symptom_sessionId_idx" ON "Symptom"("sessionId");

-- CreateIndex
CREATE INDEX "SuspectedCause_sessionId_idx" ON "SuspectedCause"("sessionId");

-- CreateIndex
CREATE INDEX "DiagnosticAttachment_sessionId_idx" ON "DiagnosticAttachment"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_estimateNumber_key" ON "Estimate"("estimateNumber");

-- CreateIndex
CREATE INDEX "Estimate_jobId_idx" ON "Estimate"("jobId");

-- CreateIndex
CREATE INDEX "EstimateLine_estimateId_idx" ON "EstimateLine"("estimateId");

-- CreateIndex
CREATE INDEX "EstimateRevision_estimateId_idx" ON "EstimateRevision"("estimateId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_estimateId_idx" ON "ApprovalRequest"("estimateId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_approvalRequestId_idx" ON "ApprovalHistory"("approvalRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "LabourCategory_name_key" ON "LabourCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LabourOperation_code_key" ON "LabourOperation"("code");

-- CreateIndex
CREATE INDEX "LabourRate_labourOperationId_branchId_idx" ON "LabourRate"("labourOperationId", "branchId");

-- CreateIndex
CREATE INDEX "TechnicianTimeLog_jobId_idx" ON "TechnicianTimeLog"("jobId");

-- CreateIndex
CREATE INDEX "TechnicianTimeLog_technicianId_idx" ON "TechnicianTimeLog"("technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "Technician_employeeCode_key" ON "Technician"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianSkill_technicianId_specialization_key" ON "TechnicianSkill"("technicianId", "specialization");

-- CreateIndex
CREATE INDEX "TechnicianCertification_technicianId_idx" ON "TechnicianCertification"("technicianId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianAvailability_technicianId_date_key" ON "TechnicianAvailability"("technicianId", "date");

-- CreateIndex
CREATE INDEX "TechnicianSchedule_technicianId_idx" ON "TechnicianSchedule"("technicianId");

-- CreateIndex
CREATE INDEX "WorkshopInventoryRequest_jobId_idx" ON "WorkshopInventoryRequest"("jobId");

-- CreateIndex
CREATE INDEX "WorkshopInventoryRequest_status_idx" ON "WorkshopInventoryRequest"("status");

-- CreateIndex
CREATE INDEX "QualityInspection_jobId_idx" ON "QualityInspection"("jobId");

-- CreateIndex
CREATE INDEX "QualityIssue_qualityInspectionId_idx" ON "QualityIssue"("qualityInspectionId");

-- CreateIndex
CREATE INDEX "RoadTest_jobId_idx" ON "RoadTest"("jobId");

-- CreateIndex
CREATE INDEX "QualityApproval_jobId_idx" ON "QualityApproval"("jobId");

-- CreateIndex
CREATE INDEX "RepeatRepairFlag_vehicleId_idx" ON "RepeatRepairFlag"("vehicleId");

-- CreateIndex
CREATE INDEX "RepeatRepairFlag_jobId_idx" ON "RepeatRepairFlag"("jobId");

-- CreateIndex
CREATE INDEX "NotificationEvent_jobId_idx" ON "NotificationEvent"("jobId");

-- CreateIndex
CREATE INDEX "NotificationEvent_isRead_idx" ON "NotificationEvent"("isRead");

-- AddForeignKey
ALTER TABLE "SalesDocument" ADD CONSTRAINT "SalesDocument_garageJobId_fkey" FOREIGN KEY ("garageJobId") REFERENCES "GarageJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponse" ADD CONSTRAINT "ChecklistResponse_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponseItem" ADD CONSTRAINT "ChecklistResponseItem_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ChecklistResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistResponseItem" ADD CONSTRAINT "ChecklistResponseItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReception" ADD CONSTRAINT "VehicleReception_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReception" ADD CONSTRAINT "VehicleReception_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReception" ADD CONSTRAINT "VehicleReception_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCondition" ADD CONSTRAINT "VehicleCondition_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "VehicleReception"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "VehicleReception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "CustomerComplaint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "VehicleReception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAccessory" ADD CONSTRAINT "VehicleAccessory_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "VehicleReception"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJob" ADD CONSTRAINT "GarageJob_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJob" ADD CONSTRAINT "GarageJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJob" ADD CONSTRAINT "GarageJob_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "VehicleReception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJob" ADD CONSTRAINT "GarageJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJob" ADD CONSTRAINT "GarageJob_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJobLine" ADD CONSTRAINT "GarageJobLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJobLine" ADD CONSTRAINT "GarageJobLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJobLine" ADD CONSTRAINT "GarageJobLine_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJobLine" ADD CONSTRAINT "GarageJobLine_labourOperationId_fkey" FOREIGN KEY ("labourOperationId") REFERENCES "LabourOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarageJobLine" ADD CONSTRAINT "GarageJobLine_estimateLineId_fkey" FOREIGN KEY ("estimateLineId") REFERENCES "EstimateLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusHistory" ADD CONSTRAINT "JobStatusHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTimeline" ADD CONSTRAINT "JobTimeline_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAttachment" ADD CONSTRAINT "JobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionSection" ADD CONSTRAINT "InspectionSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "InspectionSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResult" ADD CONSTRAINT "InspectionResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResult" ADD CONSTRAINT "InspectionResult_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InspectionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResult" ADD CONSTRAINT "InspectionResult_requiredPartId_fkey" FOREIGN KEY ("requiredPartId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionResult" ADD CONSTRAINT "InspectionResult_requiredLubricantId_fkey" FOREIGN KEY ("requiredLubricantId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "InspectionResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticSession" ADD CONSTRAINT "DiagnosticSession_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticCode" ADD CONSTRAINT "DiagnosticCode_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiagnosticSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Symptom" ADD CONSTRAINT "Symptom_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiagnosticSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspectedCause" ADD CONSTRAINT "SuspectedCause_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiagnosticSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspectedCause" ADD CONSTRAINT "SuspectedCause_diagnosticCodeId_fkey" FOREIGN KEY ("diagnosticCodeId") REFERENCES "DiagnosticCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAttachment" ADD CONSTRAINT "DiagnosticAttachment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DiagnosticSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateLine" ADD CONSTRAINT "EstimateLine_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateRevision" ADD CONSTRAINT "EstimateRevision_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourOperation" ADD CONSTRAINT "LabourOperation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LabourCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourRate" ADD CONSTRAINT "LabourRate_labourOperationId_fkey" FOREIGN KEY ("labourOperationId") REFERENCES "LabourOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabourRate" ADD CONSTRAINT "LabourRate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianTimeLog" ADD CONSTRAINT "TechnicianTimeLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianTimeLog" ADD CONSTRAINT "TechnicianTimeLog_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianTimeLog" ADD CONSTRAINT "TechnicianTimeLog_labourOperationId_fkey" FOREIGN KEY ("labourOperationId") REFERENCES "LabourOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianSkill" ADD CONSTRAINT "TechnicianSkill_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianCertification" ADD CONSTRAINT "TechnicianCertification_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianAvailability" ADD CONSTRAINT "TechnicianAvailability_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianSchedule" ADD CONSTRAINT "TechnicianSchedule_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopInventoryRequest" ADD CONSTRAINT "WorkshopInventoryRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopInventoryRequest" ADD CONSTRAINT "WorkshopInventoryRequest_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopInventoryRequest" ADD CONSTRAINT "WorkshopInventoryRequest_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopInventoryRequest" ADD CONSTRAINT "WorkshopInventoryRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityIssue" ADD CONSTRAINT "QualityIssue_qualityInspectionId_fkey" FOREIGN KEY ("qualityInspectionId") REFERENCES "QualityInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadTest" ADD CONSTRAINT "RoadTest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityApproval" ADD CONSTRAINT "QualityApproval_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepeatRepairFlag" ADD CONSTRAINT "RepeatRepairFlag_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepeatRepairFlag" ADD CONSTRAINT "RepeatRepairFlag_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GarageJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
