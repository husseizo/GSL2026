import { Injectable } from '@nestjs/common';
import { MatchCandidateStatus, PartRelationshipType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProposeRelationshipParams {
  fromPartId: string;
  toPartId: string;
  relationshipType: PartRelationshipType;
  source: string;
  confidence?: number;
  evidence: Record<string, unknown>;
}

// The part-to-part relationship graph beyond what PartMatchCandidate
// (duplicate detection, Phase 1) and PartCompatibility (vehicle/engine/
// transmission fitment, Phase 1) already cover — real supersession, kit
// membership, and replacement chains, with per-relationship confidence and
// verification. Never presents an unverified (PENDING) relationship as
// fact; never derives a transitive claim without checking the relationship
// type supports it. See docs/ai/parts-search-ranking.md.
@Injectable()
export class PartRelationshipService {
  constructor(private readonly prisma: PrismaService) {}

  // The assistant may only ever PROPOSE a relationship — this method never
  // sets verificationStatus to APPROVED itself.
  async propose(params: ProposeRelationshipParams) {
    return this.prisma.partRelationship.upsert({
      where: { fromPartId_toPartId_relationshipType: { fromPartId: params.fromPartId, toPartId: params.toPartId, relationshipType: params.relationshipType } },
      create: {
        fromPartId: params.fromPartId,
        toPartId: params.toPartId,
        relationshipType: params.relationshipType,
        source: params.source,
        confidence: params.confidence,
        evidence: params.evidence as object,
        verificationStatus: MatchCandidateStatus.PENDING,
      },
      update: { evidence: params.evidence as object, confidence: params.confidence },
    });
  }

  async verify(relationshipId: string, reviewerId: string) {
    return this.prisma.partRelationship.update({
      where: { id: relationshipId },
      data: { verificationStatus: MatchCandidateStatus.APPROVED, reviewerId, verifiedAt: new Date() },
    });
  }

  async reject(relationshipId: string, reviewerId: string) {
    return this.prisma.partRelationship.update({
      where: { id: relationshipId },
      data: { verificationStatus: MatchCandidateStatus.REJECTED, reviewerId, verifiedAt: new Date() },
    });
  }

  // Only relationship types that are genuinely symmetric/transitive by
  // real-world meaning are ever traversed beyond one hop — SAME_AS is
  // transitive (if A=B and B=C then A=C); SUPERSEDES is a directed chain
  // (A supersedes B supersedes C does NOT mean A supersedes C in one step —
  // each link must be checked); COMPATIBLE_WITH/PART_OF_KIT are never
  // assumed transitive without explicit real evidence at each hop.
  async listVerifiedRelationships(partId: string) {
    return this.prisma.partRelationship.findMany({
      where: { OR: [{ fromPartId: partId }, { toPartId: partId }], verificationStatus: MatchCandidateStatus.APPROVED },
    });
  }

  async listPendingRelationships(partId?: string) {
    return this.prisma.partRelationship.findMany({ where: { verificationStatus: MatchCandidateStatus.PENDING, OR: partId ? [{ fromPartId: partId }, { toPartId: partId }] : undefined } });
  }
}
