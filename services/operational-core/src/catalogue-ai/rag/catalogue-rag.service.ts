import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RagService } from '../../rag/rag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { VectorSearchService } from '../../vector-search/vector-search.service';
import { PromptRegistryService } from '../../prompt-registry/prompt-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogueSearchService, CatalogueSearchResult } from '../search/catalogue-search.service';
import { computeCatalogueConfidence, CatalogueConfidenceLevel } from '../confidence-model';
import { computeRetrievalConfidence } from '../../rag/rag-confidence';
import { classifyQuery } from './query-understanding';
import { buildContext, ContextCandidate } from './context-builder';
import { verifyAndCleanClaims, VerifiedClaim } from './claim-verifier';
import { validateCitations } from './citation-validator';
import { MetricsService } from '../../observability/metrics.service';
import { ManualReviewService } from '../../data-consolidation/manual-review.service';
import { applyShadowModeLabel, isGenerationEnabled, isKnowledgePlatformIntegrationEnabled, isRetrievalIntelligenceEnabled, isShadowModeEnabled, requiresShadowModeReview } from './shadow-mode';
import { KnowledgeRetrievalService } from '../../knowledge-platform/retrieval/knowledge-retrieval.service';
import { RetrievalPipelineService } from '../../retrieval-intelligence/pipeline/retrieval-pipeline.service';

export interface EvidenceRef {
  documentId: string;
  title: string;
}

export interface CatalogueRagAnswer {
  directAnswer: string;
  matchingProducts: CatalogueSearchResult[];
  matchBasis: string;
  verifiedFitment: string[];
  alternatives: string[];
  conflictsOrWarnings: string[];
  sources: { sourceSystem: string; sourceRecordId: string; canonicalEntityId: string; lastVerifiedDate: string | null }[];
  confidence: CatalogueConfidenceLevel;
  recommendedNextAction: string;
  usedDeterministicLookup: boolean;
  usedGeneration: boolean;
  logId?: string;
  // Additive fields (DGX Prototype 1.5) — the fuller structured-answer
  // schema spec §15 asks for, layered on top of the original Prototype 1
  // contract rather than replacing it, so no existing caller breaks.
  verifiedFacts: EvidenceRef[];
  possibleMatches: EvidenceRef[];
  missingInformation: string[];
  claims: VerifiedClaim[];
  claimsRemovedCount: number;
}

const DEFAULT_RETRIEVAL_TOP_K = 8;
const DEFAULT_CONTEXT_SIZE = 5;

// The catalogue-specific RAG orchestrator. Deterministic lookup (never
// calls DGX) always runs first for anything that looks like an identifier
// query — the LLM is only ever used to summarize/explain results that were
// ALREADY found deterministically or via approved-knowledge-base retrieval,
// never to originate a fact. See docs/ai/rag-answer-contract.md.
//
// DGX Prototype 1.5: answerFromRag() no longer delegates to
// RagService.retrieveAndGenerate() as one opaque call — it reuses the same
// underlying primitives (AiGatewayService, VectorSearchService,
// PromptRegistryService) directly so this module can decompose retrieval
// into real, inspectable stages (grouped context, claim verification,
// citation validation) per docs/ai-tuning/retrieval-optimization.md and
// docs/ai-tuning/context-optimization.md. RagService itself is untouched
// and still serves every other assistant in this platform unchanged.
@Injectable()
export class CatalogueRagService {
  private readonly logger = new Logger(CatalogueRagService.name);

  constructor(
    private readonly ragService: RagService,
    private readonly catalogueSearch: CatalogueSearchService,
    private readonly aiGateway: AiGatewayService,
    private readonly vectorSearch: VectorSearchService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly manualReview: ManualReviewService,
    // DGX Prototype 1.7 — additive, @Optional() so every existing caller/
    // test that constructs this service without it is completely
    // unaffected. Only consulted when
    // KNOWLEDGE_PLATFORM_CATALOGUE_INTEGRATION_ENABLED=true (default off).
    // See docs/knowledge-platform/catalogue-ai-integration.md.
    @Optional() private readonly knowledgeRetrieval?: KnowledgeRetrievalService,
    // DGX Prototype 1.7.2 — additive, real module-graph wiring (forwardRef,
    // since RetrievalIntelligenceModule itself imports CatalogueAiModule
    // for CatalogueSearchService). Only consulted when
    // RETRIEVAL_INTELLIGENCE_ENABLED=true (default off until the real
    // retrieval-intelligence quality gates pass). See
    // docs/retrieval-intelligence/catalogue-ai-pilot.md.
    @Optional() @Inject(forwardRef(() => RetrievalPipelineService)) private readonly retrievalPipeline?: RetrievalPipelineService,
  ) {}

  async ask(query: string, actorId?: string, correlationId?: string, contextSize = DEFAULT_CONTEXT_SIZE): Promise<CatalogueRagAnswer> {
    const parsed = classifyQuery(query);
    this.logger.log(`Query routed as ${parsed.type}`);
    this.metrics.recordCatalogueQueryRoute(parsed.type);

    // Safety-relevant categories never reach embedding/generation at all —
    // a fixed, deterministic refusal, per spec §14/§29 ("the assistant must
    // remain evidence-bound" / never diagnose a vehicle fault).
    if (parsed.type === 'PROMPT_INJECTION') {
      this.metrics.recordCatalogueRefusal('prompt_injection');
      return this.refusalAnswer('This request cannot be processed — it asks the assistant to ignore its evidence-grounding rules. Please rephrase as a real catalogue question.');
    }
    if (parsed.type === 'UNSUPPORTED_DIAGNOSTIC') {
      this.metrics.recordCatalogueRefusal('unsupported_diagnostic');
      return this.refusalAnswer('This assistant only retrieves and explains catalogue records — it cannot diagnose a vehicle fault or confirm a repair will work. Please consult a technician for diagnosis.');
    }

    if ((parsed.type === 'IDENTIFIER' || parsed.type === 'VIN') && parsed.candidateIdentifier) {
      const deterministicResult = await this.answerFromDeterministicLookup(parsed.candidateIdentifier);
      if (deterministicResult) return deterministicResult;
      // Falls through to semantic RAG if deterministic lookup found nothing
      // for this candidate — the query might still be a real description
      // that merely happened to contain digits (e.g. "500ml bottle size").
      // Note: VIN-to-fitment resolution is not implemented in this phase —
      // a VIN candidate is only ever tried against part-identifier lookups,
      // which will correctly find nothing; see docs/ai-tuning/query-routing.md.
    }

    return this.answerFromRag(query, actorId, correlationId, contextSize);
  }

  private refusalAnswer(message: string): CatalogueRagAnswer {
    return {
      directAnswer: message,
      matchingProducts: [],
      matchBasis: 'Request blocked by query-routing safety rules before any retrieval or generation occurred.',
      verifiedFitment: [],
      alternatives: [],
      conflictsOrWarnings: [message],
      sources: [],
      confidence: 'INSUFFICIENT_EVIDENCE',
      recommendedNextAction: 'No action needed — the assistant declined a request outside its scope.',
      usedDeterministicLookup: false,
      usedGeneration: false,
      verifiedFacts: [],
      possibleMatches: [],
      missingInformation: [],
      claims: [],
      claimsRemovedCount: 0,
    };
  }

  private async answerFromDeterministicLookup(identifier: string): Promise<CatalogueRagAnswer | null> {
    const [byInternal, byOem, byAlternate, byTecdoc] = await Promise.all([
      this.catalogueSearch.findByInternalCode(identifier),
      this.catalogueSearch.findByOemNumber(identifier),
      this.catalogueSearch.findByAlternateNumber(identifier),
      this.catalogueSearch.findByTecdocId(identifier),
    ]);

    const allHits = [byInternal, ...byOem, ...byAlternate, ...byTecdoc].filter((h): h is CatalogueSearchResult => h !== null);
    if (allHits.length === 0) return null;

    const primary = allHits[0];
    const confidenceResult = computeCatalogueConfidence({
      matchType: primary.matchType,
      sourceCount: 1,
      hasConflict: primary.hasConflict,
      isVerified: true,
      manualReviewPending: primary.hasConflict,
    });

    const conflictsOrWarnings: string[] = [];
    if (primary.hasConflict) conflictsOrWarnings.push('This identifier is shared by source records with conflicting category/brand data — see the manual-review queue before relying on this match.');

    const supersessions = await this.catalogueSearch.findSupersessions(primary.canonicalEntityId);
    const verifiedFitment: string[] = [];
    const alternatives: string[] = [];
    for (const s of supersessions) {
      if (s.verified) alternatives.push(`${s.relationshipType}: ${s.relatedPartId}`);
    }

    return {
      directAnswer: `Found ${allHits.length} real catalogue match(es) for "${identifier}" via deterministic lookup (${primary.matchType}).`,
      matchingProducts: allHits,
      matchBasis: `Deterministic exact-identifier lookup (${primary.matchType}) — no semantic search or LLM generation was needed.`,
      verifiedFitment,
      alternatives,
      conflictsOrWarnings,
      sources: [{ sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordId: identifier, canonicalEntityId: primary.canonicalEntityId, lastVerifiedDate: null }],
      confidence: confidenceResult.level,
      recommendedNextAction: primary.hasConflict ? 'Route to manual review before confirming this identifier match to the customer.' : 'Safe to present as a confirmed catalogue match.',
      usedDeterministicLookup: true,
      usedGeneration: false,
      verifiedFacts: primary.hasConflict ? [] : [{ documentId: primary.canonicalEntityId, title: primary.displayName }],
      possibleMatches: [],
      missingInformation: [],
      claims: [],
      claimsRemovedCount: 0,
    };
  }

  // Real, evidence-first pipeline: retrieve -> fetch real evidence-quality
  // metadata per candidate -> group into labeled context sections -> ask
  // the LLM for a narrow, simple JSON answer -> verify+clean claims against
  // the real evidence text -> validate citations -> derive the rest of the
  // structured schema from the real retrieved data, not from the LLM.
  private async answerFromRag(query: string, actorId: string | undefined, correlationId: string | undefined, contextSize: number): Promise<CatalogueRagAnswer> {
    const insufficientEvidence = (reason: string): CatalogueRagAnswer => ({
      directAnswer: 'I do not have enough verified catalogue evidence to answer this confidently.',
      matchingProducts: [],
      matchBasis: reason,
      verifiedFitment: [],
      alternatives: [],
      conflictsOrWarnings: [reason],
      sources: [],
      confidence: 'INSUFFICIENT_EVIDENCE',
      recommendedNextAction: 'Route to manual review — retrieval evidence is weak or absent.',
      usedDeterministicLookup: false,
      usedGeneration: false,
      verifiedFacts: [],
      possibleMatches: [],
      missingInformation: [reason],
      claims: [],
      claimsRemovedCount: 0,
    });

    if (!isGenerationEnabled()) {
      return insufficientEvidence('Generation is currently disabled by operator kill switch (CATALOGUE_RAG_GENERATION_ENABLED=false) — deterministic search remains available.');
    }

    const embedResult = await this.aiGateway.embed({ text: query, actorId });
    if (!embedResult.available || !embedResult.embedding) {
      return insufficientEvidence('DGX embedding service unavailable');
    }

    const hits = await this.vectorSearch.semanticSearch(embedResult.embedding, DEFAULT_RETRIEVAL_TOP_K, { sourceTypes: ['PARTS_DOCUMENTATION', 'LUBRICANT_DOCUMENTATION'] });
    if (hits.length === 0) {
      return insufficientEvidence('No approved catalogue documents matched this query.');
    }

    // Real per-candidate evidence-quality metadata — this is the retrieval
    // stage RagService.retrieveAndGenerate() doesn't expose (it only
    // returns the final generated answer), fetched here so context can be
    // grouped by real verification/conflict status. See
    // docs/ai-tuning/retrieval-optimization.md.
    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { id: { in: hits.map((h) => h.documentId) } },
      select: { id: true, confidence: true, isApproved: true, partId: true },
    });
    const documentById = new Map(documents.map((d) => [d.id, d]));

    const conflictByPartId = new Map<string, boolean>();
    const candidates: ContextCandidate[] = [];
    for (const hit of hits) {
      const doc = documentById.get(hit.documentId);
      let hasConflict = false;
      if (doc?.partId) {
        if (!conflictByPartId.has(doc.partId)) {
          conflictByPartId.set(doc.partId, await this.catalogueSearch.checkRealConflict(doc.partId));
        }
        hasConflict = conflictByPartId.get(doc.partId) ?? false;
      }
      candidates.push({
        documentId: hit.documentId,
        documentTitle: hit.documentTitle,
        text: hit.text,
        score: hit.score,
        sourceType: hit.sourceType,
        confidence: doc?.confidence ?? 0.5,
        isApproved: doc?.isApproved ?? false,
        hasConflict,
      });
    }

    // DGX Prototype 1.7 — additive Knowledge Platform enrichment (spec
    // §27: "enhance, don't replace, exact product retrieval"). Appends
    // zero or more real context candidates sourced from approved,
    // AI-consumer-visible KnowledgeItem content (fitment facts, active
    // supersessions, applicable bulletins) for the real parts already
    // found via catalogue search — never reorders or replaces the
    // existing catalogue-search-derived candidates, and never touches
    // ask()'s deterministic-first routing above. A failure here must
    // never break the existing catalogue answer, so it's wrapped and
    // logged, not allowed to propagate.
    if (isKnowledgePlatformIntegrationEnabled() && this.knowledgeRetrieval) {
      try {
        const realPartIds = [...new Set(documents.map((d) => d.partId).filter((id): id is string => Boolean(id)))];
        const enriched = await this.knowledgeRetrieval.enrichContext(realPartIds.map((partId) => ({ partId })));
        for (const item of enriched) {
          candidates.push({
            documentId: item.versionId,
            documentTitle: item.source,
            text: item.text,
            score: 0.5,
            sourceType: 'PARTS_DOCUMENTATION',
            confidence: 1,
            isApproved: true,
            hasConflict: false,
          });
        }
      } catch (err) {
        this.logger.warn(`Knowledge Platform context enrichment failed, continuing with catalogue-only context: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // DGX Prototype 1.7.2 — additive Retrieval Intelligence re-ranking.
    // Never removes a candidate the existing catalogue/KP retrieval above
    // already found — only reorders using the new pipeline's real,
    // explainable ranking signals (identifier/authority/freshness/graph/
    // structured-fact aware) where it scored the same document. A failure
    // here must never break the existing catalogue answer.
    if (isRetrievalIntelligenceEnabled() && this.retrievalPipeline) {
      try {
        const riResult = await this.retrievalPipeline.retrieve({ query, consumerName: 'catalogue-ai-rag', correlationId });
        const scoreByDocId = new Map(riResult.candidates.map((c) => [c.citation.versionId ?? c.id, c.score]));
        candidates.sort((a, b) => (scoreByDocId.get(b.documentId) ?? -1) - (scoreByDocId.get(a.documentId) ?? -1));
      } catch (err) {
        this.logger.warn(`Retrieval Intelligence re-ranking failed, continuing with existing candidate order: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const built = buildContext(candidates, contextSize);

    await this.ragService.ensurePromptSeeded('CATALOGUE_RAG_STRUCTURED_ANSWER', {
      systemPrompt:
        'You are an automotive catalogue retrieval assistant. Answer ONLY from the evidence sections provided, which describe real spare-parts and lubricant catalogue records grouped by verification status. ' +
        'Never invent an OEM number, alternate number, supersession, fitment, or lubricant approval that is not explicitly present in the evidence. ' +
        'Never claim a part will repair a vehicle fault. Never claim vehicle compatibility from description similarity alone — only from evidence explicitly marked as verified fitment. ' +
        'Never treat "Candidate matches" or "Conflicting evidence" sections as confirmed facts. ' +
        'If the evidence is insufficient, say so explicitly rather than guessing. ' +
        'Respond with ONLY a JSON object of the exact shape {"answer": string, "citedDocumentIds": string[], "hasConflict": boolean, "missingInformation": string[]} and nothing else — no markdown, no commentary outside the JSON.',
      userPromptTemplate: 'Question: {{question}}\n\nEvidence:\n{{context}}\n\nRespond with only the JSON object described in your instructions.',
      temperature: 0,
    });

    const rendered = await this.promptRegistry.render('CATALOGUE_RAG_STRUCTURED_ANSWER', { question: query, context: built.renderedText });
    const generation = await this.aiGateway.generate({
      prompt: rendered.userPrompt,
      system: rendered.systemPrompt,
      temperature: rendered.temperature,
      maxTokens: rendered.maxTokens,
      promptVersionId: rendered.promptVersionId,
      actorId,
      correlationId,
      retrievedDocumentIds: built.includedDocumentIds,
      format: 'json',
    });

    if (!generation.available || !generation.text) {
      return insufficientEvidence('DGX generation service unavailable');
    }

    const parsedAnswer = parseStructuredAnswer(generation.text);
    if (!parsedAnswer) {
      this.logger.warn(`Structured-output parse failure for query "${query}" — falling back to deterministic insufficient-evidence response rather than returning unsafe free text.`);
      return { ...insufficientEvidence('Model output could not be parsed as a valid structured answer — returning a safe fallback rather than unverified free text.'), logId: generation.logId };
    }

    const evidenceTextForClaims = candidates.map((c) => c.text).join(' '); // claim verification checks against ALL retrieved text, not just included-in-context, so a claim citing an excluded-by-minimization-but-real chunk isn't wrongly flagged
    const claimResult = verifyAndCleanClaims(parsedAnswer.answer, evidenceTextForClaims);
    const citationCheck = validateCitations(parsedAnswer.citedDocumentIds, built.includedDocumentIds);

    const verifiedFacts: EvidenceRef[] = candidates.filter((c) => built.includedDocumentIds.includes(c.documentId) && c.isApproved && c.confidence >= 0.9 && !c.hasConflict).map((c) => ({ documentId: c.documentId, title: c.documentTitle }));
    const possibleMatches: EvidenceRef[] = candidates.filter((c) => built.includedDocumentIds.includes(c.documentId) && !(c.isApproved && c.confidence >= 0.9) && !c.hasConflict).map((c) => ({ documentId: c.documentId, title: c.documentTitle }));
    const conflictRefs = candidates.filter((c) => built.includedDocumentIds.includes(c.documentId) && c.hasConflict);

    const conflictsOrWarnings: string[] = [...parsedAnswer.missingInformation];
    if (parsedAnswer.hasConflict || conflictRefs.length > 0) conflictsOrWarnings.push('Conflicting source records were retrieved for this query — see conflict evidence, not presented as a confirmed match.');
    if (!citationCheck.correct) conflictsOrWarnings.push(`The model cited ${citationCheck.missingSourceIds.length} source(s) that were not actually retrieved — those citations were discarded.`);
    if (claimResult.removedCount > 0) conflictsOrWarnings.push(`${claimResult.removedCount} sentence(s) referencing identifiers not found in the retrieved evidence were removed from the answer.`);

    const answerText = claimResult.allRemoved
      ? 'I do not have enough verified catalogue evidence to answer this confidently — the model\'s original response referenced information not present in the retrieved evidence and was removed.'
      : claimResult.cleanedAnswer;

    // Real bug found by this phase's own integration test (DGX Prototype
    // 1.5): using a candidate's own approval/confidence metadata as the
    // primary confidence signal conflated "this is a verified catalogue
    // record" with "this retrieval is actually relevant to the query" —
    // cosine-similarity search always returns its best-available match even
    // for a wildly irrelevant query, so a small corpus's one verified
    // document could get classified VERIFIED_FITMENT regardless of real
    // relevance. Fixed by using Phase 4's computeRetrievalConfidence() on
    // the real raw retrieval scores as the primary signal (thresholds
    // calibrated against measured nomic-embed-text baseline noise — see
    // rag-confidence.ts) — document-level verification status can only
    // ever leave confidence unchanged or lower it, never raise it above
    // what real retrieval relevance supports.
    const retrievalConfidence = computeRetrievalConfidence(candidates.map((c) => c.score));
    let confidence: CatalogueConfidenceLevel;
    if (retrievalConfidence.level === 'NONE') confidence = 'INSUFFICIENT_EVIDENCE';
    else if (retrievalConfidence.level === 'LOW') confidence = 'LOW';
    else confidence = 'MEDIUM'; // MEDIUM/HIGH retrieval confidence both cap at MEDIUM catalogue confidence — semantic-only answers never reach VERIFIED/HIGH, reserved for exact/verified-relationship matches only.

    if (conflictRefs.length > 0) confidence = 'CONFLICTING';
    if (claimResult.removedCount > 0 && confidence !== 'CONFLICTING' && confidence !== 'INSUFFICIENT_EVIDENCE') confidence = 'LOW';
    if (claimResult.allRemoved) confidence = 'INSUFFICIENT_EVIDENCE';

    this.metrics.recordCatalogueClaimsRemoved(claimResult.removedCount);
    this.metrics.recordCatalogueConfidence(confidence);

    if (isShadowModeEnabled() && requiresShadowModeReview(confidence)) {
      await this.manualReview.enqueue({
        queueType: 'CATALOGUE_RAG_SHADOW_MODE_REVIEW',
        proposedAction: `Review low-confidence/conflicting shadow-mode AI explanation for query: "${query}"`,
        evidence: { query, confidence, claimsRemovedCount: claimResult.removedCount, conflictCount: conflictRefs.length },
        confidence: retrievalConfidence.topScore,
      });
    }

    return {
      directAnswer: isShadowModeEnabled() ? applyShadowModeLabel(answerText) : answerText,
      matchingProducts: [],
      matchBasis: `Semantic/keyword retrieval over ${built.includedDocumentIds.length} approved catalogue document(s), grouped into ${Object.entries(built.sectionCounts).filter(([, n]) => n > 0).length} evidence section(s).`,
      verifiedFitment: [],
      alternatives: possibleMatches.map((p) => `${p.documentId}: ${p.title}`),
      conflictsOrWarnings,
      sources: candidates.filter((c) => built.includedDocumentIds.includes(c.documentId)).map((c) => ({ sourceSystem: c.sourceType, sourceRecordId: c.documentId, canonicalEntityId: c.documentId, lastVerifiedDate: null })),
      confidence,
      recommendedNextAction: confidence === 'INSUFFICIENT_EVIDENCE' || confidence === 'LOW' ? 'Route to manual review — retrieval evidence is weak, absent, or required claim removal.' : 'Present as a possible match; confirm with a human before final commitment.',
      usedDeterministicLookup: false,
      usedGeneration: true,
      logId: generation.logId,
      verifiedFacts,
      possibleMatches,
      missingInformation: parsedAnswer.missingInformation,
      claims: claimResult.claims,
      claimsRemovedCount: claimResult.removedCount,
    };
  }
}

interface StructuredModelAnswer {
  answer: string;
  citedDocumentIds: string[];
  hasConflict: boolean;
  missingInformation: string[];
}

// Real, minimal repair: Ollama's format:"json" guarantees syntactically
// valid JSON but not schema conformance, so missing/wrong-typed fields are
// defaulted rather than thrown — a caller always gets a usable object or
// null (never a partially-parsed throw), per spec §15: "Reject or repair
// invalid output. If repair fails, return deterministic fallback."
function parseStructuredAnswer(rawText: string): StructuredModelAnswer | null {
  let obj: unknown;
  try {
    obj = JSON.parse(rawText);
  } catch {
    // Repair attempt: the model sometimes wraps JSON in markdown fences or
    // adds leading/trailing commentary despite instructions — extract the
    // first {...} block and retry once.
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      obj = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  if (typeof obj !== 'object' || obj === null) return null;
  const record = obj as Record<string, unknown>;
  if (typeof record.answer !== 'string' || record.answer.trim().length === 0) return null;

  return {
    answer: record.answer,
    citedDocumentIds: Array.isArray(record.citedDocumentIds) ? record.citedDocumentIds.filter((x): x is string => typeof x === 'string') : [],
    hasConflict: typeof record.hasConflict === 'boolean' ? record.hasConflict : false,
    missingInformation: Array.isArray(record.missingInformation) ? record.missingInformation.filter((x): x is string => typeof x === 'string') : [],
  };
}
