-- CreateEnum
CREATE TYPE "KnowledgeSourceAction" AS ENUM ('STORE_ORIGINAL', 'PARSE', 'EXTRACT_METADATA', 'EXTRACT_STRUCTURED_FACTS', 'CREATE_SEARCH_INDEX', 'CREATE_EMBEDDINGS', 'USE_FOR_RAG', 'DISPLAY_TO_INTERNAL_USER', 'DISPLAY_EXCERPT', 'EXPORT', 'REDISTRIBUTE', 'USE_FOR_MODEL_TRAINING', 'USE_FOR_FINE_TUNING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'FITS';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'HAS_ALTERNATIVE';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'PART_OF_KIT';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'REQUIRES_TOOL';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'REQUIRES_TORQUE';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'SUPPORTED_BY';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'CONTRADICTS';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'SUPERSEDED_BY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KnowledgeGraphNodeType" ADD VALUE 'TOOL';
ALTER TYPE "KnowledgeGraphNodeType" ADD VALUE 'TORQUE_SPECIFICATION';

-- AlterEnum
ALTER TYPE "StructuredFactType" ADD VALUE 'LUBRICANT_APPROVAL';

-- AlterTable
ALTER TABLE "KnowledgeItemVersion" ADD COLUMN     "encryptionKeyId" TEXT,
ADD COLUMN     "ocrApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ocrConfidence" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "KnowledgeReviewAssignment" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "escalationReason" TEXT,
ADD COLUMN     "isHighRisk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresDualReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewBatchId" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeSourcePermission" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "action" "KnowledgeSourceAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "setById" TEXT,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSourcePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionProfile" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fieldRules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeReviewBatch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeReviewBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSourcePermission_sourceId_action_key" ON "KnowledgeSourcePermission"("sourceId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionProfile_documentType_version_key" ON "ExtractionProfile"("documentType", "version");

-- CreateIndex
CREATE INDEX "KnowledgeReviewAssignment_reviewBatchId_idx" ON "KnowledgeReviewAssignment"("reviewBatchId");

-- AddForeignKey
ALTER TABLE "KnowledgeSourcePermission" ADD CONSTRAINT "KnowledgeSourcePermission_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeReviewAssignment" ADD CONSTRAINT "KnowledgeReviewAssignment_reviewBatchId_fkey" FOREIGN KEY ("reviewBatchId") REFERENCES "KnowledgeReviewBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

