-- CreateEnum
CREATE TYPE "ModelApprovalState" AS ENUM ('UNREVIEWED', 'UNDER_EVALUATION', 'APPROVED', 'REJECTED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "BenchmarkCategory" AS ENUM ('RETRIEVAL', 'GENERATION', 'SAFETY', 'SECURITY', 'PERFORMANCE', 'SWAHILI', 'ENGLISH', 'MIXED_LANGUAGE', 'REASONING', 'CONFLICT_DETECTION', 'PERMISSION_ENFORCEMENT', 'PROMPT_INJECTION', 'LATENCY', 'RELIABILITY', 'REGRESSION', 'PRODUCTION_READINESS');

-- CreateEnum
CREATE TYPE "BenchmarkApprovalStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "BenchmarkCaseStatus" AS ENUM ('DRAFT', 'REVIEW_REQUIRED', 'APPROVED', 'CONFLICTING', 'RETIRED');

-- CreateEnum
CREATE TYPE "BenchmarkRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BenchmarkRunTrigger" AS ENUM ('MANUAL', 'CI', 'PRE_DEPLOYMENT', 'SCHEDULED_DOC_ONLY');

-- CreateEnum
CREATE TYPE "BenchmarkGateStatus" AS ENUM ('PASS', 'FAIL', 'WAIVED');

-- CreateEnum
CREATE TYPE "BenchmarkSuiteDecision" AS ENUM ('APPROVED', 'REJECTED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "QualityGate" AS ENUM ('RETRIEVAL', 'SAFETY', 'CITATION', 'GROUNDEDNESS', 'PERFORMANCE', 'REGRESSION', 'HUMAN_APPROVAL');

-- AlterTable
ALTER TABLE "AiModel" ADD COLUMN     "approvalState" "ModelApprovalState" NOT NULL DEFAULT 'UNREVIEWED',
ADD COLUMN     "contextLength" INTEGER,
ADD COLUMN     "embeddingCompatibleWith" JSONB,
ADD COLUMN     "embeddingDimensions" INTEGER,
ADD COLUMN     "hardwareRequirements" JSONB,
ADD COLUMN     "license" TEXT,
ADD COLUMN     "rollbackTargetId" TEXT;

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "category" "BenchmarkCategory" NOT NULL,
    "subCategory" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "reviewerId" TEXT,
    "approvalStatus" "BenchmarkApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "isGold" BOOLEAN NOT NULL DEFAULT false,
    "checksum" TEXT,
    "provenance" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkCase" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "externalCaseId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "expectedOutput" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "BenchmarkCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkRun" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "suiteRunId" TEXT,
    "modelId" TEXT,
    "embeddingModelId" TEXT,
    "rerankerName" TEXT,
    "promptVersionId" TEXT,
    "indexVersionId" TEXT,
    "trigger" "BenchmarkRunTrigger" NOT NULL DEFAULT 'MANUAL',
    "status" "BenchmarkRunStatus" NOT NULL DEFAULT 'RUNNING',
    "casesEvaluated" INTEGER NOT NULL DEFAULT 0,
    "casesExcluded" INTEGER NOT NULL DEFAULT 0,
    "metrics" JSONB,
    "previousRunId" TEXT,
    "regressed" BOOLEAN,
    "regressionDetail" JSONB,
    "gateStatus" "BenchmarkGateStatus",
    "reportPath" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkSuiteRun" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "trigger" "BenchmarkRunTrigger" NOT NULL DEFAULT 'MANUAL',
    "status" "BenchmarkRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "decision" "BenchmarkSuiteDecision",
    "decisionById" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "reportPath" TEXT,

    CONSTRAINT "BenchmarkSuiteRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "selectionMetric" TEXT NOT NULL,
    "benchmarkId" TEXT,
    "winnerArmId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNotes" TEXT,

    CONSTRAINT "PromptExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptExperimentArm" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "runId" TEXT,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptExperimentArm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Benchmark_category_approvalStatus_idx" ON "Benchmark"("category", "approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_key_version_key" ON "Benchmark"("key", "version");

-- CreateIndex
CREATE INDEX "BenchmarkCase_benchmarkId_status_idx" ON "BenchmarkCase"("benchmarkId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkCase_benchmarkId_externalCaseId_key" ON "BenchmarkCase"("benchmarkId", "externalCaseId");

-- CreateIndex
CREATE INDEX "BenchmarkRun_benchmarkId_startedAt_idx" ON "BenchmarkRun"("benchmarkId", "startedAt");

-- CreateIndex
CREATE INDEX "BenchmarkRun_modelId_idx" ON "BenchmarkRun"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptExperiment_name_key" ON "PromptExperiment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PromptExperiment_winnerArmId_key" ON "PromptExperiment"("winnerArmId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptExperimentArm_experimentId_label_key" ON "PromptExperimentArm"("experimentId", "label");

-- CreateIndex
CREATE INDEX "AiModel_approvalState_idx" ON "AiModel"("approvalState");

-- AddForeignKey
ALTER TABLE "AiModel" ADD CONSTRAINT "AiModel_rollbackTargetId_fkey" FOREIGN KEY ("rollbackTargetId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkCase" ADD CONSTRAINT "BenchmarkCase_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_suiteRunId_fkey" FOREIGN KEY ("suiteRunId") REFERENCES "BenchmarkSuiteRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_embeddingModelId_fkey" FOREIGN KEY ("embeddingModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_indexVersionId_fkey" FOREIGN KEY ("indexVersionId") REFERENCES "CatalogueIndexVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_previousRunId_fkey" FOREIGN KEY ("previousRunId") REFERENCES "BenchmarkRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExperiment" ADD CONSTRAINT "PromptExperiment_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExperiment" ADD CONSTRAINT "PromptExperiment_winnerArmId_fkey" FOREIGN KEY ("winnerArmId") REFERENCES "PromptExperimentArm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExperimentArm" ADD CONSTRAINT "PromptExperimentArm_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "PromptExperiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExperimentArm" ADD CONSTRAINT "PromptExperimentArm_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptExperimentArm" ADD CONSTRAINT "PromptExperimentArm_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BenchmarkRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
