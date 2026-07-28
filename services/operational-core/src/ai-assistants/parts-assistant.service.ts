import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { PrismaService } from '../prisma/prisma.service';

// Spec §12: OEM lookup, cross references/supersessions, alternative
// suppliers, stock availability, frequently-replaced-together, purchase
// recommendation. Deliberately no LLM call here — every one of these is a
// concrete structured fact already living in Phase 1/2/3 tables
// (PartMatchCandidate, PurchaseDocumentLine, InventoryBalance,
// GarageJobLine, PurchaseRecommendation). Presenting a real cross-reference
// as an LLM-generated sentence would add hallucination risk to a fact that
// doesn't need it — this only assembles and cites what's already recorded.
// See docs/architecture/rag-architecture.md.
@Injectable()
export class PartsAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  async lookup(partId: string) {
    const part = await this.prisma.part.findUnique({ where: { id: partId } });
    if (!part) throw new NotFoundException(`Part ${partId} not found`);

    const [crossReferences, stockAcrossWarehouses, purchaseRecommendation, frequentlyReplacedTogether, alternativeSuppliers] =
      await Promise.all([
        this.prisma.partMatchCandidate.findMany({
          where: { OR: [{ partAId: partId }, { partBId: partId }], status: 'APPROVED' },
          include: { partA: true, partB: true },
        }),
        this.ledger.getBalancesAcrossWarehouses({ itemType: 'PART', partId, lubricantProductId: undefined }),
        this.prisma.purchaseRecommendation.findFirst({ where: { partId }, orderBy: { generatedAt: 'desc' } }),
        this.getFrequentlyReplacedTogether(partId),
        this.getAlternativeSuppliers(partId),
      ]);

    const crossReferencesAndSupersessions = crossReferences.map((m) => {
      const isPartA = m.partAId === partId;
      const other = isPartA ? m.partB : m.partA;
      return { partId: other.id, oemNumber: other.oemNumber, productName: other.productName, rationale: m.rationale, score: m.score };
    });

    const hasEvidence = crossReferencesAndSupersessions.length > 0 || alternativeSuppliers.length > 0 || !!purchaseRecommendation;

    return {
      part: { id: part.id, oemNumber: part.oemNumber, productName: part.productName, category: part.category },
      crossReferencesAndSupersessions,
      alternativeSuppliers,
      stockAvailability: stockAcrossWarehouses,
      frequentlyReplacedTogether,
      purchaseRecommendation: purchaseRecommendation
        ? {
            action: purchaseRecommendation.action,
            suggestedQuantity: Number(purchaseRecommendation.suggestedQuantity),
            confidence: purchaseRecommendation.confidence,
          }
        : null,
      confidence: hasEvidence ? 'MEDIUM' : 'LOW',
      evidence: [
        `${crossReferencesAndSupersessions.length} approved cross-reference/alternative part(s) on file`,
        `${alternativeSuppliers.length} supplier(s) with purchase history for this part`,
        `Stock tracked at ${stockAcrossWarehouses.length} warehouse(s)`,
      ],
    };
  }

  private async getFrequentlyReplacedTogether(partId: string, limit = 5) {
    const lines = await this.prisma.garageJobLine.findMany({ where: { partId }, select: { jobId: true } });
    const jobIds = [...new Set(lines.map((l) => l.jobId))];
    if (jobIds.length === 0) return [];

    const coLines = await this.prisma.garageJobLine.findMany({
      where: { jobId: { in: jobIds }, lineType: 'PART' },
      include: { part: true },
    });

    const counts = new Map<string, { partId: string; partName: string; count: number }>();
    for (const line of coLines) {
      if (!line.partId || line.partId === partId) continue;
      const existing = counts.get(line.partId);
      if (existing) existing.count += 1;
      else counts.set(line.partId, { partId: line.partId, partName: line.part?.productName ?? line.description, count: 1 });
    }

    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  }

  private async getAlternativeSuppliers(partId: string) {
    const lines = await this.prisma.purchaseDocumentLine.findMany({
      where: { partId },
      include: { purchaseDocument: { include: { supplier: true } } },
    });

    const bySupplier = new Map<string, { supplierId: string; supplierName: string; orderCount: number }>();
    for (const line of lines) {
      const supplier = line.purchaseDocument.supplier;
      if (!supplier) continue;
      const existing = bySupplier.get(supplier.id);
      if (existing) existing.orderCount += 1;
      else bySupplier.set(supplier.id, { supplierId: supplier.id, supplierName: supplier.legalName, orderCount: 1 });
    }

    return [...bySupplier.values()].sort((a, b) => b.orderCount - a.orderCount);
  }
}
