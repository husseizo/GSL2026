// DGX Prototype 1.7 — stages 5-6: real duplicate and version detection,
// against actual persisted KnowledgeItemVersion rows (spec §16).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { computeContentChecksum } from '../../versioning/checksum';

export type DedupOutcome = 'NO_EXISTING_ITEM' | 'EXACT_DUPLICATE' | 'NEW_VERSION';

export interface DedupResult {
  outcome: DedupOutcome;
  existingVersionId: string | null;
  checksum: string;
}

@Injectable()
export class DedupVersionDetectStage {
  constructor(private readonly prisma: PrismaService) {}

  async run(itemKey: string, rawContent: string): Promise<DedupResult> {
    const checksum = computeContentChecksum(rawContent);
    const item = await this.prisma.knowledgeItem.findUnique({ where: { key: itemKey } });
    if (!item) {
      return { outcome: 'NO_EXISTING_ITEM', existingVersionId: null, checksum };
    }

    const latest = await this.prisma.knowledgeItemVersion.findFirst({ where: { itemId: item.id }, orderBy: { version: 'desc' } });
    if (latest && latest.contentChecksum === checksum) {
      return { outcome: 'EXACT_DUPLICATE', existingVersionId: latest.id, checksum };
    }
    return { outcome: 'NEW_VERSION', existingVersionId: latest?.id ?? null, checksum };
  }
}
