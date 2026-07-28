// DGX Prototype 1.7 — Immutable Knowledge Snapshot (spec §22).
//
// A NEW, separate model from CatalogueIndexVersion (not reused) — same
// proven build->validate->evaluate->approve->activate->rollback state
// machine shape as CatalogueIndexVersionService, scoped to the broader
// knowledge domain. Activating a snapshot means flipping isApproved on the
// KnowledgeDocument rows materialized for the KnowledgeItemVersions this
// snapshot includes — mirroring exactly how
// CatalogueIndexVersionService.activate() already works, but never
// touching a single CatalogueIndexVersion row.
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { computeBenchmarkChecksum } from '../../ai-benchmark/registry/checksum';

@Injectable()
export class KnowledgeSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Builds a snapshot from every real, currently-PUBLISHED KnowledgeItemVersion
  // — real rows only, never a fabricated set.
  async buildSnapshot(actorId?: string) {
    const lastSnapshot = await this.prisma.knowledgeSnapshot.findFirst({ orderBy: { versionNumber: 'desc' } });
    const publishedVersions = await this.prisma.knowledgeItemVersion.findMany({ where: { status: 'PUBLISHED' } });

    const snapshot = await this.prisma.knowledgeSnapshot.create({
      data: { versionNumber: (lastSnapshot?.versionNumber ?? 0) + 1, status: 'BUILDING', itemVersionsIncluded: publishedVersions.length },
    });

    await this.prisma.knowledgeSnapshotItemVersion.createMany({
      data: publishedVersions.map((v) => ({ snapshotId: snapshot.id, itemVersionId: v.id })),
    });

    const checksum = computeBenchmarkChecksum(publishedVersions.map((v) => v.id));
    const updated = await this.prisma.knowledgeSnapshot.update({ where: { id: snapshot.id }, data: { status: 'VALIDATING', checksum } });

    await this.audit.log({ action: 'KNOWLEDGE_SNAPSHOT_BUILT', entityType: 'KnowledgeSnapshot', entityId: snapshot.id, afterState: updated, actorId });
    return updated;
  }

  async validateSnapshot(snapshotId: string) {
    const snapshot = await this.prisma.knowledgeSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    if (snapshot.itemVersionsIncluded === 0) {
      throw new BadRequestException(`KnowledgeSnapshot ${snapshotId} has zero item versions — cannot validate an empty snapshot`);
    }
    return this.prisma.knowledgeSnapshot.update({ where: { id: snapshotId }, data: { status: 'EVALUATING', validatedAt: new Date() } });
  }

  async recordEvaluation(snapshotId: string, metrics: Record<string, unknown>) {
    return this.prisma.knowledgeSnapshot.update({ where: { id: snapshotId }, data: { status: 'APPROVED', evaluationMetrics: metrics as object, evaluatedAt: new Date() } });
  }

  // DGX Prototype 1.7.1 — real, additive precondition for THIS phase's
  // trusted-knowledge quality gates (spec §33). Merges into whatever
  // evaluationMetrics already exists (never overwrites recordEvaluation()'s
  // own data) under a distinct `trustedKnowledgeGates` key — activate()
  // below only enforces this key when it's actually present, so every
  // existing DGX 1.7 snapshot flow (which never sets this key) is
  // completely unaffected.
  async recordTrustedKnowledgeGates(snapshotId: string, gateResults: unknown, allPass: boolean) {
    const snapshot = await this.prisma.knowledgeSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    const existingMetrics = (snapshot.evaluationMetrics as Record<string, unknown>) ?? {};
    return this.prisma.knowledgeSnapshot.update({
      where: { id: snapshotId },
      data: { evaluationMetrics: { ...existingMetrics, trustedKnowledgeGates: { results: gateResults, allPass } } as object },
    });
  }

  async approve(snapshotId: string, approvedById: string, actorRole?: string) {
    const before = await this.prisma.knowledgeSnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    const after = await this.prisma.knowledgeSnapshot.update({ where: { id: snapshotId }, data: { status: 'APPROVED', approvedById, approvedAt: new Date() } });
    await this.audit.log({ action: 'KNOWLEDGE_SNAPSHOT_APPROVED', entityType: 'KnowledgeSnapshot', entityId: snapshotId, beforeState: before, afterState: after, actorId: approvedById, actorRole });
    return after;
  }

  // The blue-green flip: throws unless status is APPROVED; demotes
  // whichever snapshot is currently ACTIVE to RETIRED; promotes the target
  // to ACTIVE. Every KnowledgeDocument materialized for this snapshot's
  // item versions gets isApproved=true; every other Knowledge-Platform-
  // sourced KnowledgeDocument (from a prior, now-retired snapshot) gets
  // isApproved=false — so retrieval only ever serves the active snapshot's
  // content, never a stale or draft one.
  async activate(snapshotId: string, actorId?: string, actorRole?: string) {
    const target = await this.prisma.knowledgeSnapshot.findUniqueOrThrow({ where: { id: snapshotId }, include: { itemVersions: true } });
    if (target.status !== 'APPROVED') {
      throw new BadRequestException(`KnowledgeSnapshot ${snapshotId} must be APPROVED before activation (current status: ${target.status})`);
    }
    // Real, additive precondition (spec §33) — only enforced when this
    // phase's trusted-knowledge gates were actually recorded for this
    // snapshot (see recordTrustedKnowledgeGates() above); every existing
    // DGX 1.7 snapshot flow, which never sets this key, is unaffected.
    const trustedKnowledgeGates = (target.evaluationMetrics as { trustedKnowledgeGates?: { allPass: boolean } } | null)?.trustedKnowledgeGates;
    if (trustedKnowledgeGates && !trustedKnowledgeGates.allPass) {
      throw new BadRequestException(`KnowledgeSnapshot ${snapshotId} failed one or more real trusted-knowledge quality gates — activation blocked. See evaluationMetrics.trustedKnowledgeGates.results.`);
    }

    const currentActive = await this.prisma.knowledgeSnapshot.findFirst({ where: { status: 'ACTIVE' }, include: { itemVersions: true } });
    if (currentActive) {
      await this.prisma.knowledgeSnapshot.update({ where: { id: currentActive.id }, data: { status: 'RETIRED', retiredAt: new Date() } });
      const staleVersionIds = currentActive.itemVersions.map((v) => v.itemVersionId);
      if (staleVersionIds.length > 0) {
        await this.prisma.knowledgeDocument.updateMany({ where: { knowledgeItemVersionId: { in: staleVersionIds } }, data: { isApproved: false } });
      }
    }

    const activeVersionIds = target.itemVersions.map((v) => v.itemVersionId);
    if (activeVersionIds.length > 0) {
      await this.prisma.knowledgeDocument.updateMany({ where: { knowledgeItemVersionId: { in: activeVersionIds } }, data: { isApproved: true } });
    }

    const after = await this.prisma.knowledgeSnapshot.update({ where: { id: snapshotId }, data: { status: 'ACTIVE', activatedAt: new Date() } });
    await this.audit.log({ action: 'KNOWLEDGE_SNAPSHOT_ACTIVATED', entityType: 'KnowledgeSnapshot', entityId: snapshotId, afterState: after, actorId, actorRole });
    return after;
  }

  async rollback(badSnapshotId: string, reactivateSnapshotId: string, actorId?: string, actorRole?: string) {
    await this.prisma.knowledgeSnapshot.update({ where: { id: badSnapshotId }, data: { status: 'ROLLED_BACK' } });
    const reactivated = await this.activate(reactivateSnapshotId, actorId, actorRole);
    await this.audit.log({ action: 'KNOWLEDGE_SNAPSHOT_ROLLED_BACK', entityType: 'KnowledgeSnapshot', entityId: badSnapshotId, afterState: { reactivatedSnapshotId: reactivateSnapshotId }, actorId, actorRole });
    return reactivated;
  }

  getActiveSnapshot() {
    return this.prisma.knowledgeSnapshot.findFirst({ where: { status: 'ACTIVE' } });
  }

  async verifyChecksum(snapshotId: string) {
    const snapshot = await this.prisma.knowledgeSnapshot.findUniqueOrThrow({ where: { id: snapshotId }, include: { itemVersions: true } });
    const recomputed = computeBenchmarkChecksum(snapshot.itemVersions.map((v) => v.itemVersionId));
    return { matches: snapshot.checksum === recomputed, storedChecksum: snapshot.checksum, recomputedChecksum: recomputed };
  }
}
