import { Injectable } from '@nestjs/common';
import { EvaluationPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';

export interface RetrievalCase {
  query: string;
}
export interface RetrievalExpectation {
  expectedDocumentIds: string[];
}

// Spec §15/§17: "Evaluation Dataset. Offline Testing. A/B Model
// Comparison... Retrieval precision. Retrieval recall." Runs each case in a
// RETRIEVAL-purpose dataset through the real RagService (not a mock),
// scoring retrieved document IDs against a human-curated expected set. This
// is real offline evaluation against real retrieval behavior — forecast
// accuracy is deliberately NOT re-evaluated here since ForecastingService
// already backtests and records MAPE/RMSE/MAE/bias per ForecastRun; adding
// a second evaluation pipeline for the same numbers would be duplication.
// See docs/architecture/evaluation-framework.md.
@Injectable()
export class AiEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  createDataset(name: string, purpose: EvaluationPurpose) {
    return this.prisma.evaluationDataset.create({ data: { name, purpose } });
  }

  addCase(datasetId: string, input: RetrievalCase, expectedOutput: RetrievalExpectation) {
    return this.prisma.evaluationCase.create({
      data: { datasetId, input: input as unknown as object, expectedOutput: expectedOutput as unknown as object },
    });
  }

  async runRetrievalEvaluation(datasetId: string, modelId?: string) {
    const dataset = await this.prisma.evaluationDataset.findUniqueOrThrow({ where: { id: datasetId }, include: { cases: true } });
    const run = await this.prisma.evaluationRun.create({ data: { datasetId, modelId, startedAt: new Date() } });

    let sumPrecision = 0;
    let sumRecall = 0;

    for (const evaluationCase of dataset.cases) {
      const input = evaluationCase.input as unknown as RetrievalCase;
      const expected = evaluationCase.expectedOutput as unknown as RetrievalExpectation;

      const result = await this.rag.answer(input.query);
      const retrievedIds = result.sources.map((s) => s.documentId);
      const truePositives = retrievedIds.filter((id) => expected.expectedDocumentIds.includes(id)).length;

      const precision = retrievedIds.length > 0 ? truePositives / retrievedIds.length : expected.expectedDocumentIds.length === 0 ? 1 : 0;
      const recall = expected.expectedDocumentIds.length > 0 ? truePositives / expected.expectedDocumentIds.length : retrievedIds.length === 0 ? 1 : 0;

      sumPrecision += precision;
      sumRecall += recall;
    }

    const n = dataset.cases.length;
    const metrics = {
      casesEvaluated: n,
      avgPrecision: n > 0 ? Math.round((sumPrecision / n) * 10000) / 10000 : null,
      avgRecall: n > 0 ? Math.round((sumRecall / n) * 10000) / 10000 : null,
    };

    return this.prisma.evaluationRun.update({ where: { id: run.id }, data: { completedAt: new Date(), metrics } });
  }

  listRuns(datasetId?: string) {
    return this.prisma.evaluationRun.findMany({ where: { datasetId }, orderBy: { startedAt: 'desc' } });
  }

  listDatasets() {
    return this.prisma.evaluationDataset.findMany({ orderBy: { name: 'asc' } });
  }
}
