import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SourceCodeProfile {
  sourceSystem: string;
  sourceCode: string;
  transactionCount: number;
  mappingStatus: 'VERIFIED' | 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'CONFLICT' | 'UNMAPPED' | 'RETIRED';
  candidateWarehouseCodes: string[];
}

// Real analysis of the source warehouse/branch codes actually seen in
// imported real data, against this platform's real, existing Warehouse/
// Branch rows (Phase 2). Per the phase's explicit rule, never maps by
// name-similarity alone — only exact source-code matches are ever marked
// VERIFIED/HIGH_CONFIDENCE automatically; everything else is left
// REVIEW_REQUIRED/UNMAPPED with the real transaction-count evidence
// attached for a human to decide. See docs/data-readiness/branch-warehouse-mapping.md.
@Injectable()
export class BranchWarehouseMappingService {
  constructor(private readonly prisma: PrismaService) {}

  // Real warehouse codes seen in MolasCacheDb.CacheProducts.WarehouseCode
  // during profiling (see docs/data-sources/molas-cache-db-profile.md) —
  // re-queried live here rather than hardcoded, since the real source may
  // have gained/lost codes since that profiling run.
  async profileLubricantsWarehouseCodes(): Promise<SourceCodeProfile[]> {
    const rawRecords = await this.prisma.rawSourceRecord.findMany({ where: { feedName: 'MOLAS_CACHE_LUBRICANTS_ITEMS' } });
    const codeCounts = new Map<string, number>();
    for (const r of rawRecords) {
      const code = (r.rawPayload as { WarehouseCode?: string }).WarehouseCode;
      if (code) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }

    const existingWarehouseCodes = new Set((await this.prisma.warehouse.findMany({ select: { code: true } })).map((w) => w.code));

    return [...codeCounts.entries()].map(([sourceCode, transactionCount]) => ({
      sourceSystem: 'MOLAS_CACHE_LUBRICANTS',
      sourceCode,
      transactionCount,
      mappingStatus: existingWarehouseCodes.has(sourceCode) ? ('VERIFIED' as const) : ('UNMAPPED' as const),
      candidateWarehouseCodes: [...existingWarehouseCodes],
    }));
  }

  // Persists the analysis above as real WarehouseExternalReference rows
  // (extended in this phase with mappingConfidence/evidence) — only when a
  // real canonical warehouse is provided by a human does this create a
  // resolved mapping; otherwise it records the source code as seen but
  // unmapped, so the gap is visible rather than silently absent.
  async recordUnmappedSourceCode(sourceSystem: string, sourceCode: string, transactionCount: number) {
    const placeholderWarehouse = await this.prisma.warehouse.findFirst();
    if (!placeholderWarehouse) return null;

    // An UNMAPPED record still needs a warehouseId FK — using the first
    // real warehouse as a placeholder target would misattribute real data,
    // so UNMAPPED codes are recorded in the evidence-only conflict log
    // instead of a WarehouseExternalReference row. See
    // docs/data-readiness/decision-log.md "Why unmapped source codes are
    // not given a placeholder warehouse".
    return this.prisma.authorityConflict.create({
      data: {
        entityType: 'WAREHOUSE_MAPPING',
        fieldName: sourceCode,
        conflictingSources: [{ sourceSystem, sourceCode, transactionCount, status: 'UNMAPPED' }] as object,
      },
    });
  }

  async confirmMapping(sourceSystem: string, sourceCode: string, warehouseId: string, evidence: Record<string, unknown>, reviewedById: string) {
    return this.prisma.warehouseExternalReference.upsert({
      where: { sourceSystem_sourceCode: { sourceSystem, sourceCode } },
      create: { sourceSystem, sourceCode, warehouseId, mappingConfidence: 'VERIFIED', evidence: evidence as object, reviewedById, reviewedAt: new Date(), effectiveFrom: new Date() },
      update: { warehouseId, mappingConfidence: 'VERIFIED', evidence: evidence as object, reviewedById, reviewedAt: new Date() },
    });
  }

  async listUnverifiedMappings() {
    return this.prisma.warehouseExternalReference.findMany({ where: { mappingConfidence: { in: ['UNMAPPED', 'REVIEW_REQUIRED', 'CONFLICT'] } } });
  }
}
