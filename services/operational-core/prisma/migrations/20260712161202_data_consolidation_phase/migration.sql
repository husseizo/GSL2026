-- CreateEnum
CREATE TYPE "RawRecordProcessingStatus" AS ENUM ('STAGED', 'VALIDATED', 'NORMALIZED', 'MATCHED', 'IMPORTED', 'REJECTED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'WARNING');

-- CreateEnum
CREATE TYPE "NormalizationStatus" AS ENUM ('NOT_NORMALIZED', 'NORMALIZED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "MatchLevel" AS ENUM ('EXACT', 'HIGH_CONFIDENCE', 'POSSIBLE_MATCH', 'NO_MATCH', 'CONFLICT');

-- CreateEnum
CREATE TYPE "EntityMatchStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPLIED');

-- CreateEnum
CREATE TYPE "ManualReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "SourceDeletionResolution" AS ENUM ('PENDING', 'CONFIRMED_DELETED', 'CONFIRMED_STILL_ACTIVE', 'FALSE_POSITIVE');

-- AlterTable
ALTER TABLE "IntegrationSource" ADD COLUMN     "extractionMode" TEXT,
ADD COLUMN     "schemaVersion" TEXT;

-- CreateTable
CREATE TABLE "RawSourceRecord" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceDatabase" TEXT NOT NULL,
    "sourceSchema" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceRecordKey" TEXT NOT NULL,
    "feedName" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "rawChecksum" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCreatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "processingStatus" "RawRecordProcessingStatus" NOT NULL DEFAULT 'STAGED',
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "normalizationStatus" "NormalizationStatus" NOT NULL DEFAULT 'NOT_NORMALIZED',
    "matchingStatus" "MatchLevel",
    "finalEntityType" TEXT,
    "finalEntityId" TEXT,
    "errorDetails" JSONB,
    "warningDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSchemaSnapshot" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceDatabase" TEXT NOT NULL,
    "sourceSchema" TEXT NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "schemaHash" TEXT NOT NULL,
    "rowCountApprox" BIGINT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSchemaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityMatchCandidate" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "rawSourceRecordId" TEXT NOT NULL,
    "candidateEntityId" TEXT,
    "matchLevel" "MatchLevel" NOT NULL,
    "matchSignals" JSONB NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "status" "EntityMatchStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityMatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualReviewItem" (
    "id" TEXT NOT NULL,
    "queueType" TEXT NOT NULL,
    "relatedRawSourceRecordId" TEXT,
    "relatedEntityMatchCandidateId" TEXT,
    "proposedAction" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "status" "ManualReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationReport" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "extractedCount" INTEGER NOT NULL,
    "stagedCount" INTEGER NOT NULL,
    "validCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "deadLetterCount" INTEGER NOT NULL,
    "manualReviewCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "varianceReason" TEXT,
    "sourceSubtotal" DECIMAL(16,2),
    "sourceTax" DECIMAL(16,2),
    "sourceDiscount" DECIMAL(16,2),
    "sourceTotal" DECIMAL(16,2),
    "targetSubtotal" DECIMAL(16,2),
    "targetTax" DECIMAL(16,2),
    "targetDiscount" DECIMAL(16,2),
    "targetTotal" DECIMAL(16,2),
    "financialDifference" DECIMAL(16,2),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDeletionCandidate" (
    "id" TEXT NOT NULL,
    "feedName" TEXT NOT NULL,
    "sourceRecordKey" TEXT NOT NULL,
    "lastSeenBatchId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "detectedMissingBatchId" TEXT NOT NULL,
    "detectedMissingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolutionStatus" "SourceDeletionResolution" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "SourceDeletionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartExternalReference" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseExternalReference" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchExternalReference" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RawSourceRecord_feedName_processingStatus_idx" ON "RawSourceRecord"("feedName", "processingStatus");

-- CreateIndex
CREATE INDEX "RawSourceRecord_sourceSystem_sourceTable_idx" ON "RawSourceRecord"("sourceSystem", "sourceTable");

-- CreateIndex
CREATE INDEX "RawSourceRecord_finalEntityType_finalEntityId_idx" ON "RawSourceRecord"("finalEntityType", "finalEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "RawSourceRecord_feedName_sourceRecordKey_key" ON "RawSourceRecord"("feedName", "sourceRecordKey");

-- CreateIndex
CREATE INDEX "SourceSchemaSnapshot_sourceSystem_sourceTable_capturedAt_idx" ON "SourceSchemaSnapshot"("sourceSystem", "sourceTable", "capturedAt");

-- CreateIndex
CREATE INDEX "EntityMatchCandidate_entityType_matchLevel_status_idx" ON "EntityMatchCandidate"("entityType", "matchLevel", "status");

-- CreateIndex
CREATE INDEX "EntityMatchCandidate_candidateEntityId_idx" ON "EntityMatchCandidate"("candidateEntityId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_queueType_status_idx" ON "ManualReviewItem"("queueType", "status");

-- CreateIndex
CREATE INDEX "ReconciliationReport_batchId_entityType_idx" ON "ReconciliationReport"("batchId", "entityType");

-- CreateIndex
CREATE INDEX "SourceDeletionCandidate_feedName_resolutionStatus_idx" ON "SourceDeletionCandidate"("feedName", "resolutionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDeletionCandidate_feedName_sourceRecordKey_detectedMi_key" ON "SourceDeletionCandidate"("feedName", "sourceRecordKey", "detectedMissingBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "PartExternalReference_sourceSystem_sourceRecordId_key" ON "PartExternalReference"("sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseExternalReference_sourceSystem_sourceCode_key" ON "WarehouseExternalReference"("sourceSystem", "sourceCode");

-- CreateIndex
CREATE UNIQUE INDEX "BranchExternalReference_sourceSystem_sourceCode_key" ON "BranchExternalReference"("sourceSystem", "sourceCode");

-- AddForeignKey
ALTER TABLE "RawSourceRecord" ADD CONSTRAINT "RawSourceRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMatchCandidate" ADD CONSTRAINT "EntityMatchCandidate_rawSourceRecordId_fkey" FOREIGN KEY ("rawSourceRecordId") REFERENCES "RawSourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMatchCandidate" ADD CONSTRAINT "EntityMatchCandidate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualReviewItem" ADD CONSTRAINT "ManualReviewItem_relatedRawSourceRecordId_fkey" FOREIGN KEY ("relatedRawSourceRecordId") REFERENCES "RawSourceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualReviewItem" ADD CONSTRAINT "ManualReviewItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationReport" ADD CONSTRAINT "ReconciliationReport_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartExternalReference" ADD CONSTRAINT "PartExternalReference_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseExternalReference" ADD CONSTRAINT "WarehouseExternalReference_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchExternalReference" ADD CONSTRAINT "BranchExternalReference_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
