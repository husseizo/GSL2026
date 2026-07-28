-- CreateEnum
CREATE TYPE "RetrievalQueryClass" AS ENUM ('OEM_PART_NUMBER', 'INTERNAL_ITEM_CODE', 'TECDOC_ARTICLE', 'BARCODE', 'SKU', 'VEHICLE_VIN', 'ENGINE_CODE', 'TRANSMISSION_CODE', 'LUBRICANT_APPROVAL', 'LUBRICANT_PRODUCT', 'VEHICLE_MODEL', 'FAULT_CODE', 'TECHNICAL_PROCEDURE', 'FREE_TEXT_QUESTION', 'MIXED_QUERY', 'SWAHILI', 'ENGLISH', 'MIXED_LANGUAGE', 'TYPO', 'APPROXIMATE_SEARCH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RetrievalStrategyMode" AS ENUM ('IDENTIFIER_ONLY', 'BM25', 'VECTOR', 'HYBRID', 'HYBRID_GRAPH', 'HYBRID_GRAPH_AUTHORITY', 'HYBRID_GRAPH_AUTHORITY_FRESHNESS', 'HYBRID_GRAPH_AUTHORITY_FIELD_BOOST', 'HYBRID_GRAPH_AUTHORITY_STRUCTURED_FACTS', 'HYBRID_GRAPH_AUTHORITY_LTR');

-- CreateEnum
CREATE TYPE "RetrievalFailureType" AS ENUM ('WRONG_IDENTIFIER', 'WRONG_RANKING', 'MISSING_EMBEDDING', 'MISSING_GRAPH', 'WRONG_SNAPSHOT', 'WRONG_CITATION', 'PERMISSION_ERROR', 'CONFLICT_ERROR', 'FRESHNESS_ERROR', 'NO_RESULT', 'FALSE_RESULT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'HAS_ENGINE';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'HAS_TRANSMISSION';
ALTER TYPE "KnowledgeGraphEdgeType" ADD VALUE 'RELATED_TO';

-- CreateTable
CREATE TABLE "RetrievalQueryLog" (
    "id" TEXT NOT NULL,
    "queryText" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "detectedLanguage" TEXT NOT NULL,
    "queryClass" "RetrievalQueryClass" NOT NULL,
    "identifiersDetected" JSONB NOT NULL,
    "strategyMode" "RetrievalStrategyMode" NOT NULL,
    "candidateCounts" JSONB NOT NULL,
    "rankingExplanation" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "stageLatenciesMs" JSONB NOT NULL,
    "snapshotId" TEXT,
    "consumerName" TEXT NOT NULL,
    "correlationId" TEXT,
    "failureType" "RetrievalFailureType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategyModeA" "RetrievalStrategyMode" NOT NULL,
    "strategyModeB" "RetrievalStrategyMode",
    "embeddingModelA" TEXT,
    "embeddingModelB" TEXT,
    "queryLogIds" JSONB NOT NULL,
    "resultsA" JSONB NOT NULL,
    "resultsB" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalTermAlias" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "canonicalTerm" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalTermAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetrievalQueryLog_queryClass_createdAt_idx" ON "RetrievalQueryLog"("queryClass", "createdAt");

-- CreateIndex
CREATE INDEX "RetrievalQueryLog_consumerName_idx" ON "RetrievalQueryLog"("consumerName");

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalExperiment_name_key" ON "RetrievalExperiment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalTermAlias_term_aliasType_key" ON "RetrievalTermAlias"("term", "aliasType");
