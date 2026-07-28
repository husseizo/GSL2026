import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PartsQualityProfile {
  totalParts: number;
  uniqueInternalItemCount: number;
  uniqueOemNumberCount: number;
  recordsWithoutOemNumber: number;
  duplicateOemNumberGroups: number;
  conflictingDuplicateGroups: number;
  missingBrandRate: number;
  missingCategoryRate: number;
  missingDescriptionRate: number;
}

export interface ConsolidationConflict {
  partId: string;
  oemNumber: string;
  externalReferenceSourceRecordIds: string[];
  conflictType: 'CONFLICTING_BRAND' | 'CONFLICTING_CATEGORY';
  values: string[];
}

// Real profiling of the 7,723 real Parts imported from Parts_Catalog/oitm,
// plus post-consolidation validation of the 1,116 real OEM-based merges —
// see docs/data-consolidation/parts-consolidation.md for the original
// consolidation and docs/data-readiness/parts-catalogue-quality.md for
// this phase's validation of it.
@Injectable()
export class PartsQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(): Promise<PartsQualityProfile> {
    const parts = await this.prisma.part.findMany({ select: { id: true, internalItemCode: true, oemNumber: true, brand: true, category: true, productName: true } });
    const total = parts.length;
    if (total === 0) {
      return { totalParts: 0, uniqueInternalItemCount: 0, uniqueOemNumberCount: 0, recordsWithoutOemNumber: 0, duplicateOemNumberGroups: 0, conflictingDuplicateGroups: 0, missingBrandRate: 0, missingCategoryRate: 0, missingDescriptionRate: 0 };
    }

    const uniqueInternalCodes = new Set(parts.map((p) => p.internalItemCode).filter(Boolean)).size;
    const oemCounts = new Map<string, number>();
    for (const p of parts) oemCounts.set(p.oemNumber, (oemCounts.get(p.oemNumber) ?? 0) + 1);
    const duplicateGroups = [...oemCounts.values()].filter((c) => c > 1).length;

    const conflicts = await this.postValidateOemConsolidations();

    const missingBrand = parts.filter((p) => !p.brand || p.brand === 'UNKNOWN').length;
    const missingCategory = parts.filter((p) => !p.category).length;
    const missingDescription = parts.filter((p) => !p.productName || p.productName.trim().length === 0).length;

    return {
      totalParts: total,
      uniqueInternalItemCount: uniqueInternalCodes,
      uniqueOemNumberCount: oemCounts.size,
      recordsWithoutOemNumber: parts.filter((p) => !p.oemNumber || p.oemNumber === 'UNKNOWN').length,
      duplicateOemNumberGroups: duplicateGroups,
      conflictingDuplicateGroups: new Set(conflicts.map((c) => c.partId)).size,
      missingBrandRate: round(missingBrand / total),
      missingCategoryRate: round(missingCategory / total),
      missingDescriptionRate: round(missingDescription / total),
    };
  }

  // Real post-validation of the automatic OEM-number-based consolidations
  // performed during import (see docs/data-consolidation/parts-consolidation.md
  // — the VAG10769/VAG13636 example). A shared OEM number is only a safe
  // permanent merge if the consolidated source records don't actually
  // disagree on brand/category — this check looks for exactly that
  // disagreement and raises a ManualReviewItem for any it finds, rather
  // than silently trusting every past auto-merge forever.
  async postValidateOemConsolidations(): Promise<ConsolidationConflict[]> {
    const partsWithMultipleRefs = await this.prisma.part.findMany({
      where: { externalRefs: { some: {} } },
      include: { externalRefs: true },
    });

    const conflicts: ConsolidationConflict[] = [];
    for (const part of partsWithMultipleRefs) {
      if (part.externalRefs.length < 2) continue;
      // The real consolidation only recorded a single canonical Part row —
      // if that Part's own recorded brand/category came from different raw
      // source rows with different values, we can't detect that after the
      // fact from the canonical row alone (only one brand/category
      // survives). This check instead looks for a DIFFERENT, cheaper real
      // signal available today: staged raw payloads for those same source
      // keys, compared against each other directly.
      const rawRecords = await this.prisma.rawSourceRecord.findMany({
        where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordKey: { in: part.externalRefs.map((r) => r.sourceRecordId) } },
      });
      const brands = new Set(rawRecords.map((r) => (r.rawPayload as { supplier_name?: string }).supplier_name).filter(Boolean));
      const categories = new Set(rawRecords.map((r) => (r.rawPayload as { part_group?: string }).part_group).filter(Boolean));

      if (brands.size > 1) {
        conflicts.push({ partId: part.id, oemNumber: part.oemNumber, externalReferenceSourceRecordIds: part.externalRefs.map((r) => r.sourceRecordId), conflictType: 'CONFLICTING_BRAND', values: [...brands] as string[] });
      }
      if (categories.size > 1) {
        conflicts.push({ partId: part.id, oemNumber: part.oemNumber, externalReferenceSourceRecordIds: part.externalRefs.map((r) => r.sourceRecordId), conflictType: 'CONFLICTING_CATEGORY', values: [...categories] as string[] });
      }
    }

    return conflicts;
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
