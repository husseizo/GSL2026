// DGX Prototype 1.7.1 — machine-enforced source permission matrix (spec §7).
// Additive to (never a replacement of) KnowledgeSource's existing
// allowedAiUse/allowedEmbeddingUse/allowedQuotationUse booleans, which
// assertPublishEligible()/searchKnowledge() already enforce. Real call sites
// must check both this matrix AND those booleans (AND logic) — see
// assertActionAllowedAndLegacyFlag() below, the one function that combines
// them, so the two enforcement surfaces can never silently drift apart.
import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { KnowledgeSourceAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { MetricsService } from '../../observability/metrics.service';

export const ALL_KNOWLEDGE_SOURCE_ACTIONS: KnowledgeSourceAction[] = [
  'STORE_ORIGINAL',
  'PARSE',
  'EXTRACT_METADATA',
  'EXTRACT_STRUCTURED_FACTS',
  'CREATE_SEARCH_INDEX',
  'CREATE_EMBEDDINGS',
  'USE_FOR_RAG',
  'DISPLAY_TO_INTERNAL_USER',
  'DISPLAY_EXCERPT',
  'EXPORT',
  'REDISTRIBUTE',
  'USE_FOR_MODEL_TRAINING',
  'USE_FOR_FINE_TUNING',
];

@Injectable()
export class KnowledgeSourcePermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async setPermission(sourceId: string, action: KnowledgeSourceAction, allowed: boolean, reason?: string, setById?: string) {
    const after = await this.prisma.knowledgeSourcePermission.upsert({
      where: { sourceId_action: { sourceId, action } },
      create: { sourceId, action, allowed, reason, setById },
      update: { allowed, reason, setById, setAt: new Date() },
    });
    await this.audit.log({ action: 'KNOWLEDGE_SOURCE_PERMISSION_SET', entityType: 'KnowledgeSourcePermission', entityId: after.id, afterState: after, actorId: setById });
    return after;
  }

  // Sets every action's allowed flag in one real call — used at source
  // registration time so a source never has a partially-configured matrix.
  async setPermissionMatrix(sourceId: string, allowedActions: KnowledgeSourceAction[], reason: string, setById?: string) {
    const results = [];
    for (const action of ALL_KNOWLEDGE_SOURCE_ACTIONS) {
      results.push(await this.setPermission(sourceId, action, allowedActions.includes(action), reason, setById));
    }
    return results;
  }

  listBySource(sourceId: string) {
    return this.prisma.knowledgeSourcePermission.findMany({ where: { sourceId }, orderBy: { action: 'asc' } });
  }

  // The real enforcement point (spec §7). Never treats RAG permission as
  // training permission, never treats internal-viewing permission as
  // embedding permission — every action is checked independently.
  async assertActionAllowed(sourceId: string, action: KnowledgeSourceAction): Promise<void> {
    const permission = await this.prisma.knowledgeSourcePermission.findUnique({ where: { sourceId_action: { sourceId, action } } });
    if (!permission || !permission.allowed) {
      this.metrics?.recordKnowledgePermissionDenial(action);
      throw new ForbiddenException(`KnowledgeSource ${sourceId} does not have real, granted permission for action ${action}${permission?.reason ? ` (${permission.reason})` : ''}.`);
    }
  }

  // The combined real gate: checks the NEW action-matrix AND the EXISTING
  // boolean field together (AND logic), so the two enforcement surfaces
  // can never silently disagree. `legacyFlag` is whatever boolean value the
  // caller already read off KnowledgeSource (e.g. source.allowedAiUse).
  async assertActionAllowedAndLegacyFlag(sourceId: string, action: KnowledgeSourceAction, legacyFlag: boolean): Promise<void> {
    if (!legacyFlag) {
      throw new ForbiddenException(`KnowledgeSource ${sourceId}'s legacy boolean flag does not permit ${action}.`);
    }
    await this.assertActionAllowed(sourceId, action);
  }

  async getById(sourceId: string) {
    const source = await this.prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException(`KnowledgeSource ${sourceId} not found`);
    return source;
  }
}
