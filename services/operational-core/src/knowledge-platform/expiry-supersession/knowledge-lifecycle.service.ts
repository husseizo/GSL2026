// DGX Prototype 1.7 — Knowledge Expiry & Supersession (spec §20-21).
//
// Supersession creates a NEW version referencing supersedesVersionId and
// republishes — the append-only chain is never edited in place. Expiry is
// a real date comparison (effectiveUntil in the past), callable on-demand
// (no live scheduler exists in this environment — the same honest
// SCHEDULED_DOC_ONLY-trigger limitation DGX 1.6 already documented for its
// own continuous-evaluation section).
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { KnowledgeItemRegistryService } from '../versioning/knowledge-item-registry.service';
import { computeContentChecksum } from '../versioning/checksum';
import { MetricsService } from '../../observability/metrics.service';

@Injectable()
export class KnowledgeLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly itemRegistry: KnowledgeItemRegistryService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  // A real second version supersedes the currently-published one — the
  // old version's status becomes SUPERSEDED (never deleted, still
  // historically accessible via listVersions()/getById()), and the new
  // version becomes PUBLISHED and current.
  async supersede(oldVersionId: string, newRawContent: string, newTitle: string, actorId?: string, actorRole?: string) {
    const oldVersion = await this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: oldVersionId }, include: { item: true } });
    if (oldVersion.status !== 'PUBLISHED') {
      throw new BadRequestException(`Version ${oldVersionId} must be PUBLISHED before it can be superseded (current status: ${oldVersion.status})`);
    }

    const newVersion = await this.prisma.knowledgeItemVersion.create({
      data: {
        itemId: oldVersion.itemId,
        version: oldVersion.version + 1,
        title: newTitle,
        rawContent: newRawContent,
        contentChecksum: computeContentChecksum(newRawContent),
        status: 'APPROVED', // supersession is itself a reviewed action — the caller already went through review to get here
        authorityLevel: oldVersion.authorityLevel,
        supersedesVersionId: oldVersionId,
        provenance: { supersedesVersionId: oldVersionId, reason: 'supersession' } as object,
        approvedById: actorId,
        approvedAt: new Date(),
      },
    });

    const { version: publishedVersion } = await this.itemRegistry.publish(newVersion.id, actorId, actorRole);

    const supersededOld = await this.prisma.knowledgeItemVersion.update({ where: { id: oldVersionId }, data: { status: 'SUPERSEDED' } });
    const oldDoc = await this.prisma.knowledgeDocument.findUnique({ where: { knowledgeItemVersionId: oldVersionId } });
    if (oldDoc) await this.prisma.knowledgeDocument.update({ where: { id: oldDoc.id }, data: { isApproved: false } });

    await this.audit.log({ action: 'KNOWLEDGE_ITEM_SUPERSEDED', entityType: 'KnowledgeItemVersion', entityId: oldVersionId, beforeState: oldVersion, afterState: { supersededOld, newVersion: publishedVersion }, actorId, actorRole });

    return { supersededVersion: supersededOld, newVersion: publishedVersion };
  }

  // Real date comparison, callable on-demand (see honest scheduler
  // limitation above). Marks any PUBLISHED version whose effectiveUntil is
  // in the past as EXPIRED, and de-approves its materialized
  // KnowledgeDocument so retrieval excludes it — the same lock-step
  // invariant publish()/withdraw() maintain.
  async markExpired(now: Date = new Date()) {
    const expiredCandidates = await this.prisma.knowledgeItemVersion.findMany({
      where: { status: 'PUBLISHED', effectiveUntil: { lt: now } },
    });

    const results = [];
    for (const version of expiredCandidates) {
      const after = await this.prisma.knowledgeItemVersion.update({ where: { id: version.id }, data: { status: 'EXPIRED' } });
      const doc = await this.prisma.knowledgeDocument.findUnique({ where: { knowledgeItemVersionId: version.id } });
      if (doc) await this.prisma.knowledgeDocument.update({ where: { id: doc.id }, data: { isApproved: false } });
      await this.audit.log({ action: 'KNOWLEDGE_ITEM_EXPIRED', entityType: 'KnowledgeItemVersion', entityId: version.id, beforeState: version, afterState: after });
      this.metrics?.recordKnowledgeExpiredItem();
      results.push(after);
    }
    return results;
  }

  // Freshness classification (spec §20) — a pure, real-date-driven
  // classification, not an LLM judgment.
  classifyFreshness(version: { status: string; effectiveUntil: Date | null }, now: Date = new Date()): 'CURRENT' | 'STALE' | 'EXPIRED' | 'SUPERSEDED' | 'WITHDRAWN' | 'UNKNOWN_FRESHNESS' {
    if (version.status === 'SUPERSEDED') return 'SUPERSEDED';
    if (version.status === 'WITHDRAWN') return 'WITHDRAWN';
    if (version.status === 'EXPIRED') return 'EXPIRED';
    if (version.status !== 'PUBLISHED') return 'UNKNOWN_FRESHNESS';
    if (version.effectiveUntil && version.effectiveUntil < now) return 'EXPIRED';
    return 'CURRENT';
  }
}
