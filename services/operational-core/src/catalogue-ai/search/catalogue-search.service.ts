import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { identifiersMatch, normalizeIdentifierForSearch } from './identifier-normalization';

// DGX Prototype 1.5 caching (spec §28): short-TTL only, never indefinite —
// real Part rows can change at any time (import, consolidation, merge) and
// there is no version marker on live transactional reads the way there is
// on the vector index, so correctness is protected by a short expiry
// rather than an invalidation event. CatalogueSearchResult never includes
// restricted commercial fields (cost, pricing), so no per-user permission
// scope is needed in the cache key — the same real result is safe for any
// caller who already cleared the parts.read permission gate. See
// docs/ai-tuning/performance-optimization.md.
const CACHE_TTL_SECONDS = 30;
const CACHE_KEY_PREFIX = 'catalogue-search:v1'; // "v1" is the query-normalization version — bump this if normalizeIdentifierForSearch's logic ever changes meaning for the same raw input

export type MatchType =
  | 'EXACT_INTERNAL_CODE'
  | 'EXACT_OEM'
  | 'EXACT_ALTERNATE'
  | 'VERIFIED_SUPERSESSION'
  | 'EXACT_TECDOC'
  | 'VERIFIED_FITMENT'
  | 'KEYWORD_MATCH'
  | 'SEMANTIC_MATCH'
  | 'POSSIBLE_ALTERNATIVE'
  | 'CONFLICTING_MATCH'
  | 'INSUFFICIENT_EVIDENCE';

export interface CatalogueSearchResult {
  canonicalEntityId: string;
  entityType: 'PART' | 'LUBRICANT';
  displayName: string;
  exactIdentifiers: string[];
  matchType: MatchType;
  matchScore: number;
  hasConflict: boolean;
}

// Deterministic, DGX-independent catalogue search — the spec's explicit
// rule: "Do not send obvious exact identifiers to the LLM before
// deterministic lookup." Every method here queries Part/PartAlternateNumber/
// LubricantProduct directly; none of them ever calls the AI gateway, so
// this entire service keeps working when DGX is fully offline (see
// docs/ai/dgx-fallback.md). Real per-part conflict flags reuse the Data
// Readiness phase's PartsQualityService.postValidateOemConsolidations()
// findings via a live re-check, not a cached snapshot.
@Injectable()
export class CatalogueSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // Exact internal-code retrieval — highest priority match type.
  async findByInternalCode(code: string): Promise<CatalogueSearchResult | null> {
    const norm = normalizeIdentifierForSearch(code);
    const part = await this.prisma.part.findFirst({ where: { internalItemCode: norm.strict } });
    if (!part) return null;
    return this.toResult(part, 'EXACT_INTERNAL_CODE', 1.0);
  }

  // Exact OEM-number retrieval, with a relaxed fallback for formatting
  // variations (spaces/hyphens/dots/slashes) — never merges two OEM
  // numbers that differ beyond formatting. Cached (short TTL, see
  // CACHE_TTL_SECONDS above) since the relaxed-fallback path does a full
  // table scan — repeated identical queries in a short burst skip it.
  async findByOemNumber(oemNumber: string): Promise<CatalogueSearchResult[]> {
    const norm = normalizeIdentifierForSearch(oemNumber);
    const cacheKey = `${CACHE_KEY_PREFIX}:oem:${norm.strict}`;
    const cached = await this.redis.cacheGet<CatalogueSearchResult[]>(cacheKey);
    if (cached) return cached;

    const result = await this.findByOemNumberUncached(norm.strict, oemNumber);
    await this.redis.cacheSet(cacheKey, result, CACHE_TTL_SECONDS);
    return result;
  }

  private async findByOemNumberUncached(normalizedStrict: string, originalQuery: string): Promise<CatalogueSearchResult[]> {
    const strictMatches = await this.prisma.part.findMany({ where: { oemNumber: normalizedStrict } });
    if (strictMatches.length > 0) {
      return this.toResultsWithConflictCheck(strictMatches, 'EXACT_OEM', 1.0);
    }

    // Relaxed fallback: real profiling found OEM numbers stored with
    // inconsistent formatting across sources — compare using the relaxed
    // (separator-stripped) form, but only as a distinctly lower-scored
    // match type, never presented as an EXACT_OEM hit.
    const allParts = await this.prisma.part.findMany({ select: { id: true, oemNumber: true, productName: true, brand: true, category: true, internalItemCode: true } });
    const relaxedMatches = allParts.filter((p) => identifiersMatch(p.oemNumber, originalQuery).strength === 'RELAXED');
    if (relaxedMatches.length > 0) {
      const fullRecords = await this.prisma.part.findMany({ where: { id: { in: relaxedMatches.map((p) => p.id) } } });
      return this.toResultsWithConflictCheck(fullRecords, 'EXACT_OEM', 0.9);
    }

    return [];
  }

  // Alternate-number retrieval via PartAlternateNumber.
  async findByAlternateNumber(number: string): Promise<CatalogueSearchResult[]> {
    const norm = normalizeIdentifierForSearch(number);
    const alternates = await this.prisma.partAlternateNumber.findMany({ where: { number: norm.strict }, include: { part: true } });
    return this.toResultsWithConflictCheck(alternates.map((a) => a.part), 'EXACT_ALTERNATE', 0.95);
  }

  // TecDoc-identifier retrieval — real field added this phase (Part.tecdocArticleId).
  async findByTecdocId(tecdocArticleId: string): Promise<CatalogueSearchResult[]> {
    const parts = await this.prisma.part.findMany({ where: { tecdocArticleId } });
    return this.toResultsWithConflictCheck(parts, 'EXACT_TECDOC', 1.0);
  }

  // Real supersession retrieval — via PartRelationship (this phase),
  // restricted to verified relationships only (never presents a PENDING
  // proposed supersession as fact).
  async findSupersessions(partId: string): Promise<{ relationshipType: 'SUPERSEDES' | 'SUPERSEDED_BY'; relatedPartId: string; verified: boolean }[]> {
    const relationships = await this.prisma.partRelationship.findMany({
      where: { OR: [{ fromPartId: partId, relationshipType: { in: ['SUPERSEDES', 'SUPERSEDED_BY'] } }, { toPartId: partId, relationshipType: { in: ['SUPERSEDES', 'SUPERSEDED_BY'] } }] },
    });
    return relationships.map((r) => ({
      relationshipType: r.relationshipType as 'SUPERSEDES' | 'SUPERSEDED_BY',
      relatedPartId: r.fromPartId === partId ? r.toPartId : r.fromPartId,
      verified: r.verificationStatus === 'APPROVED',
    }));
  }

  // Keyword search over Part/LubricantProduct product names — a simple,
  // deterministic substring/term match, distinct from KnowledgeChunk
  // keyword search (Phase 4's VectorSearchService.keywordSearch(), which
  // operates over ingested knowledge-document text, not live catalogue
  // rows). Used as the pre-semantic fallback tier.
  async keywordSearchParts(query: string, limit = 20): Promise<CatalogueSearchResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const parts = await this.prisma.part.findMany({
      where: { OR: terms.map((term) => ({ standardizedProductName: { contains: term, mode: 'insensitive' as const } })) },
      take: limit,
    });
    return this.toResultsWithConflictCheck(parts, 'KEYWORD_MATCH', 0.5);
  }

  async keywordSearchLubricants(query: string, limit = 20): Promise<CatalogueSearchResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const products = await this.prisma.lubricantProduct.findMany({
      where: { OR: terms.map((term) => ({ normalizedName: { contains: term, mode: 'insensitive' as const } })) },
      take: limit,
    });
    return products.map((p) => ({
      canonicalEntityId: p.id,
      entityType: 'LUBRICANT' as const,
      displayName: p.productName,
      exactIdentifiers: p.internalCode ? [p.internalCode] : [],
      matchType: 'KEYWORD_MATCH' as const,
      matchScore: 0.5,
      hasConflict: false,
    }));
  }

  // Verified-viscosity lubricant search — never returns a product whose
  // viscosity is only PARSED_UNVERIFIED as if it were a confirmed fact
  // (see docs/data-readiness/lubricants-quality.md); the caller must check
  // `verified` before presenting a viscosity match as fact.
  async findLubricantsByViscosity(viscosity: string): Promise<{ lubricantId: string; displayName: string; viscosity: string | null; verified: boolean }[]> {
    const products = await this.prisma.lubricantProduct.findMany({ where: { viscosity } });
    return products.map((p) => ({ lubricantId: p.id, displayName: p.productName, viscosity: p.viscosity, verified: false })); // no verified viscosity source exists yet — see docs/data-readiness/lubricants-quality.md
  }

  async findLubricantsByVerifiedApproval(oemBrand: string, approvalCode: string): Promise<{ lubricantId: string; displayName: string }[]> {
    const approvals = await this.prisma.lubricantApproval.findMany({
      where: { oemBrand, approvalCode, isVerified: true },
      include: { lubricantProduct: true },
    });
    return approvals.map((a) => ({ lubricantId: a.lubricantProductId, displayName: a.lubricantProduct.productName }));
  }

  private async toResultsWithConflictCheck(parts: { id: string; oemNumber: string; productName: string; internalItemCode: string | null }[], matchType: MatchType, score: number): Promise<CatalogueSearchResult[]> {
    return Promise.all(parts.map((p) => this.toResult(p, matchType, score)));
  }

  private async toResult(part: { id: string; oemNumber: string; productName: string; internalItemCode: string | null }, matchType: MatchType, score: number): Promise<CatalogueSearchResult> {
    const refCount = await this.prisma.partExternalReference.count({ where: { partId: part.id } });
    const hasConflict = refCount > 1 && (await this.hasRealConflict(part.id));
    return {
      canonicalEntityId: part.id,
      entityType: 'PART',
      displayName: part.productName,
      exactIdentifiers: [part.oemNumber, ...(part.internalItemCode ? [part.internalItemCode] : [])],
      matchType: hasConflict ? 'CONFLICTING_MATCH' : matchType,
      matchScore: hasConflict ? Math.min(score, 0.6) : score,
      hasConflict,
    };
  }

  // Real, live re-check against the raw staged source records — the same
  // signal PartsQualityService.postValidateOemConsolidations() (Data
  // Readiness phase) computes in aggregate, applied here per-part so a
  // search result can flag it immediately rather than requiring a
  // separate profiling report to be consulted first.
  private async hasRealConflict(partId: string): Promise<boolean> {
    const refs = await this.prisma.partExternalReference.findMany({ where: { partId } });
    if (refs.length < 2) return false;
    const rawRecords = await this.prisma.rawSourceRecord.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordKey: { in: refs.map((r) => r.sourceRecordId) } } });
    const categories = new Set(rawRecords.map((r) => (r.rawPayload as { part_group?: string }).part_group).filter(Boolean));
    return categories.size > 1;
  }

  // Public wrapper (DGX Prototype 1.5) — reused by context-builder.ts so
  // RAG context assembly shares the exact same real conflict signal as
  // deterministic search results, rather than a second implementation.
  async checkRealConflict(partId: string): Promise<boolean> {
    return this.hasRealConflict(partId);
  }
}
