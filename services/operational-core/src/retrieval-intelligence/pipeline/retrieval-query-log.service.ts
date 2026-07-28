// DGX Prototype 1.7.2 — real, always-on evaluation logging (spec §4 stage
// 16, §18, §19). Every real pipeline run persists one row here — never a
// hidden metric (spec §18's explicit rule) and the backing store for
// failure analysis (spec §19) and the Query Lab (spec §13).
import { Injectable } from '@nestjs/common';
import { RetrievalFailureType, RetrievalQueryClass, RetrievalStrategyMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface RetrievalQueryLogEntry {
  queryText: string;
  normalizedQuery: string;
  detectedLanguage: string;
  queryClass: RetrievalQueryClass;
  identifiersDetected: unknown;
  strategyMode: RetrievalStrategyMode;
  candidateCounts: unknown;
  rankingExplanation: unknown;
  confidence: number;
  stageLatenciesMs: unknown;
  snapshotId?: string;
  consumerName: string;
  correlationId?: string;
  failureType?: RetrievalFailureType;
}

@Injectable()
export class RetrievalQueryLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: RetrievalQueryLogEntry) {
    return this.prisma.retrievalQueryLog.create({
      data: {
        queryText: entry.queryText,
        normalizedQuery: entry.normalizedQuery,
        detectedLanguage: entry.detectedLanguage,
        queryClass: entry.queryClass,
        identifiersDetected: entry.identifiersDetected as object,
        strategyMode: entry.strategyMode,
        candidateCounts: entry.candidateCounts as object,
        rankingExplanation: entry.rankingExplanation as object,
        confidence: entry.confidence,
        stageLatenciesMs: entry.stageLatenciesMs as object,
        snapshotId: entry.snapshotId,
        consumerName: entry.consumerName,
        correlationId: entry.correlationId,
        failureType: entry.failureType,
      },
    });
  }

  async listRecent(consumerName?: string, take = 50) {
    return this.prisma.retrievalQueryLog.findMany({ where: consumerName ? { consumerName } : undefined, orderBy: { createdAt: 'desc' }, take });
  }

  async listByQueryClass(queryClass: RetrievalQueryClass, take = 50) {
    return this.prisma.retrievalQueryLog.findMany({ where: { queryClass }, orderBy: { createdAt: 'desc' }, take });
  }
}
