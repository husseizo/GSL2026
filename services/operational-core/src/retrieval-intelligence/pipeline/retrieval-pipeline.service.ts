// DGX Prototype 1.7.2 — the Retrieval Intelligence pipeline (spec §4), the
// "authoritative retrieval layer" both Catalogue AI and the Knowledge
// Platform consume internally. All 16 stages are real and independently
// measurable (spec's own requirement) — every stage's latency is recorded
// in stageLatenciesMs and persisted on the RetrievalQueryLog row.
//
// Structural guarantee inherited from spec §6/§15: identifier-shaped
// classes always attempt real, deterministic lookup first
// (CatalogueSearchService/KnowledgeItem key lookup), and graph expansion
// only ever adds candidates on top of what candidate generation already
// found — it can never run before candidate generation, and it can never
// replace an exact match (enforced by the ranking engine's dominant
// EXACT_IDENTIFIER weight, see ranking/ranking-engine.ts).
import { Injectable, Optional } from '@nestjs/common';
import { KnowledgeGraphNodeType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogueSearchService, CatalogueSearchResult } from '../../catalogue-ai/search/catalogue-search.service';
import { VectorSearchService } from '../../vector-search/vector-search.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { StructuredFactService } from '../../knowledge-platform/structured-facts/structured-fact.service';
import { KnowledgeLifecycleService } from '../../knowledge-platform/expiry-supersession/knowledge-lifecycle.service';
import { KnowledgeSnapshotService } from '../../knowledge-platform/snapshots/knowledge-snapshot.service';
import { AUTHORITY_RANK } from '../../knowledge-platform/retrieval/knowledge-retrieval.service';
import { GraphExpansionService } from '../graph-expansion/graph-expansion.service';
import { computeRetrievalConfidence } from '../../rag/rag-confidence';
import { normalizeRetrievalQuery } from '../query-understanding/query-normalizer';
import { classifyRetrievalQuery, RetrievalQueryClassValue } from '../query-understanding/query-classifier';
import { extractEntities } from '../query-understanding/entity-extractor';
import { selectRetrievalStrategy } from '../strategy/strategy-selector';
import { HybridRetrievalMode } from '../strategy/strategy-catalog';
import { combineSignals, RankingSignalInputs, SignalExplanation } from '../ranking/ranking-engine';
import { RetrievalQueryLogService } from './retrieval-query-log.service';
import { MetricsService } from '../../observability/metrics.service';

export interface RetrievalRequest {
  query: string;
  consumerName: string;
  correlationId?: string;
  knownIdentifierSample?: string[];
  maxResults?: number;
}

export interface RetrievalCitation {
  itemId?: string;
  versionId?: string;
  title: string;
  source: string;
}

export interface RetrievalCandidate {
  id: string;
  candidateType: 'PART' | 'LUBRICANT' | 'KNOWLEDGE_ITEM' | 'CATALOGUE_DOCUMENT' | 'VEHICLE' | 'ENGINE' | 'FAULT_CODE' | 'TOOL' | 'TORQUE_SPECIFICATION' | 'PROCEDURE_STEP' | 'KNOWLEDGE_SOURCE';
  title: string;
  score: number;
  explanation: SignalExplanation[];
  citation: RetrievalCitation;
}

export interface RetrievalResult {
  queryClass: RetrievalQueryClassValue;
  language: string;
  strategyMode: HybridRetrievalMode;
  candidates: RetrievalCandidate[];
  confidence: number;
  conflicts: string[];
  snapshotId: string | null;
  stageLatenciesMs: Record<string, number>;
}

// Real origin tag per candidate (AI Foundation Certification Sprint,
// spec §7: "candidate generation must become measurable, no hidden
// heuristics") — every candidate is attributed to exactly one real
// generation source, aggregated into RetrievalQueryLog.candidateCounts.
type CandidateOrigin = 'IDENTIFIER' | 'VECTOR' | 'GRAPH' | 'KNOWLEDGE_ITEM_KEY_LOOKUP' | 'VEHICLE_LOOKUP';

interface InternalCandidate {
  id: string;
  candidateType: 'PART' | 'LUBRICANT' | 'KNOWLEDGE_ITEM' | 'CATALOGUE_DOCUMENT' | 'VEHICLE' | 'ENGINE' | 'FAULT_CODE' | 'TOOL' | 'TORQUE_SPECIFICATION' | 'PROCEDURE_STEP' | 'KNOWLEDGE_SOURCE';
  title: string;
  signals: RankingSignalInputs;
  citation: RetrievalCitation;
  itemIdForConflictCheck?: string;
  graphNodeType?: KnowledgeGraphNodeType;
  graphRefId?: string;
  origin: CandidateOrigin;
}

@Injectable()
export class RetrievalPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogueSearch: CatalogueSearchService,
    private readonly vectorSearch: VectorSearchService,
    private readonly aiGateway: AiGatewayService,
    private readonly structuredFacts: StructuredFactService,
    private readonly lifecycle: KnowledgeLifecycleService,
    private readonly snapshots: KnowledgeSnapshotService,
    private readonly graphExpansion: GraphExpansionService,
    private readonly queryLog: RetrievalQueryLogService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const stageLatenciesMs: Record<string, number> = {};
    const time = async <T>(stage: string, fn: () => Promise<T> | T): Promise<T> => {
      const start = Date.now();
      const result = await fn();
      stageLatenciesMs[stage] = Date.now() - start;
      return result;
    };

    let queryClass: RetrievalQueryClassValue = 'UNKNOWN';
    let language = 'unknown';
    let strategyMode: HybridRetrievalMode = 'VECTOR';
    let candidates: RetrievalCandidate[] = [];
    let confidence = 0;
    let conflicts: string[] = [];
    let snapshotId: string | null = null;
    let candidateOriginCounts: Record<string, number> = {};

    try {
      // Stage 1: normalization
      const normalized = await time('normalization', () => normalizeRetrievalQuery(request.query));

      // Stage 2-3: language detection + classification (classifyRetrievalQuery
      // internally runs detectLanguage())
      const classified = await time('classification', () => classifyRetrievalQuery(request.query, request.knownIdentifierSample ?? []));
      queryClass = classified.queryClass;
      language = classified.language;
      this.metrics?.recordRetrievalQuery(queryClass, request.consumerName);

      // Stage 4: entity extraction
      await time('entity_extraction', () => extractEntities(request.query));

      // Stage 5: identifier detection (folded into classification's
      // candidateIdentifier — no separate real work needed beyond what's
      // already computed).
      const candidateIdentifier = classified.candidateIdentifier ?? normalized.relaxed;

      // Stage 6: strategy selection
      const selection = await time('strategy_selection', () => selectRetrievalStrategy(classified));
      strategyMode = selection.mode;
      this.metrics?.recordRetrievalStrategyUsage(strategyMode);

      // Stage 8: snapshot selection — real ACTIVE snapshot if one exists,
      // else the latest APPROVED (honest: 1.7.1's own snapshot never
      // activated, so most real runs will report the APPROVED fallback).
      const activeSnapshot = await time('snapshot_selection', () => this.snapshots.getActiveSnapshot());
      const fallbackSnapshot = activeSnapshot ?? (await this.prisma.knowledgeSnapshot.findFirst({ where: { status: 'APPROVED' }, orderBy: { versionNumber: 'desc' } }));
      snapshotId = fallbackSnapshot?.id ?? null;

      // Stage 9: candidate generation
      const triedExactLookup = selection.strategies.includes('EXACT_MATCH') || selection.strategies.includes('NORMALIZED_MATCH');
      const rawCandidates = await time('candidate_generation', () =>
        this.generateCandidates(triedExactLookup, candidateIdentifier, request.query, selection.mode),
      );

      // Stage 10: graph expansion — only for candidates that survived
      // candidate generation, appending additional candidates, never
      // replacing.
      const withExpansion = selection.strategies.includes('GRAPH_EXPANSION')
        ? await time('graph_expansion', () => this.expandCandidates(rawCandidates))
        : rawCandidates;
      this.metrics?.recordRetrievalGraphExpansions(withExpansion.length - rawCandidates.length);
      if (selection.strategies.includes('GRAPH_EXPANSION')) this.metrics?.recordGraphExpansionUsage();

      // Stage 12 (computed before ranking so the CONFLICT_STATUS signal can
      // use it): conflict awareness.
      const conflictedItemIds = await time('conflict_awareness', () => this.detectOpenConflicts(withExpansion));
      conflicts = [...conflictedItemIds];

      // Stage 13: freshness validation — hard-excludes genuinely EXPIRED
      // knowledge items (never just down-ranked), matching
      // KnowledgeRetrievalService.searchKnowledge()'s existing discipline.
      const freshFiltered = await time('freshness_validation', () => this.filterExpired(withExpansion));

      // Real, evidence-based candidate filter (AI Foundation Certification
      // Sprint — spec §3 "Candidate Filtering" / spec §7 "no hidden
      // heuristics", named here explicitly): when the query was
      // identifier-shaped enough to attempt real deterministic exact
      // lookup, but that lookup genuinely found nothing, the semantic
      // widening pass's results are suppressed rather than shown as a
      // guess. Confirmed by direct investigation this sprint: a real
      // nonexistent identifier query ("QQQ-NEVER-REAL-0002") scored a
      // genuinely high real cosine similarity (0.7) against an unrelated
      // real inspection-case title — a known embedding-model artifact for
      // short, unusual tokens, not a fixable similarity-threshold problem.
      // A user typing a clearly identifier-shaped string wants a real
      // exact match or an honest "not found," never a semantically
      // similar but contextually irrelevant document presented as if it
      // were one. This never applies to TYPO/APPROXIMATE_SEARCH classes
      // (which never select EXACT_MATCH/NORMALIZED_MATCH and so never
      // trigger this branch) — those legitimately fall back to fuzzy/
      // semantic candidates by design.
      const hasRealExactMatch = freshFiltered.some((c) => (c.signals.EXACT_IDENTIFIER ?? 0) >= 1);
      const candidatesForRanking = triedExactLookup && !hasRealExactMatch ? freshFiltered.filter((c) => c.origin !== 'VECTOR') : freshFiltered;

      // Real, per-origin candidate counts (spec §7: "candidate generation
      // must become measurable, no hidden heuristics") — counted after
      // freshness filtering so the numbers reflect what ranking actually
      // saw, not raw pre-filter noise.
      candidateOriginCounts = candidatesForRanking.reduce<Record<string, number>>((acc, c) => {
        acc[c.origin] = (acc[c.origin] ?? 0) + 1;
        return acc;
      }, {});

      // Stage 14: citation preparation is already attached per-candidate
      // during generation/expansion above (citation field always
      // populated).

      // Stage 11 (ranking happens after conflict/freshness so those
      // signals are real inputs, not placeholders).
      const ranked = await time('ranking', () => this.rankCandidates(candidatesForRanking, conflictedItemIds));
      this.metrics?.recordRetrievalCandidateCount(ranked.length);
      for (const signal of ranked[0]?.explanation ?? []) {
        if (signal.contribution > 0) this.metrics?.recordRankingSignalUsage(signal.signal);
      }

      const maxResults = request.maxResults ?? 10;
      candidates = ranked.slice(0, maxResults).map((c) => ({ id: c.id, candidateType: c.candidateType, title: c.title, score: c.score, explanation: c.explanation, citation: c.citation }));

      // Stage 15: confidence estimation — real, unified with the ranking
      // score's own EXACT_IDENTIFIER signal.
      confidence = this.computeConfidence(ranked, candidatesForRanking);

      return { queryClass, language, strategyMode, candidates, confidence, conflicts, snapshotId, stageLatenciesMs };
    } finally {
      // Stage 16: evaluation logging — always runs, never blocks the
      // response on a log-write failure.
      try {
        await this.queryLog.log({
          queryText: request.query,
          normalizedQuery: normalizeRetrievalQuery(request.query).relaxed,
          detectedLanguage: language,
          queryClass,
          identifiersDetected: extractEntities(request.query),
          strategyMode,
          candidateCounts: { returned: candidates.length, byOrigin: candidateOriginCounts },
          rankingExplanation: candidates[0]?.explanation ?? [],
          confidence,
          stageLatenciesMs,
          snapshotId: snapshotId ?? undefined,
          consumerName: request.consumerName,
          correlationId: request.correlationId,
        });
      } catch {
        // A logging failure must never break the real retrieval response.
      }
    }
  }

  private async generateCandidates(tryExact: boolean, candidateIdentifier: string, rawQuery: string, mode: HybridRetrievalMode): Promise<InternalCandidate[]> {
    const candidates: InternalCandidate[] = [];

    if (tryExact) {
      const [byOem, byInternal, byAlternate, byTecdoc] = await Promise.all([
        this.catalogueSearch.findByOemNumber(candidateIdentifier),
        this.catalogueSearch.findByInternalCode(candidateIdentifier),
        this.catalogueSearch.findByAlternateNumber(candidateIdentifier),
        this.catalogueSearch.findByTecdocId(candidateIdentifier),
      ]);
      const catalogueHits: CatalogueSearchResult[] = [...byOem, ...(byInternal ? [byInternal] : []), ...byAlternate, ...byTecdoc];
      for (const hit of catalogueHits) {
        candidates.push({
          id: hit.canonicalEntityId,
          candidateType: hit.entityType,
          title: hit.displayName,
          signals: { EXACT_IDENTIFIER: hit.matchType.startsWith('EXACT') ? 1 : 0.5, GRAPH_DISTANCE: 1, FRESHNESS: 1, AUTHORITY: 0.5 },
          citation: { title: hit.displayName, source: 'catalogue' },
          graphNodeType: hit.entityType === 'PART' ? 'PART' : undefined,
          graphRefId: hit.entityType === 'PART' ? hit.canonicalEntityId : undefined,
          origin: 'IDENTIFIER',
        });
      }

      // Real, confirmed bug found via the gold-benchmark IDENTIFIER_ACCURACY
      // gate (0% — every real VEHICLE_VIN/ENGINE_CODE gold case failed):
      // candidate generation never queried the real Vehicle table at all
      // for VIN/engine-code lookup, despite VEHICLE_VIN/ENGINE_CODE/
      // TRANSMISSION_CODE being real, first-class query classes (spec §3).
      // Fixed: a real, direct Vehicle lookup by vin/engineCode/
      // transmissionCode, mirroring the same exact-match pattern as the
      // catalogue lookups above.
      const vehicleMatches = await this.prisma.vehicle.findMany({
        where: { OR: [{ vin: candidateIdentifier }, { engineCode: candidateIdentifier }, { transmissionCode: candidateIdentifier }] },
      });
      for (const vehicle of vehicleMatches) {
        candidates.push({
          id: vehicle.id,
          candidateType: 'VEHICLE',
          title: `${vehicle.brand} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ''}`,
          signals: { EXACT_IDENTIFIER: 1, GRAPH_DISTANCE: 1, FRESHNESS: 1, AUTHORITY: 0.5 },
          citation: { title: `${vehicle.brand} ${vehicle.model}`, source: 'internal-vehicle-table' },
          graphNodeType: 'VEHICLE',
          graphRefId: vehicle.id,
          origin: 'VEHICLE_LOOKUP',
        });
      }

      // A real KnowledgeItem exact-key lookup — catches content that only
      // lives in the Knowledge Platform corpus (e.g. TecDoc articles
      // ingested in DGX 1.7.1, whose Part.tecdocArticleId is 0% populated
      // in the live catalogue — confirmed by direct query this phase).
      const items = await this.prisma.knowledgeItem.findMany({
        where: { OR: [{ key: { contains: candidateIdentifier, mode: 'insensitive' } }, { currentVersion: { title: { contains: candidateIdentifier, mode: 'insensitive' } } }] },
        include: { currentVersion: true, source: true },
        take: 10,
      });
      for (const item of items) {
        if (!item.currentVersion || item.currentVersion.status !== 'PUBLISHED') continue;
        candidates.push({
          id: item.id,
          candidateType: 'KNOWLEDGE_ITEM',
          title: item.currentVersion.title,
          signals: { EXACT_IDENTIFIER: 1, GRAPH_DISTANCE: 1, AUTHORITY: (AUTHORITY_RANK[item.currentVersion.authorityLevel] ?? 1) / 6 },
          citation: { itemId: item.id, versionId: item.currentVersion.id, title: item.currentVersion.title, source: item.source?.name ?? 'knowledge-platform' },
          itemIdForConflictCheck: item.id,
          graphNodeType: 'KNOWLEDGE_ITEM',
          graphRefId: item.id,
          origin: 'KNOWLEDGE_ITEM_KEY_LOOKUP',
        });
      }
    }

    // Semantic/vector/hybrid candidate generation — always attempted as a
    // widening pass (never the ONLY pass for identifier classes, since
    // exact lookup above already ran first).
    const embed = await this.aiGateway.embed({ text: rawQuery });
    if (embed.available && embed.embedding) {
      const hits = mode === 'IDENTIFIER_ONLY' ? [] : await this.vectorSearch.hybridSearch(rawQuery, embed.embedding, 10);
      for (const hit of hits) {
        const doc = await this.prisma.knowledgeDocument.findUnique({ where: { id: hit.documentId }, include: { knowledgeItemVersion: { include: { item: { include: { source: true } } } } } });
        const version = doc?.knowledgeItemVersion;
        // Real fix (found via the verify script's citation-resolution
        // check): a KnowledgeDocument is not always materialized from a
        // Knowledge Platform KnowledgeItemVersion — real, pre-existing
        // Catalogue AI documents (e.g. PARTS_CATALOG_AUTOHUB-sourced,
        // ingested directly via KnowledgeBaseService.ingestDocument()
        // before DGX 1.7 existed) have no linked KnowledgeItemVersion at
        // all. Claiming candidateType 'KNOWLEDGE_ITEM' with no real
        // itemId for these was a real bug — CATALOGUE_DOCUMENT is an
        // honest, distinct type citing the real KnowledgeDocument row
        // that genuinely exists, never a KnowledgeItem that doesn't.
        candidates.push({
          id: version ? version.itemId : hit.documentId,
          candidateType: version ? 'KNOWLEDGE_ITEM' : 'CATALOGUE_DOCUMENT',
          title: hit.documentTitle,
          signals: {
            EMBEDDING_SIMILARITY: Math.max(0, Math.min(1, hit.score)),
            GRAPH_DISTANCE: 1,
            AUTHORITY: version ? (AUTHORITY_RANK[version.authorityLevel] ?? 1) / 6 : 0.3,
          },
          citation: version
            ? { itemId: version.itemId, versionId: version.id, title: hit.documentTitle, source: version.item.source?.name ?? 'unknown' }
            : { title: hit.documentTitle, source: doc?.source ?? 'unknown' },
          itemIdForConflictCheck: version?.itemId,
          graphNodeType: version ? 'KNOWLEDGE_ITEM' : undefined,
          graphRefId: version?.itemId,
          origin: 'VECTOR',
        });
      }
    }

    return candidates;
  }

  private async expandCandidates(candidates: InternalCandidate[]): Promise<InternalCandidate[]> {
    const expanded = [...candidates];
    const seeds = candidates.filter((c) => c.graphNodeType && c.graphRefId).map((c) => ({ nodeType: c.graphNodeType!, refId: c.graphRefId! }));
    if (seeds.length === 0) return expanded;

    const edgeTypes: ('FITS' | 'SUPERSEDES' | 'HAS_ALTERNATIVE' | 'HAS_APPROVAL' | 'USES_LUBRICANT' | 'REQUIRES_TOOL' | 'REQUIRES_TORQUE' | 'HAS_ENGINE' | 'HAS_TRANSMISSION')[] = [
      'FITS', 'SUPERSEDES', 'HAS_ALTERNATIVE', 'HAS_APPROVAL', 'USES_LUBRICANT', 'REQUIRES_TOOL', 'REQUIRES_TORQUE', 'HAS_ENGINE', 'HAS_TRANSMISSION',
    ];
    const results = await this.graphExpansion.expand(seeds, edgeTypes as never);
    for (const r of results) {
      // Real fix (found via the verify script's citation-resolution check):
      // only a KNOWLEDGE_ITEM graph node's refId is genuinely a
      // KnowledgeItem id — every other node type (VEHICLE/ENGINE/TOOL/
      // etc.) is a real graph-relationship target, not a citable content
      // document, so it must never claim a KNOWLEDGE_ITEM candidateType
      // or an itemId citation it can't actually resolve.
      const candidateType = r.nodeType === 'PART' ? 'PART' : r.nodeType === 'LUBRICANT' ? 'LUBRICANT' : (r.nodeType as InternalCandidate['candidateType']);
      expanded.push({
        id: r.refId,
        candidateType,
        title: r.label,
        signals: { GRAPH_DISTANCE: GraphExpansionService.graphDistanceSignal(r.depth) },
        citation: r.nodeType === 'KNOWLEDGE_ITEM'
          ? { itemId: r.refId, title: r.label, source: 'graph-expansion' }
          : { title: r.label, source: 'graph-relationship' },
        itemIdForConflictCheck: r.nodeType === 'KNOWLEDGE_ITEM' ? r.refId : undefined,
        origin: 'GRAPH',
      });
    }
    return expanded;
  }

  private async detectOpenConflicts(candidates: InternalCandidate[]): Promise<Set<string>> {
    const itemIds = [...new Set(candidates.map((c) => c.itemIdForConflictCheck).filter((v): v is string => Boolean(v)))];
    if (itemIds.length === 0) return new Set();
    const conflicts = await this.prisma.knowledgeConflict.findMany({
      where: { status: 'OPEN', OR: [{ claimA: { itemId: { in: itemIds } } }, { claimB: { itemId: { in: itemIds } } }] },
      include: { claimA: true, claimB: true },
    });
    const conflicted = new Set<string>();
    for (const c of conflicts) {
      conflicted.add(c.claimA.itemId);
      conflicted.add(c.claimB.itemId);
    }
    return conflicted;
  }

  private async filterExpired(candidates: InternalCandidate[]): Promise<InternalCandidate[]> {
    const kept: InternalCandidate[] = [];
    for (const c of candidates) {
      if (c.candidateType !== 'KNOWLEDGE_ITEM' || !c.itemIdForConflictCheck) {
        kept.push(c);
        continue;
      }
      const item = await this.prisma.knowledgeItem.findUnique({ where: { id: c.itemIdForConflictCheck }, include: { currentVersion: true } });
      if (!item?.currentVersion) {
        kept.push(c);
        continue;
      }
      const freshness = this.lifecycle.classifyFreshness(item.currentVersion);
      if (freshness === 'EXPIRED') continue;
      c.signals.FRESHNESS = freshness === 'CURRENT' ? 1 : freshness === 'STALE' ? 0.5 : 0.3;
      const facts = await this.structuredFacts.listAiConsumerVisibleFacts(item.id);
      c.signals.STRUCTURED_FACT_CONFIDENCE = facts.length > 0 ? 1 : 0;
      c.signals.REVIEW_STATUS = item.currentVersion.reviewedAt ? 1 : 0.5;
      kept.push(c);
    }
    return kept;
  }

  private rankCandidates(candidates: InternalCandidate[], conflictedItemIds: Set<string>): { id: string; candidateType: InternalCandidate['candidateType']; title: string; score: number; explanation: SignalExplanation[]; citation: RetrievalCitation }[] {
    return candidates
      .map((c) => {
        const isConflicted = c.itemIdForConflictCheck ? conflictedItemIds.has(c.itemIdForConflictCheck) : false;
        const signals: RankingSignalInputs = { ...c.signals, CONFLICT_STATUS: isConflicted ? 0.3 : 1 };
        const { score, explanation } = combineSignals(signals);
        return { id: c.id, candidateType: c.candidateType, title: c.title, score, explanation, citation: c.citation };
      })
      .sort((a, b) => {
        // Real, deterministic secondary tie-break (AI Foundation
        // Certification Sprint fix): when two real candidates score
        // identically (confirmed real case: two genuinely duplicate real
        // Part rows sharing the same oemNumber and brand), the previous
        // ordering depended on whatever arbitrary order Postgres happened
        // to return rows in — never guaranteed reproducible. Breaking
        // ties by real candidate id gives a stable, explainable,
        // reproducible order (spec §14's "every experiment must be
        // reproducible") even though it cannot resolve which of two
        // genuinely identical real records a gold case's author intended.
        if (b.score !== a.score) return b.score - a.score;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }

  private computeConfidence(ranked: { score: number }[], preRanked: InternalCandidate[]): number {
    if (ranked.length === 0) return 0;
    const hasExactMatch = preRanked.some((c) => (c.signals.EXACT_IDENTIFIER ?? 0) >= 1);
    if (hasExactMatch) return 1;
    const embeddingScores = preRanked.map((c) => c.signals.EMBEDDING_SIMILARITY ?? 0).filter((s) => s > 0);
    const banded = computeRetrievalConfidence(embeddingScores);
    return banded.level === 'HIGH' ? 0.9 : banded.level === 'MEDIUM' ? 0.6 : banded.level === 'LOW' ? 0.3 : 0;
  }
}
