import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePhone } from '../../data-consolidation/normalize';

export interface CustomerQualityProfile {
  totalCustomers: number;
  duplicateCustomerCodeRate: number;
  duplicateNormalizedPhoneRate: number;
  duplicateEmailRate: number;
  nameOnlyAmbiguityRate: number;
  missingPhoneRate: number;
  missingEmailRate: number;
  missingTaxNumberRate: number;
  multiSourceCustomerRate: number;
  activeRate: number;
  inactiveRate: number;
  customersWithTransactionsButNoIdentityMapping: number;
  completenessScore: number;
  identityConfidenceScore: number;
}

// Real profiling of customer data actually imported by the Data
// Consolidation phase — every number here is computed from a live query
// against the real Customer/CustomerExternalReference/SalesDocument tables,
// not estimated. See docs/data-readiness/customer-quality.md.
@Injectable()
export class CustomerQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(): Promise<CustomerQualityProfile> {
    const customers = await this.prisma.customer.findMany({
      select: { id: true, customerCode: true, phone: true, email: true, taxNumber: true, isActive: true, legalName: true },
    });
    const total = customers.length;
    if (total === 0) {
      return {
        totalCustomers: 0,
        duplicateCustomerCodeRate: 0,
        duplicateNormalizedPhoneRate: 0,
        duplicateEmailRate: 0,
        nameOnlyAmbiguityRate: 0,
        missingPhoneRate: 0,
        missingEmailRate: 0,
        missingTaxNumberRate: 0,
        multiSourceCustomerRate: 0,
        activeRate: 0,
        inactiveRate: 0,
        customersWithTransactionsButNoIdentityMapping: 0,
        completenessScore: 0,
        identityConfidenceScore: 0,
      };
    }

    const codeCounts = countBy(customers.map((c) => c.customerCode));
    const phoneCounts = countBy(customers.map((c) => normalizePhone(c.phone)).filter((p): p is string => !!p));
    const emailCounts = countBy(customers.map((c) => c.email?.toLowerCase().trim()).filter((e): e is string => !!e && e.length > 0));
    const nameCounts = countBy(customers.map((c) => c.legalName.toLowerCase().trim()));

    const duplicateCodeCount = customers.filter((c) => codeCounts.get(c.customerCode)! > 1).length;
    const duplicatePhoneCount = customers.filter((c) => { const p = normalizePhone(c.phone); return p ? phoneCounts.get(p)! > 1 : false; }).length;
    const duplicateEmailCount = customers.filter((c) => { const e = c.email?.toLowerCase().trim(); return e ? emailCounts.get(e)! > 1 : false; }).length;
    const nameOnlyAmbiguous = customers.filter((c) => nameCounts.get(c.legalName.toLowerCase().trim())! > 1).length;

    const missingPhone = customers.filter((c) => !c.phone || c.phone.trim() === '').length;
    const missingEmail = customers.filter((c) => !c.email || c.email.trim() === '').length;
    const missingTax = customers.filter((c) => !c.taxNumber || c.taxNumber.trim() === '').length;
    const activeCount = customers.filter((c) => c.isActive).length;

    const multiSourceCount = await this.countMultiSourceCustomers();
    const withTransactionsNoIdentity = await this.prisma.salesDocument.count({ where: { customerId: null, unresolvedCustomerRef: { not: null } } });

    const completenessScore = 1 - (missingPhone + missingEmail + missingTax) / (total * 3);
    const identityConfidenceScore = 1 - (duplicateCodeCount + duplicatePhoneCount + duplicateEmailCount) / (total * 3);

    return {
      totalCustomers: total,
      duplicateCustomerCodeRate: round(duplicateCodeCount / total),
      duplicateNormalizedPhoneRate: round(duplicatePhoneCount / total),
      duplicateEmailRate: round(duplicateEmailCount / total),
      nameOnlyAmbiguityRate: round(nameOnlyAmbiguous / total),
      missingPhoneRate: round(missingPhone / total),
      missingEmailRate: round(missingEmail / total),
      missingTaxNumberRate: round(missingTax / total),
      multiSourceCustomerRate: round(multiSourceCount / total),
      activeRate: round(activeCount / total),
      inactiveRate: round((total - activeCount) / total),
      customersWithTransactionsButNoIdentityMapping: withTransactionsNoIdentity,
      completenessScore: round(Math.max(0, completenessScore)),
      identityConfidenceScore: round(Math.max(0, identityConfidenceScore)),
    };
  }

  private async countMultiSourceCustomers(): Promise<number> {
    const groups = await this.prisma.customerExternalReference.groupBy({ by: ['customerId'], _count: { sourceSystem: true } });
    return groups.filter((g) => g._count.sourceSystem > 1).length;
  }

  // Per-customer business-value/eligibility tiering, used by review
  // prioritization (see ../review/review-prioritization.service.ts) and by
  // AI-dataset eligibility checks.
  async computeBusinessValue(customerId: string): Promise<{ totalSalesValue: number; transactionCount: number; sourceSystemCount: number; recencyDays: number | null }> {
    const [salesAgg, sourceRefs, lastDoc] = await Promise.all([
      this.prisma.salesDocument.aggregate({ where: { customerId }, _sum: { grandTotal: true }, _count: true }),
      this.prisma.customerExternalReference.count({ where: { customerId } }),
      this.prisma.salesDocument.findFirst({ where: { customerId }, orderBy: { documentDate: 'desc' }, select: { documentDate: true } }),
    ]);

    return {
      totalSalesValue: Number(salesAgg._sum.grandTotal ?? 0),
      transactionCount: salesAgg._count,
      sourceSystemCount: sourceRefs,
      recencyDays: lastDoc ? Math.floor((Date.now() - lastDoc.documentDate.getTime()) / (24 * 60 * 60 * 1000)) : null,
    };
  }
}

function countBy<T>(values: T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
