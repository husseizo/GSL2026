// DGX Prototype 1.7 — canonical KnowledgeItem + append-only KnowledgeItemVersion
// (spec §7-8). Direct structural mirror of BenchmarkRegistryService's
// proven append-only-version pattern: `key` is the stable identity,
// `currentVersionId` is the only ever-mutated pointer, and a correction
// always creates version = latest+1 — never edits a published row.
//
// Publish materializes exactly one companion KnowledgeDocument row (see
// prisma/schema.prisma's KnowledgeDocument.knowledgeItemVersionId comment)
// via the existing, unmodified KnowledgeBaseService.ingestDocument() — this
// inherits real chunk/embed/isApproved-gated retrieval for free.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeItemStatus, KnowledgeItemType, KnowledgeSourceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { KnowledgeSourceRegistryService } from '../source-registry/knowledge-source-registry.service';
import { computeContentChecksum } from './checksum';

export interface CreateItemInput {
  key: string;
  itemType: KnowledgeItemType;
  sourceId: string;
  title: string;
  rawContent: string;
  provenance: Record<string, unknown>;
  createdById?: string;
  actorRole?: string;
}

const ITEM_TYPE_TO_SOURCE_TYPE: Partial<Record<KnowledgeItemType, KnowledgeSourceType>> = {
  WORKSHOP_SOP: 'KNOWLEDGE_PLATFORM_PROCEDURE',
  REPAIR_PROCEDURE: 'KNOWLEDGE_PLATFORM_PROCEDURE',
  DIAGNOSTIC_PROCEDURE: 'KNOWLEDGE_PLATFORM_PROCEDURE',
  INSPECTION_PROCEDURE: 'KNOWLEDGE_PLATFORM_PROCEDURE',
  DATA_GOVERNANCE_POLICY: 'KNOWLEDGE_PLATFORM_POLICY',
  AI_GOVERNANCE_POLICY: 'KNOWLEDGE_PLATFORM_POLICY',
  CUSTOMER_SERVICE_POLICY: 'KNOWLEDGE_PLATFORM_POLICY',
  INVENTORY_POLICY: 'KNOWLEDGE_PLATFORM_POLICY',
  PURCHASING_POLICY: 'KNOWLEDGE_PLATFORM_POLICY',
  WARRANTY_RULE: 'KNOWLEDGE_PLATFORM_POLICY',
  TORQUE_SPECIFICATION: 'KNOWLEDGE_PLATFORM_STRUCTURED_FACT',
  FLUID_SPECIFICATION: 'KNOWLEDGE_PLATFORM_STRUCTURED_FACT',
  LUBRICANT_APPROVAL: 'KNOWLEDGE_PLATFORM_STRUCTURED_FACT',
  PART_FITMENT: 'KNOWLEDGE_PLATFORM_STRUCTURED_FACT',
  PART_SUPERSESSION: 'KNOWLEDGE_PLATFORM_STRUCTURED_FACT',
  INTERNAL_CASE_NOTE: 'KNOWLEDGE_PLATFORM_CASE_STUDY',
  REPEAT_REPAIR_CASE: 'KNOWLEDGE_PLATFORM_CASE_STUDY',
};

@Injectable()
export class KnowledgeItemRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly sourceRegistry: KnowledgeSourceRegistryService,
  ) {}

  async createItem(input: CreateItemInput) {
    const existing = await this.prisma.knowledgeItem.findUnique({ where: { key: input.key } });
    if (existing) {
      throw new BadRequestException(`KnowledgeItem key "${input.key}" already exists — use createNewVersion() to publish a correction, never a duplicate key`);
    }

    const source = await this.prisma.knowledgeSource.findUniqueOrThrow({ where: { id: input.sourceId } });
    const item = await this.prisma.knowledgeItem.create({
      data: { key: input.key, itemType: input.itemType, sourceId: input.sourceId, createdById: input.createdById },
    });

    const version = await this.prisma.knowledgeItemVersion.create({
      data: {
        itemId: item.id,
        version: 1,
        title: input.title,
        rawContent: input.rawContent,
        contentChecksum: computeContentChecksum(input.rawContent),
        status: 'DRAFT',
        authorityLevel: source.authority,
        provenance: input.provenance as object,
        createdById: input.createdById,
      },
    });

    await this.audit.log({ action: 'KNOWLEDGE_ITEM_CREATED', entityType: 'KnowledgeItem', entityId: item.id, afterState: { item, version }, actorId: input.createdById, actorRole: input.actorRole });

    return { item, version };
  }

  // Append-only correction — never edits a previously published version.
  async createNewVersion(itemKey: string, updates: { title?: string; rawContent: string; provenance: Record<string, unknown>; createdById?: string; actorRole?: string }) {
    const item = await this.prisma.knowledgeItem.findUnique({ where: { key: itemKey }, include: { source: true } });
    if (!item) throw new NotFoundException(`No KnowledgeItem found with key "${itemKey}"`);

    const latest = await this.prisma.knowledgeItemVersion.findFirst({ where: { itemId: item.id }, orderBy: { version: 'desc' } });
    const version = await this.prisma.knowledgeItemVersion.create({
      data: {
        itemId: item.id,
        version: (latest?.version ?? 0) + 1,
        title: updates.title ?? latest?.title ?? item.key,
        rawContent: updates.rawContent,
        contentChecksum: computeContentChecksum(updates.rawContent),
        status: 'DRAFT',
        authorityLevel: item.source.authority,
        provenance: updates.provenance as object,
        createdById: updates.createdById,
      },
    });

    await this.audit.log({ action: 'KNOWLEDGE_ITEM_VERSION_CREATED', entityType: 'KnowledgeItemVersion', entityId: version.id, afterState: version, actorId: updates.createdById, actorRole: updates.actorRole });
    return version;
  }

  getLatestVersion(itemKey: string) {
    return this.prisma.knowledgeItemVersion.findFirst({ where: { item: { key: itemKey } }, orderBy: { version: 'desc' } });
  }

  async getCurrentVersion(itemKey: string) {
    const item = await this.prisma.knowledgeItem.findUnique({ where: { key: itemKey }, include: { currentVersion: true } });
    return item?.currentVersion ?? null;
  }

  async transitionStatus(versionId: string, status: KnowledgeItemStatus, actorId?: string, actorRole?: string, extra: { reviewedById?: string; approvedById?: string } = {}) {
    const before = await this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId } });
    const data: Record<string, unknown> = { status };
    if (status === 'IN_REVIEW') data.reviewedById = extra.reviewedById;
    if (status === 'IN_REVIEW') data.reviewedAt = new Date();
    if (status === 'APPROVED') {
      data.approvedById = extra.approvedById;
      data.approvedAt = new Date();
    }
    const after = await this.prisma.knowledgeItemVersion.update({ where: { id: versionId }, data });
    await this.audit.log({ action: `KNOWLEDGE_ITEM_VERSION_${status}`, entityType: 'KnowledgeItemVersion', entityId: versionId, beforeState: before, afterState: after, actorId, actorRole });
    return after;
  }

  // Publish (spec's stage 16/18): requires APPROVED status, requires the
  // real source's publish-eligibility gate (license verified, or
  // INTERNAL_WORKSHOP authority), materializes exactly one KnowledgeDocument
  // row via the existing, unmodified KnowledgeBaseService.ingestDocument(),
  // and flips KnowledgeItem.currentVersionId — the only mutable pointer.
  //
  // Real, named fragile invariant (see docs/knowledge-platform/decision-log.md):
  // KnowledgeItemVersion.status and the materialized KnowledgeDocument.isApproved
  // must be kept in lock-step by this method and withdraw() below — no DB
  // constraint enforces this, only this service's own discipline.
  async publish(versionId: string, actorId?: string, actorRole?: string) {
    const version = await this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId }, include: { item: { include: { source: true } } } });
    if (version.status !== 'APPROVED') {
      throw new BadRequestException(`KnowledgeItemVersion ${versionId} must be APPROVED before publish (current status: ${version.status})`);
    }
    await this.sourceRegistry.assertPublishEligible(version.item.sourceId);

    const sourceType = ITEM_TYPE_TO_SOURCE_TYPE[version.item.itemType] ?? 'KNOWLEDGE_PLATFORM_PROCEDURE';
    const { document } = await this.knowledgeBase.ingestDocument({
      source: version.item.source.name,
      sourceType,
      title: version.title,
      content: version.rawContent,
      version: String(version.version),
      copyrightStatus: version.item.source.copyrightStatus,
      language: version.item.source.language,
      isApproved: true,
      actorId,
    });
    await this.prisma.knowledgeDocument.update({ where: { id: document.id }, data: { knowledgeItemVersionId: version.id } });

    const publishedAt = new Date();
    const updatedVersion = await this.prisma.knowledgeItemVersion.update({ where: { id: version.id }, data: { status: 'PUBLISHED', publishedAt } });
    await this.prisma.knowledgeItem.update({ where: { id: version.itemId }, data: { currentVersionId: version.id } });

    await this.audit.log({ action: 'KNOWLEDGE_ITEM_PUBLISHED', entityType: 'KnowledgeItemVersion', entityId: version.id, afterState: { version: updatedVersion, knowledgeDocumentId: document.id }, actorId, actorRole });

    return { version: updatedVersion, knowledgeDocumentId: document.id };
  }

  // Withdraw (spec §21) — the published version's materialized
  // KnowledgeDocument is de-approved in lock-step (the same fragile
  // invariant publish() establishes), so retrieval never serves it again,
  // but the row and its history remain — historically accessible, never
  // deleted.
  async withdraw(versionId: string, reason: string, actorId?: string, actorRole?: string) {
    const version = await this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId } });
    const after = await this.prisma.knowledgeItemVersion.update({ where: { id: versionId }, data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawnReason: reason } });

    const doc = await this.prisma.knowledgeDocument.findUnique({ where: { knowledgeItemVersionId: versionId } });
    if (doc) await this.prisma.knowledgeDocument.update({ where: { id: doc.id }, data: { isApproved: false } });

    const item = await this.prisma.knowledgeItem.findUnique({ where: { id: version.itemId } });
    if (item?.currentVersionId === versionId) {
      await this.prisma.knowledgeItem.update({ where: { id: version.itemId }, data: { currentVersionId: null } });
    }

    await this.audit.log({ action: 'KNOWLEDGE_ITEM_WITHDRAWN', entityType: 'KnowledgeItemVersion', entityId: versionId, beforeState: version, afterState: after, actorId, actorRole });
    return after;
  }

  listVersions(itemKey: string) {
    return this.prisma.knowledgeItemVersion.findMany({ where: { item: { key: itemKey } }, orderBy: { version: 'desc' } });
  }

  async diff(versionAId: string, versionBId: string) {
    const [a, b] = await Promise.all([
      this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionAId } }),
      this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionBId } }),
    ]);
    return {
      versionA: a.version,
      versionB: b.version,
      titleChanged: a.title !== b.title,
      contentChanged: a.contentChecksum !== b.contentChecksum,
      statusA: a.status,
      statusB: b.status,
    };
  }
}
