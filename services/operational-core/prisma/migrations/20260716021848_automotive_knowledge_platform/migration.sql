-- CreateEnum
CREATE TYPE "KnowledgeSourceAuthority" AS ENUM ('OEM_OFFICIAL', 'OEM_AUTHORIZED_DISTRIBUTOR', 'INDEPENDENT_TECHNICAL_PUBLISHER', 'INTERNAL_WORKSHOP', 'COMMUNITY_SOURCED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('DISCOVERED', 'UNDER_REVIEW', 'APPROVED', 'APPROVED_WITH_RESTRICTIONS', 'REJECTED', 'EXPIRED', 'SUSPENDED', 'WITHDRAWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeItemType" AS ENUM ('TECHNICAL_BULLETIN', 'REPAIR_PROCEDURE', 'DIAGNOSTIC_PROCEDURE', 'INSPECTION_PROCEDURE', 'SERVICE_INTERVAL', 'TORQUE_SPECIFICATION', 'FLUID_SPECIFICATION', 'LUBRICANT_APPROVAL', 'PART_FITMENT', 'PART_SUPERSESSION', 'PRODUCT_TECHNICAL_DATA', 'SAFETY_WARNING', 'WARRANTY_RULE', 'WORKSHOP_SOP', 'INVENTORY_POLICY', 'PURCHASING_POLICY', 'CUSTOMER_SERVICE_POLICY', 'DATA_GOVERNANCE_POLICY', 'AI_GOVERNANCE_POLICY', 'TRAINING_MATERIAL', 'VEHICLE_TECHNICAL_PROFILE', 'ENGINE_TECHNICAL_PROFILE', 'TRANSMISSION_TECHNICAL_PROFILE', 'TROUBLESHOOTING_GUIDE', 'KNOWN_ISSUE', 'INTERNAL_CASE_NOTE', 'REPEAT_REPAIR_CASE', 'OTHER');

-- CreateEnum
CREATE TYPE "KnowledgeItemStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'EXPIRED', 'WITHDRAWN', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClaimVerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'DISPUTED', 'RETRACTED');

-- CreateEnum
CREATE TYPE "StructuredFactType" AS ENUM ('TORQUE_SPEC', 'FLUID_CAPACITY', 'FLUID_TYPE', 'SERVICE_INTERVAL', 'FITMENT', 'ELECTRICAL_SPEC', 'PRESSURE_SPEC', 'CLEARANCE_SPEC', 'PART_DIMENSION', 'WEIGHT_SPEC', 'WARRANTY_TERM', 'DIAGNOSTIC_THRESHOLD', 'OTHER');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'RESOLVED_KEEP_A', 'RESOLVED_KEEP_B', 'RESOLVED_BOTH_VALID_DIFFERENT_SCOPE', 'UNRESOLVED_ESCALATED');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotStatus" AS ENUM ('BUILDING', 'VALIDATING', 'EVALUATING', 'APPROVED', 'ACTIVE', 'ROLLED_BACK', 'RETIRED');

-- CreateEnum
CREATE TYPE "KnowledgeGraphNodeType" AS ENUM ('KNOWLEDGE_ITEM', 'VEHICLE', 'PART', 'ENGINE', 'FAULT_CODE', 'PROCEDURE_STEP', 'KNOWLEDGE_SOURCE');

-- CreateEnum
CREATE TYPE "KnowledgeGraphEdgeType" AS ENUM ('APPLIES_TO', 'SUPERSEDES', 'CONFLICTS_WITH', 'DERIVED_FROM', 'REFERENCES', 'CAUSED_BY', 'RESOLVED_BY');

-- CreateEnum
CREATE TYPE "KnowledgeReviewerRole" AS ENUM ('TECHNICAL_REVIEWER', 'LICENSING_REVIEWER', 'SAFETY_REVIEWER', 'FINAL_APPROVER');

-- CreateEnum
CREATE TYPE "KnowledgeReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES');

-- AlterEnum
ALTER TYPE "BenchmarkCategory" ADD VALUE 'KNOWLEDGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KnowledgeSourceType" ADD VALUE 'KNOWLEDGE_PLATFORM_PROCEDURE';
ALTER TYPE "KnowledgeSourceType" ADD VALUE 'KNOWLEDGE_PLATFORM_POLICY';
ALTER TYPE "KnowledgeSourceType" ADD VALUE 'KNOWLEDGE_PLATFORM_STRUCTURED_FACT';
ALTER TYPE "KnowledgeSourceType" ADD VALUE 'KNOWLEDGE_PLATFORM_CASE_STUDY';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'KNOWLEDGE_STEWARD';

-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "knowledgeItemVersionId" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "provider" TEXT,
    "authority" "KnowledgeSourceAuthority" NOT NULL DEFAULT 'UNKNOWN',
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'DISCOVERED',
    "domain" TEXT,
    "accessMethod" TEXT,
    "reliability" DOUBLE PRECISION,
    "licenseTerms" JSONB,
    "copyrightStatus" "CopyrightStatus" NOT NULL DEFAULT 'UNKNOWN',
    "accessClassification" TEXT,
    "allowedInternalUse" BOOLEAN NOT NULL DEFAULT false,
    "allowedAiUse" BOOLEAN NOT NULL DEFAULT false,
    "allowedEmbeddingUse" BOOLEAN NOT NULL DEFAULT false,
    "allowedQuotationUse" BOOLEAN NOT NULL DEFAULT false,
    "redistributionRestrictions" TEXT,
    "updateFrequency" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "geographicScope" TEXT,
    "vehicleBrandScope" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "restrictedReason" TEXT,
    "reviewerId" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "itemType" "KnowledgeItemType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItemVersion" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "contentChecksum" TEXT NOT NULL,
    "status" "KnowledgeItemStatus" NOT NULL DEFAULT 'DRAFT',
    "authorityLevel" "KnowledgeSourceAuthority" NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "supersedesVersionId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnReason" TEXT,
    "provenance" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItemVehicleApplicability" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "vehicleModelKey" TEXT,
    "conditions" JSONB,

    CONSTRAINT "KnowledgeItemVehicleApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItemPartApplicability" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "partId" TEXT,
    "partCategoryKey" TEXT,
    "conditions" JSONB,

    CONSTRAINT "KnowledgeItemPartApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItemEngineApplicability" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "engineCode" TEXT NOT NULL,
    "transmissionCode" TEXT,
    "conditions" JSONB,

    CONSTRAINT "KnowledgeItemEngineApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItemFaultCodeApplicability" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "faultCode" TEXT NOT NULL,
    "conditions" JSONB,

    CONSTRAINT "KnowledgeItemFaultCodeApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeClaim" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "evidenceQuote" TEXT NOT NULL,
    "evidenceLocation" JSONB,
    "verificationStatus" "ClaimVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructuredFact" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionId" TEXT,
    "sourceClaimId" TEXT,
    "factType" "StructuredFactType" NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "conditions" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "extractedBy" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructuredFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeConflict" (
    "id" TEXT NOT NULL,
    "claimAId" TEXT NOT NULL,
    "claimBId" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL,
    "severity" TEXT,
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshot" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "KnowledgeSnapshotStatus" NOT NULL DEFAULT 'BUILDING',
    "itemVersionsIncluded" INTEGER NOT NULL DEFAULT 0,
    "itemsExcluded" JSONB,
    "checksum" TEXT,
    "evaluationMetrics" JSONB,
    "intendedAiConsumers" JSONB,
    "retentionPolicy" TEXT,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshotItemVersion" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "itemVersionId" TEXT NOT NULL,

    CONSTRAINT "KnowledgeSnapshotItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGraphNode" (
    "id" TEXT NOT NULL,
    "nodeType" "KnowledgeGraphNodeType" NOT NULL,
    "refId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeGraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGraphEdge" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "edgeType" "KnowledgeGraphEdgeType" NOT NULL,
    "weight" DOUBLE PRECISION,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeReviewAssignment" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "reviewerRole" "KnowledgeReviewerRole" NOT NULL,
    "assignedToId" TEXT,
    "decision" "KnowledgeReviewDecision",
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_name_key" ON "KnowledgeSource"("name");

-- CreateIndex
CREATE INDEX "KnowledgeSource_status_authority_idx" ON "KnowledgeSource"("status", "authority");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItem_key_key" ON "KnowledgeItem"("key");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItem_currentVersionId_key" ON "KnowledgeItem"("currentVersionId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_itemType_idx" ON "KnowledgeItem"("itemType");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItemVersion_supersedesVersionId_key" ON "KnowledgeItemVersion"("supersedesVersionId");

-- CreateIndex
CREATE INDEX "KnowledgeItemVersion_itemId_status_idx" ON "KnowledgeItemVersion"("itemId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeItemVersion_effectiveUntil_idx" ON "KnowledgeItemVersion"("effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItemVersion_itemId_version_key" ON "KnowledgeItemVersion"("itemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItemVehicleApplicability_itemId_vehicleId_vehicleM_key" ON "KnowledgeItemVehicleApplicability"("itemId", "vehicleId", "vehicleModelKey");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItemPartApplicability_itemId_partId_partCategoryKe_key" ON "KnowledgeItemPartApplicability"("itemId", "partId", "partCategoryKey");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItemEngineApplicability_itemId_engineCode_transmis_key" ON "KnowledgeItemEngineApplicability"("itemId", "engineCode", "transmissionCode");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItemFaultCodeApplicability_itemId_faultCode_key" ON "KnowledgeItemFaultCodeApplicability"("itemId", "faultCode");

-- CreateIndex
CREATE INDEX "KnowledgeClaim_itemId_verificationStatus_idx" ON "KnowledgeClaim"("itemId", "verificationStatus");

-- CreateIndex
CREATE INDEX "KnowledgeClaim_versionId_idx" ON "KnowledgeClaim"("versionId");

-- CreateIndex
CREATE INDEX "StructuredFact_itemId_factType_idx" ON "StructuredFact"("itemId", "factType");

-- CreateIndex
CREATE INDEX "KnowledgeConflict_status_idx" ON "KnowledgeConflict"("status");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshot_status_idx" ON "KnowledgeSnapshot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSnapshot_versionNumber_key" ON "KnowledgeSnapshot"("versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSnapshotItemVersion_snapshotId_itemVersionId_key" ON "KnowledgeSnapshotItemVersion"("snapshotId", "itemVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGraphNode_nodeType_refId_key" ON "KnowledgeGraphNode"("nodeType", "refId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_edgeType_idx" ON "KnowledgeGraphEdge"("edgeType");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGraphEdge_fromNodeId_toNodeId_edgeType_key" ON "KnowledgeGraphEdge"("fromNodeId", "toNodeId", "edgeType");

-- CreateIndex
CREATE INDEX "KnowledgeReviewAssignment_versionId_reviewerRole_idx" ON "KnowledgeReviewAssignment"("versionId", "reviewerRole");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_knowledgeItemVersionId_key" ON "KnowledgeDocument"("knowledgeItemVersionId");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_knowledgeItemVersionId_fkey" FOREIGN KEY ("knowledgeItemVersionId") REFERENCES "KnowledgeItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "KnowledgeItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemVersion" ADD CONSTRAINT "KnowledgeItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemVersion" ADD CONSTRAINT "KnowledgeItemVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "KnowledgeItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemVehicleApplicability" ADD CONSTRAINT "KnowledgeItemVehicleApplicability_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemVehicleApplicability" ADD CONSTRAINT "KnowledgeItemVehicleApplicability_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemPartApplicability" ADD CONSTRAINT "KnowledgeItemPartApplicability_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemPartApplicability" ADD CONSTRAINT "KnowledgeItemPartApplicability_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemEngineApplicability" ADD CONSTRAINT "KnowledgeItemEngineApplicability_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItemFaultCodeApplicability" ADD CONSTRAINT "KnowledgeItemFaultCodeApplicability_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeClaim" ADD CONSTRAINT "KnowledgeClaim_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeClaim" ADD CONSTRAINT "KnowledgeClaim_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgeItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredFact" ADD CONSTRAINT "StructuredFact_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredFact" ADD CONSTRAINT "StructuredFact_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgeItemVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructuredFact" ADD CONSTRAINT "StructuredFact_sourceClaimId_fkey" FOREIGN KEY ("sourceClaimId") REFERENCES "KnowledgeClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConflict" ADD CONSTRAINT "KnowledgeConflict_claimAId_fkey" FOREIGN KEY ("claimAId") REFERENCES "KnowledgeClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConflict" ADD CONSTRAINT "KnowledgeConflict_claimBId_fkey" FOREIGN KEY ("claimBId") REFERENCES "KnowledgeClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshotItemVersion" ADD CONSTRAINT "KnowledgeSnapshotItemVersion_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "KnowledgeSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshotItemVersion" ADD CONSTRAINT "KnowledgeSnapshotItemVersion_itemVersionId_fkey" FOREIGN KEY ("itemVersionId") REFERENCES "KnowledgeItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGraphEdge" ADD CONSTRAINT "KnowledgeGraphEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "KnowledgeGraphNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGraphEdge" ADD CONSTRAINT "KnowledgeGraphEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "KnowledgeGraphNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeReviewAssignment" ADD CONSTRAINT "KnowledgeReviewAssignment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgeItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

