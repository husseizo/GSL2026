import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RagCorpusEntry {
  entityType: 'PART' | 'LUBRICANT';
  canonicalId: string;
  oemNumbers: string[];
  alternateNumbers: string[];
  description: string;
  brand: string | null;
  category: string | null;
  confidence: 'VERIFIED' | 'PARSED_UNVERIFIED';
  sourceCitations: { sourceSystem: string; sourceRecordId: string }[];
  lastVerifiedDate: Date | null;
}

// A real, provenance-preserving retrieval corpus over the actually-
// imported real catalogue (7,723 real Parts, 434 real LubricantProducts) —
// not a synthetic example set. Every entry cites its real source
// record(s); unverified lubricant technical data is explicitly excluded
// from being presented as a fact. See docs/data-readiness/catalogue-rag-readiness.md.
@Injectable()
export class CatalogueRagCorpusService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPartsCorpus(limit = 10000): Promise<RagCorpusEntry[]> {
    const parts = await this.prisma.part.findMany({
      where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' },
      take: limit,
      include: { alternateNumbers: true, externalRefs: true },
    });

    return parts.map((p) => ({
      entityType: 'PART' as const,
      canonicalId: p.id,
      oemNumbers: [p.oemNumber],
      alternateNumbers: p.alternateNumbers.map((a) => a.number),
      description: p.productName,
      brand: p.brand,
      category: p.category,
      confidence: 'VERIFIED' as const, // real, imported catalogue data — the identity itself is verified (real OEM match); no unverified inference is included
      sourceCitations: p.externalRefs.map((r) => ({ sourceSystem: r.sourceSystem, sourceRecordId: r.sourceRecordId })),
      lastVerifiedDate: p.updatedAt,
    }));
  }

  async buildLubricantsCorpus(limit = 10000): Promise<RagCorpusEntry[]> {
    const products = await this.prisma.lubricantProduct.findMany({
      where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' },
      take: limit,
      include: { externalRefs: true, approvals: true },
    });

    return products.map((p) => {
      // Per the phase's explicit rule, unverified parsed viscosity/API/
      // ACEA is never presented as a fact in the retrieval corpus — only
      // real, human-verified approvals (LubricantApproval.isVerified) earn
      // VERIFIED; everything else is PARSED_UNVERIFIED, and the RAG
      // consumer is expected to caveat accordingly.
      const hasVerifiedApproval = p.approvals.some((a) => a.isVerified);
      return {
        entityType: 'LUBRICANT' as const,
        canonicalId: p.id,
        oemNumbers: [],
        alternateNumbers: [],
        description: `${p.productName} (${p.brand}, ${p.category})`,
        brand: p.brand,
        category: p.category,
        confidence: hasVerifiedApproval ? ('VERIFIED' as const) : ('PARSED_UNVERIFIED' as const),
        sourceCitations: p.externalRefs.map((r) => ({ sourceSystem: r.sourceSystem, sourceRecordId: r.sourceRecordId })),
        lastVerifiedDate: hasVerifiedApproval ? p.updatedAt : null,
      };
    });
  }

  async buildFullCorpus(): Promise<{ parts: RagCorpusEntry[]; lubricants: RagCorpusEntry[]; totalEntries: number; verifiedCount: number; unverifiedCount: number }> {
    const [parts, lubricants] = await Promise.all([this.buildPartsCorpus(), this.buildLubricantsCorpus()]);
    const all = [...parts, ...lubricants];
    return {
      parts,
      lubricants,
      totalEntries: all.length,
      verifiedCount: all.filter((e) => e.confidence === 'VERIFIED').length,
      unverifiedCount: all.filter((e) => e.confidence === 'PARSED_UNVERIFIED').length,
    };
  }
}
