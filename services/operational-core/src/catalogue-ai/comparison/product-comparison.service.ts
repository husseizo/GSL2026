import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchCandidateStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ComparisonLabel = 'SAME_CANONICAL_ITEM' | 'VERIFIED_EQUIVALENT' | 'COMPATIBLE_ALTERNATIVE' | 'POSSIBLE_ALTERNATIVE' | 'DIFFERENT_APPLICATION' | 'CONFLICTING_DATA' | 'INSUFFICIENT_EVIDENCE';

export interface PartComparisonResult {
  label: ComparisonLabel;
  fieldComparison: {
    oemNumbers: { a: string; b: string; same: boolean };
    brand: { a: string | null; b: string | null; same: boolean };
    category: { a: string | null; b: string | null; same: boolean };
  };
  verifiedRelationship: string | null;
  evidence: string[];
}

export interface LubricantComparisonResult {
  label: ComparisonLabel;
  fieldComparison: {
    viscosity: { a: string | null; b: string | null; same: boolean; verified: boolean };
    category: { a: string; b: string; same: boolean };
    apiClassification: { a: string | null; b: string | null; same: boolean; verified: boolean };
    aceaClassification: { a: string | null; b: string | null; same: boolean; verified: boolean };
    packageSize: { a: string | null; b: string | null; same: boolean };
  };
  evidence: string[];
}

// Structured, real comparison — never concludes two products are
// interchangeable without real compatibility evidence (a verified
// PartRelationship, or identical canonical id). See docs/ai/rag-answer-contract.md.
@Injectable()
export class ProductComparisonService {
  constructor(private readonly prisma: PrismaService) {}

  async compareParts(partIdA: string, partIdB: string): Promise<PartComparisonResult> {
    const [a, b] = await Promise.all([
      this.prisma.part.findUniqueOrThrow({ where: { id: partIdA } }).catch(() => { throw new NotFoundException(`Part ${partIdA} not found`); }),
      this.prisma.part.findUniqueOrThrow({ where: { id: partIdB } }).catch(() => { throw new NotFoundException(`Part ${partIdB} not found`); }),
    ]);

    if (partIdA === partIdB) {
      return { label: 'SAME_CANONICAL_ITEM', fieldComparison: { oemNumbers: { a: a.oemNumber, b: b.oemNumber, same: true }, brand: { a: a.brand, b: b.brand, same: true }, category: { a: a.category, b: b.category, same: true } }, verifiedRelationship: null, evidence: ['Identical canonical Part id'] };
    }

    const relationship = await this.prisma.partRelationship.findFirst({
      where: { OR: [{ fromPartId: partIdA, toPartId: partIdB }, { fromPartId: partIdB, toPartId: partIdA }] },
    });

    const oemSame = a.oemNumber === b.oemNumber;
    const brandSame = a.brand === b.brand;
    const categorySame = a.category === b.category;
    const fieldComparison = {
      oemNumbers: { a: a.oemNumber, b: b.oemNumber, same: oemSame },
      brand: { a: a.brand, b: b.brand, same: brandSame },
      category: { a: a.category, b: b.category, same: categorySame },
    };

    const evidence: string[] = [];
    let label: ComparisonLabel;

    if (oemSame && !categorySame) {
      label = 'CONFLICTING_DATA';
      evidence.push(`Shared OEM number ${a.oemNumber} but conflicting category (${a.category} vs ${b.category}) — see docs/data-readiness/parts-catalogue-quality.md`);
    } else if (oemSame) {
      label = 'VERIFIED_EQUIVALENT';
      evidence.push(`Shared real OEM number ${a.oemNumber}`);
    } else if (relationship && relationship.verificationStatus === MatchCandidateStatus.APPROVED) {
      label = relationship.relationshipType === 'COMPATIBLE_WITH' ? 'COMPATIBLE_ALTERNATIVE' : 'VERIFIED_EQUIVALENT';
      evidence.push(`Verified relationship: ${relationship.relationshipType}`);
    } else if (relationship) {
      label = 'POSSIBLE_ALTERNATIVE';
      evidence.push(`Unverified proposed relationship: ${relationship.relationshipType} (pending review)`);
    } else if (!categorySame) {
      label = 'DIFFERENT_APPLICATION';
      evidence.push(`Different category (${a.category} vs ${b.category}), no relationship evidence`);
    } else {
      label = 'INSUFFICIENT_EVIDENCE';
      evidence.push('No shared OEM number and no recorded relationship between these two parts');
    }

    return { label, fieldComparison, verifiedRelationship: relationship?.verificationStatus === MatchCandidateStatus.APPROVED ? relationship.relationshipType : null, evidence };
  }

  async compareLubricants(lubricantIdA: string, lubricantIdB: string): Promise<LubricantComparisonResult> {
    const [a, b] = await Promise.all([
      this.prisma.lubricantProduct.findUnique({ where: { id: lubricantIdA }, include: { approvals: true } }),
      this.prisma.lubricantProduct.findUnique({ where: { id: lubricantIdB }, include: { approvals: true } }),
    ]);
    if (!a) throw new NotFoundException(`LubricantProduct ${lubricantIdA} not found`);
    if (!b) throw new NotFoundException(`LubricantProduct ${lubricantIdB} not found`);

    const aVerified = a.approvals.some((x) => x.isVerified);
    const bVerified = b.approvals.some((x) => x.isVerified);
    const evidence: string[] = [];

    const fieldComparison = {
      viscosity: { a: a.viscosity, b: b.viscosity, same: a.viscosity === b.viscosity, verified: false }, // no verified viscosity source exists yet
      category: { a: a.category, b: b.category, same: a.category === b.category },
      apiClassification: { a: a.apiClassification, b: b.apiClassification, same: a.apiClassification === b.apiClassification, verified: false },
      aceaClassification: { a: a.aceaClassification, b: b.aceaClassification, same: a.aceaClassification === b.aceaClassification, verified: false },
      packageSize: { a: a.packageSize?.toString() ?? null, b: b.packageSize?.toString() ?? null, same: a.packageSize?.toString() === b.packageSize?.toString() },
    };

    evidence.push('Viscosity/API/ACEA classification is unverified (PARSED_UNVERIFIED) for both products unless a verified approval exists — see docs/data-readiness/lubricants-quality.md');

    let label: ComparisonLabel;
    if (lubricantIdA === lubricantIdB) {
      label = 'SAME_CANONICAL_ITEM';
    } else if (a.category !== b.category) {
      label = 'DIFFERENT_APPLICATION';
      evidence.push(`Different category (${a.category} vs ${b.category})`);
    } else if (!aVerified && !bVerified) {
      label = 'INSUFFICIENT_EVIDENCE';
      evidence.push('Neither product has a verified OEM approval — cannot confirm equivalence, only that both are unverified in the same category');
    } else {
      label = 'POSSIBLE_ALTERNATIVE';
      evidence.push('Same category, but no shared verified approval confirming true equivalence');
    }

    return { label, fieldComparison, evidence };
  }
}
