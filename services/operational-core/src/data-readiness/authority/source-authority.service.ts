import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DefineAuthorityParams {
  entityType: string;
  fieldName?: string;
  authoritativeSourceSystem: string;
  authorityType: 'ENTITY_LEVEL' | 'FIELD_LEVEL' | 'TEMPORAL' | 'FALLBACK' | 'MANUAL' | 'UNRESOLVED';
  priority?: number;
  rationale: string;
  decidedById?: string;
}

// The formal source-of-truth registry (spec §5). Supersession is
// append-only: defining a new rule for an (entityType, fieldName) closes
// the previous one's effectiveTo rather than overwriting it — this IS the
// AuthorityDecisionHistory the phase requires, without a separate table.
// See docs/data-readiness/source-of-truth-registry.md.
@Injectable()
export class SourceAuthorityService {
  constructor(private readonly prisma: PrismaService) {}

  async defineAuthority(params: DefineAuthorityParams) {
    const now = new Date();
    await this.prisma.sourceAuthorityRule.updateMany({
      where: { entityType: params.entityType, fieldName: params.fieldName ?? null, effectiveTo: null },
      data: { effectiveTo: now },
    });

    return this.prisma.sourceAuthorityRule.create({
      data: {
        entityType: params.entityType,
        fieldName: params.fieldName,
        authoritativeSourceSystem: params.authoritativeSourceSystem,
        authorityType: params.authorityType,
        priority: params.priority ?? 0,
        rationale: params.rationale,
        decidedById: params.decidedById,
        effectiveFrom: now,
      },
    });
  }

  async getAuthority(entityType: string, fieldName?: string) {
    return this.prisma.sourceAuthorityRule.findFirst({
      where: { entityType, fieldName: fieldName ?? null, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async listCurrentRules() {
    return this.prisma.sourceAuthorityRule.findMany({ where: { effectiveTo: null }, orderBy: [{ entityType: 'asc' }, { fieldName: 'asc' }] });
  }

  async recordConflict(entityType: string, fieldName: string | undefined, conflictingSources: { sourceSystem: string; value: unknown }[]) {
    return this.prisma.authorityConflict.create({
      data: { entityType, fieldName, conflictingSources: conflictingSources as object },
    });
  }

  listOpenConflicts() {
    return this.prisma.authorityConflict.findMany({ where: { resolutionStatus: 'PENDING' }, orderBy: { detectedAt: 'asc' } });
  }

  async resolveConflict(id: string, resolvedById: string, resolutionNote: string) {
    return this.prisma.authorityConflict.update({
      where: { id },
      data: { resolutionStatus: 'APPROVED', resolvedById, resolvedAt: new Date(), resolutionNote },
    });
  }

  // Seeds the real, currently-known authority decisions for this platform's
  // actual sources — see docs/data-readiness/source-of-truth-registry.md
  // for the reasoning behind each one. Idempotent: re-running only creates
  // a new rule generation if the decision actually changed (defineAuthority
  // always supersedes, so calling this twice with the same inputs produces
  // two historical rows — callers should call it once per real decision,
  // which is exactly how the verification script uses it).
  async seedKnownAuthorityDecisions(decidedById?: string) {
    const decisions: DefineAuthorityParams[] = [
      { entityType: 'PART', authoritativeSourceSystem: 'PARTS_CATALOG_AUTOHUB', authorityType: 'ENTITY_LEVEL', rationale: 'Parts_Catalog (oitm/AutoHub) is the real, populated spare-parts catalogue source of truth; MOLAS_Live_2021_Cache is almost entirely empty (see docs/data-sources/molas-live-2021-cache-profile.md).', decidedById },
      { entityType: 'PART', fieldName: 'oemNumber', authoritativeSourceSystem: 'PARTS_CATALOG_AUTOHUB', authorityType: 'FIELD_LEVEL', rationale: 'canonical_oem_number in oitm is the real cross-reference identity signal already proven to correctly consolidate re-catalogued duplicates (see docs/data-consolidation/parts-consolidation.md).', decidedById },
      { entityType: 'PART', fieldName: 'sellingPrice', authoritativeSourceSystem: 'PARTS_CATALOG_AUTOHUB', authorityType: 'FALLBACK', priority: 1, rationale: 'oitm.sell_price_tzs is the only real commercial price field profiled for spare parts; not assumed authoritative for other commercial fields (stock, supplier) without separate evidence — see docs/data-readiness/decision-log.md.', decidedById },
      { entityType: 'LUBRICANT', authoritativeSourceSystem: 'MOLAS_CACHE_LUBRICANTS', authorityType: 'ENTITY_LEVEL', rationale: 'CacheProducts is the real, actively-synced lubricants product master (real SAP<->Odoo middleware) — see docs/data-sources/molas-cache-db-profile.md.', decidedById },
      { entityType: 'LUBRICANT', fieldName: 'apiClassification', authoritativeSourceSystem: 'UNRESOLVED', authorityType: 'UNRESOLVED', rationale: 'No verified source for API/ACEA classification or OEM approvals was profiled and imported this phase — CacheLiquiMolyProducts exists but was not ingested. Marked UNRESOLVED rather than guessed. See docs/data-readiness/lubricants-quality.md.', decidedById },
      { entityType: 'CUSTOMER', authoritativeSourceSystem: 'MOLAS_CACHE_LUBRICANTS', authorityType: 'ENTITY_LEVEL', rationale: 'Only source with a real customer master imported this phase; AutoHub has no dedicated customer table (CardCode/CardName embedded in document headers only) — see docs/data-consolidation/parts-consolidation.md.', decidedById },
      { entityType: 'SALES_DOCUMENT', fieldName: 'grandTotal', authoritativeSourceSystem: 'MOLAS_CACHE_LUBRICANTS', authorityType: 'FIELD_LEVEL', rationale: 'DocTotal in CacheSalesOrders reconciled exactly (zero variance) against the imported SalesDocument totals — see docs/data-consolidation/sales-reconciliation.md.', decidedById },
      { entityType: 'GARAGE_QUOTATION', authoritativeSourceSystem: 'UNRESOLVED', authorityType: 'UNRESOLVED', rationale: 'No real, reachable Odoo garage-quotation source has been confirmed — see docs/data-sources/odoo-garage-profile.md. Authority remains UNRESOLVED, not assumed, until real access exists.', decidedById },
    ];

    const created = [];
    for (const decision of decisions) {
      created.push(await this.defineAuthority(decision));
    }
    return created;
  }
}
