import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { standardizeProductName } from '../../parts/normalize';
import { EntitySyncHandler, ValidationResult } from '../entity-sync-handler.interface';
import { stableChecksum } from '../checksum';

// Shape assumed for a nightly export from the legacy sales/ERP parts table.
export interface LegacyPartRaw {
  oem_no: string;
  description: string;
  brand?: string;
  category?: string;
}

export interface NormalizedPart {
  oemNumber: string;
  productName: string;
  standardizedProductName: string;
  brand?: string;
  category?: string;
}

@Injectable()
export class PartSyncHandler implements EntitySyncHandler<LegacyPartRaw, NormalizedPart> {
  readonly entityType = 'PART' as const;

  constructor(private readonly prisma: PrismaService) {}

  validate(raw: LegacyPartRaw): ValidationResult {
    if (!raw.oem_no?.trim()) return { valid: false, error: 'oem_no is required' };
    if (!raw.description?.trim()) return { valid: false, error: 'description is required' };
    return { valid: true };
  }

  normalize(raw: LegacyPartRaw): NormalizedPart {
    return {
      oemNumber: raw.oem_no.trim(),
      productName: raw.description.trim(),
      standardizedProductName: standardizeProductName(raw.description),
      brand: raw.brand?.trim() || undefined,
      category: raw.category?.trim() || undefined,
    };
  }

  checksum(normalized: NormalizedPart): string {
    return stableChecksum(normalized);
  }

  async getExistingChecksum(sourceSystem: string, sourceRecordId: string): Promise<string | null> {
    const existing = await this.prisma.part.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
    });
    return existing?.checksum ?? null;
  }

  async upsert(params: {
    sourceSystem: string;
    sourceRecordId: string;
    recordVersion?: string;
    checksum: string;
    normalized: NormalizedPart;
  }): Promise<void> {
    const { sourceSystem, sourceRecordId, recordVersion, checksum, normalized } = params;
    await this.prisma.part.upsert({
      where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
      create: {
        ...normalized,
        sourceSystem,
        sourceRecordId,
        externalId: normalized.oemNumber,
        syncedAt: new Date(),
        recordVersion,
        checksum,
      },
      update: {
        ...normalized,
        externalId: normalized.oemNumber,
        syncedAt: new Date(),
        recordVersion,
        checksum,
      },
    });
  }
}
