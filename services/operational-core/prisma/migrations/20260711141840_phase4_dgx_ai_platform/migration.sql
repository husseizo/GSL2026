-- CreateEnum
CREATE TYPE "AiModelKind" AS ENUM ('GENERATION', 'EMBEDDING');

-- CreateEnum
CREATE TYPE "AiModelProvider" AS ENUM ('OLLAMA');

-- CreateEnum
CREATE TYPE "AiModelStatus" AS ENUM ('ACTIVE', 'TESTING', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "AiInferenceKind" AS ENUM ('GENERATION', 'EMBEDDING');

-- CreateEnum
CREATE TYPE "AiFeedbackDecision" AS ENUM ('ACCEPTED', 'REJECTED', 'EDITED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('WORKSHOP_MANUAL', 'TECHNICAL_SERVICE_BULLETIN', 'OEM_REPAIR_PROCEDURE', 'INTERNAL_SOP', 'LUBRICANT_DOCUMENTATION', 'PARTS_DOCUMENTATION', 'SUPPLIER_CATALOGUE', 'VEHICLE_HISTORY', 'DIGITAL_TWIN', 'GARAGE_HISTORY', 'INSPECTION_REPORT', 'WARRANTY_CASE', 'REPEAT_REPAIR', 'COMPANY_POLICY', 'OTHER');

-- CreateEnum
CREATE TYPE "CopyrightStatus" AS ENUM ('OWNED', 'LICENSED', 'PUBLIC_DOMAIN', 'RESTRICTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ForecastTargetType" AS ENUM ('PART', 'LUBRICANT', 'BRANCH', 'SUPPLIER', 'GARAGE_WORKLOAD', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ForecastMethod" AS ENUM ('NAIVE', 'MOVING_AVERAGE', 'EXPONENTIAL_SMOOTHING', 'SEASONAL_NAIVE');

-- CreateEnum
CREATE TYPE "EvaluationPurpose" AS ENUM ('RETRIEVAL', 'GENERATION', 'FORECAST', 'RECOMMENDATION');

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "AiModelProvider" NOT NULL DEFAULT 'OLLAMA',
    "kind" "AiModelKind" NOT NULL,
    "family" TEXT NOT NULL,
    "version" TEXT,
    "quantization" TEXT,
    "parameterSize" TEXT,
    "sizeBytes" BIGINT,
    "status" "AiModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "userPromptTemplate" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "maxTokens" INTEGER,
    "modelId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInferenceLog" (
    "id" TEXT NOT NULL,
    "kind" "AiInferenceKind" NOT NULL,
    "modelId" TEXT,
    "promptVersionId" TEXT,
    "actorId" TEXT,
    "actorRole" TEXT,
    "correlationId" TEXT,
    "promptText" TEXT,
    "responseText" TEXT,
    "temperature" DOUBLE PRECISION,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,
    "confidence" DOUBLE PRECISION,
    "retrievedDocumentIds" JSONB,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInferenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFeedback" (
    "id" TEXT NOT NULL,
    "inferenceLogId" TEXT NOT NULL,
    "actorId" TEXT,
    "decision" "AiFeedbackDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT,
    "publicationDate" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "copyrightStatus" "CopyrightStatus" NOT NULL DEFAULT 'UNKNOWN',
    "language" TEXT NOT NULL DEFAULT 'en',
    "accessPermissions" JSONB,
    "sourceUri" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "vehicleId" TEXT,
    "partId" TEXT,
    "lubricantProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "embeddingVersion" INTEGER NOT NULL DEFAULT 1,
    "embedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL,
    "targetType" "ForecastTargetType" NOT NULL,
    "targetId" TEXT,
    "windowDays" INTEGER NOT NULL,
    "method" "ForecastMethod" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mape" DOUBLE PRECISION,
    "rmse" DOUBLE PRECISION,
    "mae" DOUBLE PRECISION,
    "bias" DOUBLE PRECISION,
    "confidence" TEXT,
    "chosenAsBest" BOOLEAN NOT NULL DEFAULT false,
    "evidence" JSONB,

    CONSTRAINT "ForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastPoint" (
    "id" TEXT NOT NULL,
    "forecastRunId" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "predictedValue" DOUBLE PRECISION NOT NULL,
    "actualValue" DOUBLE PRECISION,

    CONSTRAINT "ForecastPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationDataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "EvaluationPurpose" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCase" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "expectedOutput" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationRun" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "modelId" TEXT,
    "promptVersionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metrics" JSONB,
    "notes" TEXT,

    CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_name_key" ON "AiModel"("name");

-- CreateIndex
CREATE INDEX "AiModel_kind_status_idx" ON "AiModel"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_name_key" ON "PromptTemplate"("name");

-- CreateIndex
CREATE INDEX "PromptVersion_templateId_isActive_idx" ON "PromptVersion"("templateId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_templateId_version_key" ON "PromptVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "AiInferenceLog_kind_createdAt_idx" ON "AiInferenceLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AiInferenceLog_success_idx" ON "AiInferenceLog"("success");

-- CreateIndex
CREATE INDEX "AiFeedback_inferenceLogId_idx" ON "AiFeedback"("inferenceLogId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_sourceType_isApproved_idx" ON "KnowledgeDocument"("sourceType", "isApproved");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_embeddingModel_idx" ON "KnowledgeChunk"("embeddingModel");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_checksum_key" ON "KnowledgeChunk"("documentId", "checksum");

-- CreateIndex
CREATE INDEX "ForecastRun_targetType_targetId_windowDays_idx" ON "ForecastRun"("targetType", "targetId", "windowDays");

-- CreateIndex
CREATE INDEX "ForecastPoint_forecastRunId_forecastDate_idx" ON "ForecastPoint"("forecastRunId", "forecastDate");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationDataset_name_key" ON "EvaluationDataset"("name");

-- CreateIndex
CREATE INDEX "EvaluationCase_datasetId_idx" ON "EvaluationCase"("datasetId");

-- CreateIndex
CREATE INDEX "EvaluationRun_datasetId_startedAt_idx" ON "EvaluationRun"("datasetId", "startedAt");

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInferenceLog" ADD CONSTRAINT "AiInferenceLog_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiInferenceLog" ADD CONSTRAINT "AiInferenceLog_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFeedback" ADD CONSTRAINT "AiFeedback_inferenceLogId_fkey" FOREIGN KEY ("inferenceLogId") REFERENCES "AiInferenceLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_lubricantProductId_fkey" FOREIGN KEY ("lubricantProductId") REFERENCES "LubricantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastPoint" ADD CONSTRAINT "ForecastPoint_forecastRunId_fkey" FOREIGN KEY ("forecastRunId") REFERENCES "ForecastRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCase" ADD CONSTRAINT "EvaluationCase_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "EvaluationDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "EvaluationDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
