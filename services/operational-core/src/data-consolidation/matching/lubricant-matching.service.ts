import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeCompanyName } from '../normalize';

export interface LubricantMatchCandidateInput {
  sourceSystem: string;
  sourceRecordId: string;
  itemCode: string | null;
  brand: string | null;
  productName: string | null;
}

export interface LubricantMatchOutcome {
  matchLevel: 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NO_MATCH' | 'CONFLICT';
  candidateLubricantId: string | null;
  matchSignals: Record<string, unknown>;
}

// Mirrors PartConsolidationMatchingService's structure for LubricantProduct.
// Never infers viscosity/API/ACEA classification during matching — those
// are separate, explicitly-flagged normalization concerns (see
// docs/data-consolidation/lubricants-consolidation.md), not identity signals.
@Injectable()
export class LubricantMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateMatch(input: LubricantMatchCandidateInput): Promise<LubricantMatchOutcome> {
    const existingRef = await this.prisma.lubricantExternalReference.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem: input.sourceSystem, sourceRecordId: input.sourceRecordId } },
    });
    if (existingRef) {
      return { matchLevel: 'EXACT', candidateLubricantId: existingRef.lubricantProductId, matchSignals: { existingExternalReference: true } };
    }

    if (input.itemCode) {
      const byCode = await this.prisma.lubricantProduct.findFirst({ where: { internalCode: input.itemCode } });
      if (byCode) return { matchLevel: 'EXACT', candidateLubricantId: byCode.id, matchSignals: { itemCode: input.itemCode } };
    }

    if (input.brand && input.productName) {
      const normalizedName = normalizeCompanyName(input.productName);
      const candidates = await this.prisma.lubricantProduct.findMany({ where: { brand: input.brand }, select: { id: true, normalizedName: true } });
      const found = candidates.find((c) => c.normalizedName === normalizedName);
      if (found) return { matchLevel: 'HIGH_CONFIDENCE', candidateLubricantId: found.id, matchSignals: { brand: input.brand, normalizedName } };
    }

    return { matchLevel: 'NO_MATCH', candidateLubricantId: null, matchSignals: {} };
  }
}
