// DGX Prototype 1.7 — Claim-level provenance (spec §9).
//
// Every real technical claim must be traceable to an exact quoted
// substring of its source version's rawContent — the mechanism ensuring
// "do not convert free text into approved claims without review." Claim
// extraction here is deterministic (sentence-segmentation + a small,
// real keyword-classification heuristic), never an LLM call — matching
// the spec's own rule that structured/claim data must never rest solely
// on an LLM summary.
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ClaimVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { MetricsService } from '../../observability/metrics.service';

const SENTENCE_SPLIT_PATTERN = /(?<=[.!?])\s+(?=[A-Z0-9])/;

export interface CandidateClaim {
  claimText: string;
  claimType: string;
  evidenceQuote: string;
}

// Real, deterministic candidate-claim extraction (ingestion stage 9) — a
// sentence is a "candidate claim" if it contains a real technical-looking
// signal (a number+unit, an identifier-shaped token, or a known
// claim-type keyword). This is intentionally a coarse, honest heuristic,
// not a trained extractor — every candidate still requires human review
// before its verificationStatus can become VERIFIED (see reviewClaim()).
const CLAIM_TYPE_PATTERNS: { type: string; pattern: RegExp }[] = [
  { type: 'torque_value', pattern: /\b\d+(\.\d+)?\s?(nm|n\.m|ft-lb|lb-ft)\b/i },
  { type: 'fluid_specification', pattern: /\b\d+(\.\d+)?\s?(l|liters?|litres?|ml)\b/i },
  { type: 'supersession_statement', pattern: /\bsupersede[ds]?\b/i },
  { type: 'fitment_statement', pattern: /\bfits?\b|\bcompatible with\b|\bapplicable to\b/i },
  // DGX Prototype 1.7.1 — widened to also match "recommend" (spec §24's
  // "recommendation presented as formal approval" conflict). Without this,
  // a pure recommendation statement would never enter the same comparable
  // claimType bucket as an approval statement about the same product,
  // and knowledge-conflict.service.ts's detectApprovalStatusConflicts()
  // could never see the two side by side.
  { type: 'approval_statement', pattern: /\bapproval\b|\bapproved\b|\brecommend/i },
  { type: 'service_interval', pattern: /\bevery\s+\d+\s?(km|miles|months?|years?)\b/i },
  { type: 'identifier_reference', pattern: /\b[A-Z0-9][A-Z0-9-]{4,}\b/ },
];

export function extractCandidateClaims(rawContent: string): CandidateClaim[] {
  const sentences = rawContent
    .split(SENTENCE_SPLIT_PATTERN)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const claims: CandidateClaim[] = [];
  for (const sentence of sentences) {
    const match = CLAIM_TYPE_PATTERNS.find((p) => p.pattern.test(sentence));
    if (match) {
      claims.push({ claimText: sentence, claimType: match.type, evidenceQuote: sentence });
    }
  }
  return claims;
}

@Injectable()
export class KnowledgeClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  // Persists real candidate claims extracted from a version's rawContent —
  // every claim starts UNVERIFIED; nothing here auto-approves.
  async extractAndPersistClaims(itemId: string, versionId: string, rawContent: string, actorId?: string) {
    const candidates = extractCandidateClaims(rawContent);
    const created = await Promise.all(
      candidates.map((c) =>
        this.prisma.knowledgeClaim.create({
          data: { itemId, versionId, claimText: c.claimText, claimType: c.claimType, evidenceQuote: c.evidenceQuote, verificationStatus: 'UNVERIFIED' },
        }),
      ),
    );
    if (created.length > 0) {
      await this.audit.log({ action: 'KNOWLEDGE_CLAIMS_EXTRACTED', entityType: 'KnowledgeItemVersion', entityId: versionId, afterState: { count: created.length }, actorId });
      this.metrics?.recordKnowledgeCandidateClaims(created.length);
    }
    return created;
  }

  async verifyClaim(claimId: string, verifierId: string, status: ClaimVerificationStatus, actorRole?: string) {
    const before = await this.prisma.knowledgeClaim.findUnique({ where: { id: claimId } });
    if (!before) throw new NotFoundException(`KnowledgeClaim ${claimId} not found`);
    const after = await this.prisma.knowledgeClaim.update({ where: { id: claimId }, data: { verificationStatus: status, verifiedById: verifierId, verifiedAt: new Date() } });
    await this.audit.log({ action: `KNOWLEDGE_CLAIM_${status}`, entityType: 'KnowledgeClaim', entityId: claimId, beforeState: before, afterState: after, actorId: verifierId, actorRole });
    this.metrics?.recordKnowledgeClaimDecision(status);
    return after;
  }

  listByItem(itemId: string, filter: { verificationStatus?: ClaimVerificationStatus } = {}) {
    return this.prisma.knowledgeClaim.findMany({ where: { itemId, ...filter }, orderBy: { createdAt: 'desc' } });
  }
}
