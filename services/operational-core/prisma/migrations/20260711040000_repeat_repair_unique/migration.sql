-- CreateIndex
CREATE UNIQUE INDEX "RepeatRepairFlag_jobId_relatedJobId_matchReason_key" ON "RepeatRepairFlag"("jobId", "relatedJobId", "matchReason");
