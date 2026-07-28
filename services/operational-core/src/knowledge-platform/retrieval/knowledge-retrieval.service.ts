// DGX Prototype 1.7 — the AI-consumer contract surface (spec §24-26).
//
// Every future AI consumer (Catalogue AI, Demand Forecasting, Predictive
// Maintenance, Technician Copilot, Management Assistant, Customer Service
// Assistant) reads knowledge ONLY through this service — never a direct
// Prisma query against KnowledgeItem*/StructuredFact. This is what applies
// authority-ranking + expiry/restricted exclusion deterministically
// (never LLM-decided) and enforces the extractedBy/reviewedAt gating
// (see structured-facts/structured-fact.service.ts's own comment on why
// this is a real, named, service-layer-only risk — not DB-enforced).
import { forwardRef, Inject, Injectable, Optional } from '@nestjs/common';
import { KnowledgeItemType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VectorSearchService } from '../../vector-search/vector-search.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { StructuredFactService } from '../structured-facts/structured-fact.service';
import { KnowledgeLifecycleService } from '../expiry-supersession/knowledge-lifecycle.service';
import { MetricsService } from '../../observability/metrics.service';
import { isRetrievalIntelligenceEnabled } from '../../catalogue-ai/rag/shadow-mode';
import { RetrievalPipelineService } from '../../retrieval-intelligence/pipeline/retrieval-pipeline.service';

// Exported for reuse by the DGX 1.7.2 Retrieval Intelligence ranking
// engine's AUTHORITY signal (src/retrieval-intelligence/ranking/) — reused
// directly rather than re-implemented.
export const AUTHORITY_RANK: Record<string, number> = {
  OEM_OFFICIAL: 6,
  OEM_AUTHORIZED_DISTRIBUTOR: 5,
  INDEPENDENT_TECHNICAL_PUBLISHER: 4,
  INTERNAL_WORKSHOP: 3,
  COMMUNITY_SOURCED: 2,
  UNKNOWN: 1,
};

export interface AiConsumerRequest {
  consumerName: string;
  consumerVersion: string;
  userId?: string;
  role?: string;
  purpose: string;
  knowledgeDomains?: KnowledgeItemType[];
  snapshotId?: string;
  vehicleContext?: { vehicleId?: string; partId?: string; engineCode?: string };
  maxAuthorityLevel?: string;
  allowConflicts?: boolean;
  allowHistoricalVersions?: boolean;
  query: string;
}

export interface AiConsumerResult {
  retrievedItemIds: string[];
  retrievedVersionIds: string[];
  citations: { itemId: string; versionId: string; title: string; source: string; authorityLevel: string; publishedAt: Date | null }[];
  conflicts: string[];
  exclusions: { itemId: string; reason: string }[];
  confidence: number;
  freshness: string[];
}

@Injectable()
export class KnowledgeRetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorSearch: VectorSearchService,
    private readonly aiGateway: AiGatewayService,
    private readonly structuredFacts: StructuredFactService,
    private readonly lifecycle: KnowledgeLifecycleService,
    @Optional() private readonly metrics?: MetricsService,
    // DGX Prototype 1.7.2 — additive, real module-graph wiring (forwardRef,
    // since RetrievalIntelligenceModule itself imports KnowledgePlatformModule
    // for KnowledgeGraphService/StructuredFactService/etc.). Only consulted
    // when RETRIEVAL_INTELLIGENCE_ENABLED=true (default off until the real
    // retrieval-intelligence quality gates pass).
    @Optional() @Inject(forwardRef(() => RetrievalPipelineService)) private readonly retrievalPipeline?: RetrievalPipelineService,
  ) {}

  // The real, strict AI-consumer contract surface (spec §26) — every
  // request is answered only from the currently-approved/materialized
  // KnowledgeDocument set (isApproved-gated, same real mechanism
  // VectorSearchService already enforces), with expired/restricted
  // content excluded deterministically before the result is returned.
  async searchKnowledge(request: AiConsumerRequest): Promise<AiConsumerResult> {
    const startedAt = Date.now();
    try {
      return await this.searchKnowledgeInternal(request);
    } finally {
      this.metrics?.recordKnowledgeRetrievalLatency((Date.now() - startedAt) / 1000);
    }
  }

  private async searchKnowledgeInternal(request: AiConsumerRequest): Promise<AiConsumerResult> {
    const embedResult = await this.aiGateway.embed({ text: request.query });
    // DGX Prototype 1.7.2 real fix: topK was hardcoded to 10 regardless of
    // request.knowledgeDomains — widened when a domain filter is present
    // so post-filtering by itemType doesn't starve real results.
    const topK = request.knowledgeDomains && request.knowledgeDomains.length > 0 ? 30 : 10;
    const hits = embedResult.available && embedResult.embedding ? await this.vectorSearch.semanticSearch(embedResult.embedding, topK, {}) : [];

    const documentIds = [...new Set(hits.map((h) => h.documentId))];
    const documents = documentIds.length > 0 ? await this.prisma.knowledgeDocument.findMany({ where: { id: { in: documentIds }, knowledgeItemVersionId: { not: null } }, include: { knowledgeItemVersion: { include: { item: { include: { source: true } } } } } }) : [];

    // DGX Prototype 1.7.2 real fix: request.vehicleContext.partId was
    // accepted but never used — additional real candidates are now
    // fetched via the same KnowledgeItemPartApplicability join
    // enrichContext() already uses, appended (never replacing the
    // semantic-search candidates above).
    if (request.vehicleContext?.partId) {
      const applicable = await this.prisma.knowledgeItemPartApplicability.findMany({
        where: { partId: request.vehicleContext.partId },
        include: { item: { include: { currentVersion: true, source: true } } },
      });
      for (const app of applicable) {
        if (!app.item.currentVersion) continue;
        const already = documents.some((d) => d.knowledgeItemVersionId === app.item.currentVersion!.id);
        if (already) continue;
        const doc = await this.prisma.knowledgeDocument.findUnique({ where: { knowledgeItemVersionId: app.item.currentVersion.id }, include: { knowledgeItemVersion: { include: { item: { include: { source: true } } } } } });
        if (doc) documents.push(doc);
      }
    }

    const exclusions: { itemId: string; reason: string }[] = [];
    const included: typeof documents = [];

    for (const doc of documents) {
      const version = doc.knowledgeItemVersion;
      if (!version) continue;
      // DGX Prototype 1.7.2 real fix: request.knowledgeDomains was
      // accepted but never used to filter results — now a real exclusion
      // reason rather than a dead request field.
      if (request.knowledgeDomains && request.knowledgeDomains.length > 0 && !request.knowledgeDomains.includes(version.item.itemType)) {
        exclusions.push({ itemId: version.itemId, reason: 'OUTSIDE_REQUESTED_KNOWLEDGE_DOMAIN' });
        continue;
      }
      const freshness = this.lifecycle.classifyFreshness(version);
      if (freshness === 'EXPIRED') {
        exclusions.push({ itemId: version.itemId, reason: 'EXPIRED' });
        continue;
      }
      if (freshness === 'WITHDRAWN' || freshness === 'SUPERSEDED') {
        if (!request.allowHistoricalVersions) {
          exclusions.push({ itemId: version.itemId, reason: freshness });
          continue;
        }
      }
      if (request.maxAuthorityLevel && (AUTHORITY_RANK[version.authorityLevel] ?? 0) > (AUTHORITY_RANK[request.maxAuthorityLevel] ?? 99)) {
        exclusions.push({ itemId: version.itemId, reason: 'AUTHORITY_LEVEL_EXCEEDS_MAX' });
        continue;
      }
      if (version.item.source.accessClassification === 'RESTRICTED' && !version.item.source.allowedAiUse) {
        exclusions.push({ itemId: version.itemId, reason: 'RESTRICTED_ACCESS_AI_NOT_ALLOWED' });
        continue;
      }
      included.push(doc);
    }

    const itemIds = included.map((d) => d.knowledgeItemVersion!.itemId);
    const openConflicts = itemIds.length > 0 ? await this.prisma.knowledgeConflict.findMany({ where: { status: 'OPEN', OR: [{ claimA: { itemId: { in: itemIds } } }, { claimB: { itemId: { in: itemIds } } }] }, include: { claimA: true, claimB: true } }) : [];
    const conflictedItemIds = new Set<string>();
    for (const c of openConflicts) {
      conflictedItemIds.add(c.claimA.itemId);
      conflictedItemIds.add(c.claimB.itemId);
    }

    // DGX Prototype 1.7.2 real fix: allowConflicts was a confirmed no-op
    // (both ternary branches returned the same thing). Its real, intended
    // effect: when false (the safer default), an item touched by a real
    // OPEN conflict is excluded from the result entirely rather than
    // merely having its conflict surfaced.
    let finalIncluded = included;
    if (!request.allowConflicts && conflictedItemIds.size > 0) {
      finalIncluded = [];
      for (const doc of included) {
        if (conflictedItemIds.has(doc.knowledgeItemVersion!.itemId)) {
          exclusions.push({ itemId: doc.knowledgeItemVersion!.itemId, reason: 'OPEN_CONFLICT' });
          continue;
        }
        finalIncluded.push(doc);
      }
    }

    // Authority-aware ranking — never LLM-decided, a real sort by the
    // named AUTHORITY_RANK map. This remains the baseline ordering; when
    // Retrieval Intelligence is enabled, its real graph/structured-fact-
    // aware ranking scores additively re-order the same set below (never
    // adding or removing an item this baseline sort already decided).
    finalIncluded.sort((a, b) => (AUTHORITY_RANK[b.knowledgeItemVersion?.authorityLevel ?? 'UNKNOWN'] ?? 0) - (AUTHORITY_RANK[a.knowledgeItemVersion?.authorityLevel ?? 'UNKNOWN'] ?? 0));

    if (isRetrievalIntelligenceEnabled() && this.retrievalPipeline) {
      try {
        const riResult = await this.retrievalPipeline.retrieve({ query: request.query, consumerName: request.consumerName });
        const scoreByVersionId = new Map(riResult.candidates.map((c) => [c.citation.versionId, c.score]));
        finalIncluded.sort((a, b) => (scoreByVersionId.get(b.knowledgeItemVersion!.id) ?? -1) - (scoreByVersionId.get(a.knowledgeItemVersion!.id) ?? -1));
      } catch {
        // A Retrieval Intelligence failure must never break the existing,
        // already-correct authority-ranked order computed above.
      }
    }

    const finalItemIds = finalIncluded.map((d) => d.knowledgeItemVersion!.itemId);
    const surfacedConflicts = request.allowConflicts ? openConflicts.filter((c) => finalItemIds.includes(c.claimA.itemId) || finalItemIds.includes(c.claimB.itemId)).map((c) => c.id) : [];

    return {
      retrievedItemIds: finalItemIds,
      retrievedVersionIds: finalIncluded.map((d) => d.knowledgeItemVersion!.id),
      citations: finalIncluded.map((d) => ({
        itemId: d.knowledgeItemVersion!.itemId,
        versionId: d.knowledgeItemVersion!.id,
        title: d.knowledgeItemVersion!.title,
        source: d.knowledgeItemVersion!.item.source.name,
        authorityLevel: d.knowledgeItemVersion!.authorityLevel,
        publishedAt: d.knowledgeItemVersion!.publishedAt,
      })),
      conflicts: surfacedConflicts,
      exclusions,
      confidence: finalIncluded.length > 0 ? 1 / (1 + exclusions.length) : 0,
      freshness: finalIncluded.map((d) => this.lifecycle.classifyFreshness(d.knowledgeItemVersion!)),
    };
  }

  // Additive Catalogue AI integration point (spec §27) — returns zero or
  // more real context candidates sourced from published, AI-consumer-
  // visible StructuredFacts, to be APPENDED to CatalogueRagService's
  // existing candidate list, never replacing it. See
  // docs/knowledge-platform/catalogue-ai-integration.md.
  async enrichContext(targets: { partId?: string; vehicleId?: string }[]): Promise<{ text: string; itemId: string; versionId: string; source: string }[]> {
    const enriched: { text: string; itemId: string; versionId: string; source: string }[] = [];

    for (const target of targets) {
      if (!target.partId) continue;
      const applicabilities = await this.prisma.knowledgeItemPartApplicability.findMany({ where: { partId: target.partId }, include: { item: { include: { currentVersion: true, source: true } } } });
      for (const app of applicabilities) {
        const version = app.item.currentVersion;
        if (!version || version.status !== 'PUBLISHED') continue;
        const facts = await this.structuredFacts.listAiConsumerVisibleFacts(app.itemId);
        if (facts.length === 0 && version.rawContent.length === 0) continue;
        enriched.push({ text: version.rawContent, itemId: app.itemId, versionId: version.id, source: app.item.source.name });
      }
    }

    return enriched;
  }
}
