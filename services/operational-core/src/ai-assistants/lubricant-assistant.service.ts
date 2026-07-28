import { Injectable } from '@nestjs/common';
import { LubricantCategory } from '@prisma/client';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { PrismaService } from '../prisma/prisma.service';

export interface LubricantRecommendationParams {
  brand?: string;
  model?: string;
  engineCode?: string;
  category?: LubricantCategory;
}

// Spec §13: "Always cite OEM approvals. Never invent specifications."
// Enforced structurally, not just by prompt instruction: this service never
// calls the LLM at all. It only returns LubricantCompatibility/
// LubricantApproval rows that already exist — if no compatibility record
// matches, the honest answer is an empty list with an explicit note, not a
// generated-sounding guess at a viscosity grade. See
// docs/architecture/rag-architecture.md.
@Injectable()
export class LubricantAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  async recommend(params: LubricantRecommendationParams) {
    const compatibilities = await this.prisma.lubricantCompatibility.findMany({
      where: {
        brand: params.brand,
        model: params.model ?? undefined,
        engineCode: params.engineCode ?? undefined,
      },
      include: { lubricantProduct: true },
    });

    const uniqueProducts = new Map<string, (typeof compatibilities)[number]['lubricantProduct']>();
    for (const c of compatibilities) uniqueProducts.set(c.lubricantProduct.id, c.lubricantProduct);

    let products = [...uniqueProducts.values()];
    if (params.category) products = products.filter((p) => p.category === params.category);

    const recommendations = await Promise.all(
      products.map(async (product) => {
        const [approvals, stock] = await Promise.all([
          this.prisma.lubricantApproval.findMany({ where: { lubricantProductId: product.id } }),
          this.ledger.getBalancesAcrossWarehouses({ itemType: 'LUBRICANT', partId: undefined, lubricantProductId: product.id }),
        ]);
        return {
          lubricantProductId: product.id,
          productName: product.productName,
          category: product.category,
          viscosity: product.viscosity,
          apiClassification: product.apiClassification,
          aceaClassification: product.aceaClassification,
          oemApprovals: approvals.map((a) => ({ oemBrand: a.oemBrand, approvalCode: a.approvalCode, isVerified: a.isVerified })),
          stockAvailability: stock,
        };
      }),
    );

    const hasApprovals = recommendations.some((r) => r.oemApprovals.length > 0);

    return {
      recommendations,
      confidence: recommendations.length === 0 ? 'LOW' : hasApprovals ? 'HIGH' : 'MEDIUM',
      evidence:
        recommendations.length > 0
          ? [`${recommendations.length} compatible lubricant(s) found in LubricantCompatibility for the given vehicle attributes`]
          : ['No LubricantCompatibility record matches the given vehicle attributes — no recommendation is made rather than guessing a specification'],
    };
  }
}
