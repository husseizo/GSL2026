// DGX Prototype 1.7 — Structured Technical Facts (spec §10).
//
// One polymorphic table with a factType discriminator (see
// prisma/schema.prisma's StructuredFact model comment for the rationale
// against 14 separate tables). `extractedBy` is the real, structural
// mechanism enforcing "never rely on an LLM summary for torque/fluid/
// safety/fitment data" — any LLM_ASSISTED_FLAGGED_FOR_REVIEW row without a
// real reviewedAt is excluded by aiConsumerVisible() below, and callers in
// retrieval/knowledge-retrieval.service.ts must always filter through it.
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { StructuredFactType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { MetricsService } from '../../observability/metrics.service';

// DGX Prototype 1.7.1 — LOW_CONFIDENCE_OCR (spec §14): a structured fact
// extracted from OCR output below the confidence threshold behaves exactly
// like an unreviewed LLM-assisted fact — never auto-visible to AI
// consumers until a real human reviewedAt is set. High-risk fact types
// (torque/fluid/VIN/safety/lubricant-approval) must never be auto-approved
// from low-confidence OCR.
export type ExtractionMethod = 'MANUAL_ENTRY' | 'PARSER_DETERMINISTIC' | 'LLM_ASSISTED_FLAGGED_FOR_REVIEW' | 'LOW_CONFIDENCE_OCR';

export interface CreateFactInput {
  itemId: string;
  versionId?: string;
  sourceClaimId?: string;
  factType: StructuredFactType;
  value: Record<string, unknown>;
  unit?: string;
  conditions?: Record<string, unknown>;
  confidence?: number;
  extractedBy: ExtractionMethod;
  createdById?: string;
}

@Injectable()
export class StructuredFactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async createFact(input: CreateFactInput) {
    this.metrics?.recordKnowledgeStructuredFact(input.factType, input.extractedBy);
    const fact = await this.prisma.structuredFact.create({
      data: {
        itemId: input.itemId,
        versionId: input.versionId,
        sourceClaimId: input.sourceClaimId,
        factType: input.factType,
        value: input.value as object,
        unit: input.unit,
        conditions: input.conditions as object | undefined,
        confidence: input.confidence ?? 1.0,
        extractedBy: input.extractedBy,
      },
    });
    await this.audit.log({ action: 'STRUCTURED_FACT_CREATED', entityType: 'StructuredFact', entityId: fact.id, afterState: fact, actorId: input.createdById });
    return fact;
  }

  async review(factId: string, reviewerId: string, actorRole?: string) {
    const before = await this.prisma.structuredFact.findUnique({ where: { id: factId } });
    if (!before) throw new NotFoundException(`StructuredFact ${factId} not found`);
    const after = await this.prisma.structuredFact.update({ where: { id: factId }, data: { reviewedById: reviewerId, reviewedAt: new Date() } });
    await this.audit.log({ action: 'STRUCTURED_FACT_REVIEWED', entityType: 'StructuredFact', entityId: factId, beforeState: before, afterState: after, actorId: reviewerId, actorRole });
    return after;
  }

  listByItem(itemId: string, factType?: StructuredFactType) {
    return this.prisma.structuredFact.findMany({ where: { itemId, factType } });
  }

  // The real gate: an LLM-assisted fact without a real human review must
  // never reach an AI consumer. Deterministic-parser and manual-entry
  // facts are always visible (they never came from an LLM summary in the
  // first place).
  aiConsumerVisible<T extends { extractedBy: string; reviewedAt: Date | null }>(fact: T): boolean {
    if (fact.extractedBy !== 'LLM_ASSISTED_FLAGGED_FOR_REVIEW' && fact.extractedBy !== 'LOW_CONFIDENCE_OCR') return true;
    return fact.reviewedAt !== null;
  }

  async listAiConsumerVisibleFacts(itemId: string, factType?: StructuredFactType) {
    const facts = await this.listByItem(itemId, factType);
    return facts.filter((f) => this.aiConsumerVisible(f));
  }
}
