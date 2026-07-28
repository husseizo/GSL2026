-- CreateEnum
CREATE TYPE "CatalogueIndexStatus" AS ENUM ('BUILDING', 'VALIDATING', 'EVALUATING', 'APPROVED', 'ACTIVE', 'ROLLED_BACK', 'RETIRED');

-- CreateEnum
CREATE TYPE "PartRelationshipType" AS ENUM ('SAME_AS', 'ALTERNATE_NUMBER', 'SUPERSEDES', 'SUPERSEDED_BY', 'COMPATIBLE_WITH', 'PART_OF_KIT', 'REPLACED_WITH', 'RELATED_SERVICE_ITEM', 'MANUAL_REVIEW_LINK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiFeedbackDecision" ADD VALUE 'HELPFUL';
ALTER TYPE "AiFeedbackDecision" ADD VALUE 'NOT_HELPFUL';
ALTER TYPE "AiFeedbackDecision" ADD VALUE 'MISSING_RESULT';
ALTER TYPE "AiFeedbackDecision" ADD VALUE 'WRONG_FITMENT';
ALTER TYPE "AiFeedbackDecision" ADD VALUE 'WRONG_ALTERNATIVE';
ALTER TYPE "AiFeedbackDecision" ADD VALUE 'WRONG_LUBRICANT_APPROVAL';
ALTER TYPE "AiFeedbackDecision" ADD VALUE 'CITATION_ISSUE';
ALTER TYPE "AiFeedbackDecision" ADD VALUE 'REQUIRES_REVIEW';

-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "indexVersionId" TEXT;

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "tecdocArticleId" TEXT;

-- CreateTable
CREATE TABLE "CatalogueIndexVersion" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "dataSnapshotId" TEXT,
    "status" "CatalogueIndexStatus" NOT NULL DEFAULT 'BUILDING',
    "embeddingModel" TEXT,
    "embeddingModelVersion" INTEGER,
    "chunkingStrategyVersion" INTEGER NOT NULL DEFAULT 1,
    "corpusChecksum" TEXT,
    "partsIndexed" INTEGER NOT NULL DEFAULT 0,
    "lubricantsIndexed" INTEGER NOT NULL DEFAULT 0,
    "partsExcluded" JSONB,
    "evaluationMetrics" JSONB,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "CatalogueIndexVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartRelationship" (
    "id" TEXT NOT NULL,
    "fromPartId" TEXT NOT NULL,
    "toPartId" TEXT NOT NULL,
    "relationshipType" "PartRelationshipType" NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "verificationStatus" "MatchCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB NOT NULL,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "PartRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogueIndexVersion_status_idx" ON "CatalogueIndexVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueIndexVersion_versionNumber_key" ON "CatalogueIndexVersion"("versionNumber");

-- CreateIndex
CREATE INDEX "PartRelationship_relationshipType_verificationStatus_idx" ON "PartRelationship"("relationshipType", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PartRelationship_fromPartId_toPartId_relationshipType_key" ON "PartRelationship"("fromPartId", "toPartId", "relationshipType");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_indexVersionId_idx" ON "KnowledgeDocument"("indexVersionId");

-- CreateIndex
CREATE INDEX "Part_tecdocArticleId_idx" ON "Part"("tecdocArticleId");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_indexVersionId_fkey" FOREIGN KEY ("indexVersionId") REFERENCES "CatalogueIndexVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogueIndexVersion" ADD CONSTRAINT "CatalogueIndexVersion_dataSnapshotId_fkey" FOREIGN KEY ("dataSnapshotId") REFERENCES "DataSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartRelationship" ADD CONSTRAINT "PartRelationship_fromPartId_fkey" FOREIGN KEY ("fromPartId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartRelationship" ADD CONSTRAINT "PartRelationship_toPartId_fkey" FOREIGN KEY ("toPartId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
