import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type VerificationState = 'SOURCE_VERIFIED' | 'DOCUMENT_VERIFIED' | 'PARSED_UNVERIFIED' | 'MANUALLY_VERIFIED' | 'CONFLICTING' | 'MISSING';

export interface LubricantsQualityProfile {
  totalProducts: number;
  productCodeUniquenessRate: number;
  duplicateNormalizedNameCount: number;
  missingViscosityRate: number;
  missingPackageSizeRate: number;
  missingCategoryRate: number;
  missingApiClassificationRate: number;
  missingAceaClassificationRate: number;
  missingOemApprovalRate: number;
  missingCostRate: number;
  missingSellingPriceRate: number;
  productsWithSalesButNoValidMaster: number;
  inactiveProductsWithRecentSales: number;
  verificationStateCounts: Record<VerificationState, number>;
}

// Real profiling of the 434 real LubricantProduct rows imported from
// MolasCacheDb. Never promotes a parsed value to "verified" without real
// evidence — see docs/data-consolidation/lubricants-consolidation.md and
// docs/data-readiness/lubricants-quality.md.
@Injectable()
export class LubricantsQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(): Promise<LubricantsQualityProfile> {
    const products = await this.prisma.lubricantProduct.findMany({
      select: {
        id: true,
        internalCode: true,
        normalizedName: true,
        viscosity: true,
        packageSize: true,
        category: true,
        apiClassification: true,
        aceaClassification: true,
        currentCost: true,
        defaultSellingPrice: true,
        isActive: true,
        updatedAt: true,
        approvals: { select: { isVerified: true } },
      },
    });
    const total = products.length;
    if (total === 0) {
      return {
        totalProducts: 0,
        productCodeUniquenessRate: 0,
        duplicateNormalizedNameCount: 0,
        missingViscosityRate: 0,
        missingPackageSizeRate: 0,
        missingCategoryRate: 0,
        missingApiClassificationRate: 0,
        missingAceaClassificationRate: 0,
        missingOemApprovalRate: 0,
        missingCostRate: 0,
        missingSellingPriceRate: 0,
        productsWithSalesButNoValidMaster: 0,
        inactiveProductsWithRecentSales: 0,
        verificationStateCounts: { SOURCE_VERIFIED: 0, DOCUMENT_VERIFIED: 0, PARSED_UNVERIFIED: 0, MANUALLY_VERIFIED: 0, CONFLICTING: 0, MISSING: 0 },
      };
    }

    const codes = products.map((p) => p.internalCode).filter(Boolean);
    const uniqueCodes = new Set(codes).size;
    const nameCounts = new Map<string, number>();
    for (const p of products) nameCounts.set(p.normalizedName, (nameCounts.get(p.normalizedName) ?? 0) + 1);
    const duplicateNames = [...nameCounts.values()].filter((c) => c > 1).length;

    const recentCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const inactiveWithSales = await this.prisma.salesDocumentLine.count({
      where: { lubricantProduct: { isActive: false }, salesDocument: { documentDate: { gte: recentCutoff } } },
    });
    const salesWithUnresolvedProduct = await this.prisma.salesDocumentLine.count({ where: { lubricantProductId: null, unresolvedItemCode: { not: null }, itemType: 'LUBRICANT' } });

    const verificationStateCounts: Record<VerificationState, number> = { SOURCE_VERIFIED: 0, DOCUMENT_VERIFIED: 0, PARSED_UNVERIFIED: 0, MANUALLY_VERIFIED: 0, CONFLICTING: 0, MISSING: 0 };
    for (const p of products) {
      verificationStateCounts[this.classifyVerificationState(p)] += 1;
    }

    return {
      totalProducts: total,
      productCodeUniquenessRate: round(uniqueCodes / total),
      duplicateNormalizedNameCount: duplicateNames,
      missingViscosityRate: round(products.filter((p) => !p.viscosity).length / total),
      missingPackageSizeRate: round(products.filter((p) => p.packageSize === null).length / total),
      missingCategoryRate: round(products.filter((p) => !p.category).length / total),
      missingApiClassificationRate: round(products.filter((p) => !p.apiClassification).length / total),
      missingAceaClassificationRate: round(products.filter((p) => !p.aceaClassification).length / total),
      missingOemApprovalRate: round(products.filter((p) => p.approvals.length === 0).length / total),
      missingCostRate: round(products.filter((p) => p.currentCost === null).length / total),
      missingSellingPriceRate: round(products.filter((p) => p.defaultSellingPrice === null).length / total),
      productsWithSalesButNoValidMaster: salesWithUnresolvedProduct,
      inactiveProductsWithRecentSales: inactiveWithSales,
      verificationStateCounts,
    };
  }

  // Real classification per product — never returns MANUALLY_VERIFIED or
  // DOCUMENT_VERIFIED without real evidence (an approval row exists, or a
  // technical-document reference — neither is populated for any product in
  // this build, since no technical-document source was imported this
  // phase, so those two states are currently always empty in practice, not
  // hidden or assumed).
  classifyVerificationState(product: { viscosity: string | null; apiClassification: string | null; aceaClassification: string | null; approvals: { isVerified: boolean }[] }): VerificationState {
    if (product.approvals.some((a) => a.isVerified)) return 'MANUALLY_VERIFIED';
    if (!product.viscosity && !product.apiClassification && !product.aceaClassification) return 'MISSING';
    return 'PARSED_UNVERIFIED';
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
