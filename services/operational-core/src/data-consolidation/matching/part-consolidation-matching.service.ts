import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeOemNumber } from '../../parts/normalize';

export interface PartMatchCandidateInput {
  sourceSystem: string;
  sourceRecordId: string;
  itemCode: string | null;
  oemNumber: string | null;
  description: string | null;
}

export interface PartMatchOutcome {
  matchLevel: 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NO_MATCH' | 'CONFLICT';
  candidatePartId: string | null;
  matchSignals: Record<string, unknown>;
}

// Reuses Phase 1's normalizeOemNumber() (src/parts/normalize.ts) rather than
// inventing a second normalization scheme — "Use existing Phase 1 parts
// matching" per the phase brief. This service answers "does this staged
// spare-parts record correspond to an existing Part, or a new one" before
// upsert; PartMatcherService (src/parts/matching) remains the separate,
// existing Part-to-Part duplicate detector that runs AFTER Parts exist, and
// is unchanged. See docs/data-consolidation/parts-consolidation.md.
@Injectable()
export class PartConsolidationMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateMatch(input: PartMatchCandidateInput): Promise<PartMatchOutcome> {
    const existingRef = await this.prisma.partExternalReference.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem: input.sourceSystem, sourceRecordId: input.sourceRecordId } },
    });
    if (existingRef) {
      return { matchLevel: 'EXACT', candidatePartId: existingRef.partId, matchSignals: { existingExternalReference: true } };
    }

    if (!input.itemCode) {
      return { matchLevel: 'NO_MATCH', candidatePartId: null, matchSignals: { missingItemCode: true } };
    }

    // Exact internal-code match (real risk: oitm.item_code has duplicate
    // values in Parts_Catalog — see docs/data-sources/source-data-risks.md
    // §6 — so a single match is EXACT, more than one is a CONFLICT requiring
    // review rather than picking one arbitrarily).
    const byInternalCode = await this.prisma.part.findMany({ where: { internalItemCode: input.itemCode } });
    if (byInternalCode.length === 1) {
      return { matchLevel: 'EXACT', candidatePartId: byInternalCode[0].id, matchSignals: { itemCode: input.itemCode } };
    }
    if (byInternalCode.length > 1) {
      return { matchLevel: 'CONFLICT', candidatePartId: null, matchSignals: { itemCode: input.itemCode, duplicateCandidates: byInternalCode.map((p) => p.id) } };
    }

    if (input.oemNumber) {
      const normalizedOem = normalizeOemNumber(input.oemNumber);
      const byOem = await this.prisma.part.findMany({ where: { oemNumber: normalizedOem } });
      if (byOem.length === 1) {
        return { matchLevel: 'HIGH_CONFIDENCE', candidatePartId: byOem[0].id, matchSignals: { oemNumber: normalizedOem } };
      }
      if (byOem.length > 1) {
        return { matchLevel: 'CONFLICT', candidatePartId: null, matchSignals: { oemNumber: normalizedOem, duplicateCandidates: byOem.map((p) => p.id) } };
      }

      const byAlternate = await this.prisma.partAlternateNumber.findMany({ where: { number: normalizedOem } });
      if (byAlternate.length === 1) {
        return { matchLevel: 'POSSIBLE_MATCH', candidatePartId: byAlternate[0].partId, matchSignals: { alternateOem: normalizedOem } };
      }
    }

    return { matchLevel: 'NO_MATCH', candidatePartId: null, matchSignals: {} };
  }
}
