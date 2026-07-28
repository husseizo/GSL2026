-- CreateEnum
CREATE TYPE "MappingConfidence" AS ENUM ('VERIFIED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNMAPPED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AuthorityType" AS ENUM ('ENTITY_LEVEL', 'FIELD_LEVEL', 'TEMPORAL', 'FALLBACK', 'MANUAL', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('MERGE_APPROVED', 'KEEP_SEPARATE', 'LINK_AS_RELATED', 'REQUEST_MORE_INFORMATION', 'REJECT_PROPOSAL', 'DEFER', 'ESCALATE');

-- CreateEnum
CREATE TYPE "DataQualityClassification" AS ENUM ('EXCELLENT', 'GOOD', 'ACCEPTABLE_WITH_WARNINGS', 'POOR', 'NOT_USABLE');

-- CreateEnum
CREATE TYPE "AIUseCaseStatus" AS ENUM ('READY_FOR_PROTOTYPE', 'READY_FOR_OFFLINE_EVALUATION', 'NEEDS_MORE_DATA', 'NEEDS_LABELING', 'BLOCKED_BY_SOURCE_ACCESS', 'NOT_APPROPRIATE', 'PRODUCTION_READY', 'DEFERRED');

-- AlterEnum
ALTER TYPE "ForecastMethod" ADD VALUE 'CROSTON';

-- AlterTable
ALTER TABLE "BranchExternalReference" ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "mappingConfidence" "MappingConfidence" NOT NULL DEFAULT 'UNMAPPED',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "ForecastRun" ADD COLUMN     "mase" DOUBLE PRECISION,
ADD COLUMN     "wape" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ManualReviewItem" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "priorityScore" DOUBLE PRECISION,
ADD COLUMN     "reviewBatchId" TEXT;

-- AlterTable
ALTER TABLE "WarehouseExternalReference" ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "mappingConfidence" "MappingConfidence" NOT NULL DEFAULT 'UNMAPPED',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateTable
CREATE TABLE "SourceAuthorityRule" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fieldName" TEXT,
    "authoritativeSourceSystem" TEXT NOT NULL,
    "authorityType" "AuthorityType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "rationale" TEXT NOT NULL,
    "decidedById" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceAuthorityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityConflict" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fieldName" TEXT,
    "conflictingSources" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionStatus" "ManualReviewStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "AuthorityConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ReviewBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDecisionDetail" (
    "id" TEXT NOT NULL,
    "manualReviewItemId" TEXT NOT NULL,
    "decisionType" "ReviewDecisionType" NOT NULL,
    "reviewerId" TEXT,
    "evidence" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "sourceRecordRefs" JSONB NOT NULL,
    "canonicalEntityId" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "reversible" BOOLEAN NOT NULL DEFAULT true,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDecisionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineDefinition" (
    "id" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "definition" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "sourceSystems" JSONB NOT NULL,
    "includedDocumentTypes" JSONB,
    "excludedDocumentTypes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "BaselineDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineRun" (
    "id" TEXT NOT NULL,
    "dataCutoffAt" TIMESTAMP(3) NOT NULL,
    "sourceCursors" JSONB NOT NULL,
    "inputRowCounts" JSONB NOT NULL,
    "calculationChecksum" TEXT NOT NULL,
    "outputChecksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredById" TEXT,

    CONSTRAINT "BaselineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineMetric" (
    "id" TEXT NOT NULL,
    "baselineRunId" TEXT NOT NULL,
    "baselineDefinitionId" TEXT NOT NULL,
    "segment" JSONB NOT NULL DEFAULT '{}',
    "value" DECIMAL(18,4) NOT NULL,
    "currency" TEXT,
    "dateRangeStart" TIMESTAMP(3),
    "dateRangeEnd" TIMESTAMP(3),
    "dataQualityScore" DOUBLE PRECISION,
    "confidence" TEXT,
    "evidence" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaselineMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataQualityScore" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "completeness" DOUBLE PRECISION NOT NULL,
    "validity" DOUBLE PRECISION NOT NULL,
    "uniqueness" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "timeliness" DOUBLE PRECISION NOT NULL,
    "referentialIntegrity" DOUBLE PRECISION NOT NULL,
    "reconciliationAccuracy" DOUBLE PRECISION NOT NULL,
    "provenanceCompleteness" DOUBLE PRECISION NOT NULL,
    "overallClassification" "DataQualityClassification" NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computedByVersion" TEXT NOT NULL,

    CONSTRAINT "DataQualityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUseCaseReadiness" (
    "id" TEXT NOT NULL,
    "useCaseName" TEXT NOT NULL,
    "businessObjective" TEXT NOT NULL,
    "requiredData" JSONB NOT NULL,
    "availableData" JSONB NOT NULL,
    "missingData" JSONB NOT NULL,
    "labelDefinition" TEXT,
    "labelAvailability" TEXT,
    "sampleSize" INTEGER,
    "dateCoverageStart" TIMESTAMP(3),
    "dateCoverageEnd" TIMESTAMP(3),
    "featureCompleteness" DOUBLE PRECISION,
    "targetLeakageRisk" TEXT,
    "classImbalanceRisk" TEXT,
    "biasRisk" TEXT,
    "groundTruthQuality" TEXT,
    "evaluationMethod" TEXT,
    "humanApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "safetyRisk" TEXT,
    "status" "AIUseCaseStatus" NOT NULL,
    "recommendation" TEXT NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedByVersion" TEXT NOT NULL,

    CONSTRAINT "AIUseCaseReadiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIDatasetContract" (
    "id" TEXT NOT NULL,
    "datasetName" TEXT NOT NULL,
    "buildVersion" INTEGER NOT NULL DEFAULT 1,
    "businessPurpose" TEXT NOT NULL,
    "sourceEntities" JSONB NOT NULL,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "requiredFields" JSONB NOT NULL,
    "optionalFields" JSONB,
    "exclusionRules" JSONB,
    "qualityThresholds" JSONB,
    "labelDefinition" TEXT,
    "featureDefinition" JSONB NOT NULL,
    "entityKey" TEXT NOT NULL,
    "timeKey" TEXT,
    "trainSplitStrategy" TEXT NOT NULL,
    "validationSplitStrategy" TEXT NOT NULL,
    "testSplitStrategy" TEXT NOT NULL,
    "leakageControls" JSONB NOT NULL,
    "missingValuePolicy" TEXT NOT NULL,
    "outlierPolicy" TEXT NOT NULL,
    "deduplicationPolicy" TEXT NOT NULL,
    "personalDataPolicy" TEXT NOT NULL,
    "provenanceFields" JSONB NOT NULL,
    "datasetChecksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "AIDatasetContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotName" TEXT NOT NULL,
    "sourceSystems" JSONB NOT NULL,
    "sourceSchemaVersions" JSONB,
    "dataCutoffAt" TIMESTAMP(3) NOT NULL,
    "cursorPositions" JSONB NOT NULL,
    "rowCounts" JSONB NOT NULL,
    "financialTotals" JSONB,
    "datasetChecksums" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "retentionPolicy" TEXT NOT NULL DEFAULT 'RETAIN_INDEFINITELY',

    CONSTRAINT "DataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceAuthorityRule_entityType_fieldName_effectiveTo_idx" ON "SourceAuthorityRule"("entityType", "fieldName", "effectiveTo");

-- CreateIndex
CREATE INDEX "AuthorityConflict_entityType_resolutionStatus_idx" ON "AuthorityConflict"("entityType", "resolutionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewBatch_name_key" ON "ReviewBatch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewDecisionDetail_manualReviewItemId_key" ON "ReviewDecisionDetail"("manualReviewItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineDefinition_metricName_version_key" ON "BaselineDefinition"("metricName", "version");

-- CreateIndex
CREATE INDEX "BaselineMetric_baselineRunId_baselineDefinitionId_idx" ON "BaselineMetric"("baselineRunId", "baselineDefinitionId");

-- CreateIndex
CREATE INDEX "DataQualityScore_scopeType_scopeId_idx" ON "DataQualityScore"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "AIUseCaseReadiness_useCaseName_key" ON "AIUseCaseReadiness"("useCaseName");

-- CreateIndex
CREATE UNIQUE INDEX "AIDatasetContract_datasetName_buildVersion_key" ON "AIDatasetContract"("datasetName", "buildVersion");

-- CreateIndex
CREATE UNIQUE INDEX "DataSnapshot_snapshotName_key" ON "DataSnapshot"("snapshotName");

-- CreateIndex
CREATE INDEX "BranchExternalReference_mappingConfidence_idx" ON "BranchExternalReference"("mappingConfidence");

-- CreateIndex
CREATE INDEX "ManualReviewItem_reviewBatchId_idx" ON "ManualReviewItem"("reviewBatchId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_priorityScore_idx" ON "ManualReviewItem"("priorityScore");

-- CreateIndex
CREATE INDEX "WarehouseExternalReference_mappingConfidence_idx" ON "WarehouseExternalReference"("mappingConfidence");

-- AddForeignKey
ALTER TABLE "ManualReviewItem" ADD CONSTRAINT "ManualReviewItem_reviewBatchId_fkey" FOREIGN KEY ("reviewBatchId") REFERENCES "ReviewBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDecisionDetail" ADD CONSTRAINT "ReviewDecisionDetail_manualReviewItemId_fkey" FOREIGN KEY ("manualReviewItemId") REFERENCES "ManualReviewItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineMetric" ADD CONSTRAINT "BaselineMetric_baselineRunId_fkey" FOREIGN KEY ("baselineRunId") REFERENCES "BaselineRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineMetric" ADD CONSTRAINT "BaselineMetric_baselineDefinitionId_fkey" FOREIGN KEY ("baselineDefinitionId") REFERENCES "BaselineDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
