// DGX Prototype 1.7 — Knowledge Source Registry (spec §5).
//
// Every real source (internal documentation, internal case-work, real
// catalogue-derived facts) must be registered here before anything can be
// ingested from it. Of the ~10 sub-entities the spec lists, only
// KnowledgeSource is a real table — licenseTerms/accessClassification/
// contactInfo collapse into JSON/string fields since none has an
// independent lifecycle or query pattern that justifies its own table,
// matching the existing KnowledgeDocument.accessPermissions: Json?
// precedent. See docs/knowledge-platform/source-registry.md.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeSourceAuthority, KnowledgeSourceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface RegisterSourceInput {
  name: string;
  publisher?: string;
  provider?: string;
  authority?: KnowledgeSourceAuthority;
  domain?: string;
  accessMethod?: string;
  licenseTerms?: Record<string, unknown>;
  accessClassification?: string;
  allowedInternalUse?: boolean;
  allowedAiUse?: boolean;
  allowedEmbeddingUse?: boolean;
  allowedQuotationUse?: boolean;
  redistributionRestrictions?: string;
  updateFrequency?: string;
  language?: string;
  geographicScope?: string;
  vehicleBrandScope?: string;
  restrictedReason?: string;
  createdById?: string;
  actorRole?: string;
}

@Injectable()
export class KnowledgeSourceRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterSourceInput) {
    const source = await this.prisma.knowledgeSource.create({
      data: {
        name: input.name,
        publisher: input.publisher,
        provider: input.provider,
        authority: input.authority ?? 'UNKNOWN',
        status: 'DISCOVERED',
        domain: input.domain,
        accessMethod: input.accessMethod,
        licenseTerms: input.licenseTerms as object | undefined,
        accessClassification: input.accessClassification,
        allowedInternalUse: input.allowedInternalUse ?? false,
        allowedAiUse: input.allowedAiUse ?? false,
        allowedEmbeddingUse: input.allowedEmbeddingUse ?? false,
        allowedQuotationUse: input.allowedQuotationUse ?? false,
        redistributionRestrictions: input.redistributionRestrictions,
        updateFrequency: input.updateFrequency,
        language: input.language ?? 'en',
        geographicScope: input.geographicScope,
        vehicleBrandScope: input.vehicleBrandScope,
        restrictedReason: input.restrictedReason,
        createdById: input.createdById,
      },
    });

    await this.audit.log({
      action: 'KNOWLEDGE_SOURCE_REGISTERED',
      entityType: 'KnowledgeSource',
      entityId: source.id,
      afterState: source,
      actorId: input.createdById,
      actorRole: input.actorRole,
    });

    return source;
  }

  // Real license verification transition (spec §5's "verified" lifecycle
  // stage) — required before a source above INTERNAL_WORKSHOP authority
  // may have any of its items published (enforced in
  // knowledge-item-registry.service.ts's publish() method, not here).
  async verifyLicense(sourceId: string, reviewerId: string, actorRole?: string) {
    const before = await this.prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });
    const after = await this.prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: 'APPROVED', reviewerId, lastVerifiedAt: new Date() },
    });

    await this.audit.log({
      action: 'KNOWLEDGE_SOURCE_LICENSE_VERIFIED',
      entityType: 'KnowledgeSource',
      entityId: sourceId,
      beforeState: before,
      afterState: after,
      actorId: reviewerId,
      actorRole,
    });

    return after;
  }

  async approveWithRestrictions(sourceId: string, reviewerId: string, restrictedReason: string, actorRole?: string) {
    const before = await this.prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });
    const after = await this.prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: 'APPROVED_WITH_RESTRICTIONS', reviewerId, restrictedReason, lastVerifiedAt: new Date() },
    });
    await this.audit.log({ action: 'KNOWLEDGE_SOURCE_APPROVED_WITH_RESTRICTIONS', entityType: 'KnowledgeSource', entityId: sourceId, beforeState: before, afterState: after, actorId: reviewerId, actorRole });
    return after;
  }

  async reject(sourceId: string, reviewerId: string, reason: string, actorRole?: string) {
    const before = await this.prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });
    const after = await this.prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status: 'REJECTED', reviewerId, restrictedReason: reason } });
    await this.audit.log({ action: 'KNOWLEDGE_SOURCE_REJECTED', entityType: 'KnowledgeSource', entityId: sourceId, beforeState: before, afterState: after, actorId: reviewerId, actorRole });
    return after;
  }

  async suspend(sourceId: string, actorId: string, reason: string, actorRole?: string) {
    const before = await this.prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });
    const after = await this.prisma.knowledgeSource.update({ where: { id: sourceId }, data: { status: 'SUSPENDED', restrictedReason: reason } });
    await this.audit.log({ action: 'KNOWLEDGE_SOURCE_SUSPENDED', entityType: 'KnowledgeSource', entityId: sourceId, beforeState: before, afterState: after, actorId, actorRole });
    return after;
  }

  getById(sourceId: string) {
    return this.prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
  }

  list(filter: { status?: KnowledgeSourceStatus; authority?: KnowledgeSourceAuthority } = {}) {
    return this.prisma.knowledgeSource.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
  }

  // Real, structural gate: a source must be APPROVED or
  // APPROVED_WITH_RESTRICTIONS with a real license-verification pass before
  // any of its items may reach PUBLISHED, UNLESS its authority is
  // INTERNAL_WORKSHOP (real internal documentation/case-work needs no
  // external license). Called by knowledge-item-registry.service.ts before
  // every publish() — see docs/knowledge-platform/licensing-and-copyright.md
  // equivalent, docs/knowledge-platform/source-registry.md.
  async assertPublishEligible(sourceId: string): Promise<void> {
    const source = await this.prisma.knowledgeSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException(`KnowledgeSource ${sourceId} not found`);
    if (source.authority === 'INTERNAL_WORKSHOP') return;
    if (source.status !== 'APPROVED' && source.status !== 'APPROVED_WITH_RESTRICTIONS') {
      throw new BadRequestException(`KnowledgeSource "${source.name}" (authority ${source.authority}) has status ${source.status} — must be license-verified (APPROVED/APPROVED_WITH_RESTRICTIONS) before any of its items may publish, unless authority is INTERNAL_WORKSHOP.`);
    }
  }
}
