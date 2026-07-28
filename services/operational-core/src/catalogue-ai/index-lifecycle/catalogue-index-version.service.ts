import { Injectable, Logger } from '@nestjs/common';
import { CatalogueIndexStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import { stableChecksum } from '../../integration/checksum';
import { classifyIndexEligibility, IndexEligibility } from '../corpus-eligibility';
import { buildLubricantCorpusText, buildPartCorpusText } from './corpus-content-builder';

export interface BuildIndexParams {
  dataSnapshotId?: string;
  maxPartsToIndex?: number;
  maxLubricantsToIndex?: number;
  actorId?: string;
}

export interface BuildIndexResult {
  indexVersion: { id: string; versionNumber: number };
  partsIndexed: number;
  lubricantsIndexed: number;
  exclusions: Record<IndexEligibility, number>;
  embeddingFailures: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Real index lifecycle: build (never overwrites a live index in place) ->
// validate -> evaluate -> approve -> activate (blue-green flip) -> retire
// or roll back. Every query records which index version it used. See
// docs/ai/vector-index-lifecycle.md.
//
// Reuses Phase 4's KnowledgeBaseService.ingestDocument() (real embedding
// via the real DGX/Ollama boundary, real checksum-based chunk dedup)
// unchanged — every catalogue document built here is a real
// KnowledgeDocument/KnowledgeChunk row, not a synthetic stand-in.
@Injectable()
export class CatalogueIndexVersionService {
  private readonly logger = new Logger(CatalogueIndexVersionService.name);

  // Real, measured constraint: AiGatewayService.embed() is gated by
  // RateLimiterService at 30 requests/60s per actorId (see
  // rate-limiter.service.ts) — a real safeguard against runaway usage, not
  // a bug to route around. A tight loop of hundreds of embedding calls
  // under one actorId would blow through that window almost immediately
  // and silently drop most chunks (ingestDocument() discards the
  // chunksFailed count). This paces calls to stay under the real limit
  // instead of bypassing it. See docs/ai/vector-index-lifecycle.md.
  private static readonly EMBED_CALL_INTERVAL_MS = 2100;
  private lastEmbedCallAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeBase: KnowledgeBaseService,
  ) {}

  private async paceEmbedCall(): Promise<void> {
    const elapsed = Date.now() - this.lastEmbedCallAt;
    if (elapsed < CatalogueIndexVersionService.EMBED_CALL_INTERVAL_MS) {
      await sleep(CatalogueIndexVersionService.EMBED_CALL_INTERVAL_MS - elapsed);
    }
    this.lastEmbedCallAt = Date.now();
  }

  // Paced wrapper around KnowledgeBaseService.ingestDocument() — spacing
  // calls at EMBED_CALL_INTERVAL_MS keeps this under the real 30-req/60s
  // limit, so real embedding failures should be rare. When one still
  // happens (chunksCreated === 0), this retries via EmbeddingService's
  // reindexDocument() is NOT usable here (it only re-embeds chunk rows
  // that already exist, and a failed first attempt creates none) — so a
  // failure here is honestly counted rather than silently ignored or
  // papered over with a duplicate-document retry.
  private async ingestWithPacing(docParams: Parameters<KnowledgeBaseService['ingestDocument']>[0]): Promise<{ documentId: string; embedded: boolean }> {
    await this.paceEmbedCall();
    const result = await this.knowledgeBase.ingestDocument(docParams);
    if (result.chunksCreated === 0) {
      this.logger.warn(`Document ${result.document.id} got zero real embedded chunks (chunksFailed=${result.chunksFailed}).`);
    }
    return { documentId: result.document.id, embedded: result.chunksCreated > 0 };
  }

  async buildIndex(params: BuildIndexParams): Promise<BuildIndexResult> {
    this.lastEmbedCallAt = 0;
    const lastVersion = await this.prisma.catalogueIndexVersion.findFirst({ orderBy: { versionNumber: 'desc' } });
    const indexVersion = await this.prisma.catalogueIndexVersion.create({
      data: {
        versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
        dataSnapshotId: params.dataSnapshotId,
        status: CatalogueIndexStatus.BUILDING,
      },
    });

    const exclusions: Record<IndexEligibility, number> = {
      INDEX_ELIGIBLE: 0,
      INDEX_WITH_WARNINGS: 0,
      MANUAL_REVIEW_REQUIRED: 0,
      EXCLUDED_CONFLICT: 0,
      EXCLUDED_LOW_QUALITY: 0,
      EXCLUDED_MISSING_IDENTITY: 0,
    };

    let partsIndexed = 0;
    let embeddingFailures = 0;
    const parts = await this.prisma.part.findMany({
      where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' },
      include: { alternateNumbers: true, externalRefs: true },
      take: params.maxPartsToIndex,
    });

    for (const part of parts) {
      const eligibility = await this.classifyPart(part);
      exclusions[eligibility] += 1;
      if (eligibility === 'EXCLUDED_CONFLICT' || eligibility === 'EXCLUDED_LOW_QUALITY' || eligibility === 'EXCLUDED_MISSING_IDENTITY') continue;

      const content = buildPartCorpusText({
        internalItemCode: part.internalItemCode,
        oemNumber: part.oemNumber,
        alternateNumbers: part.alternateNumbers.map((a) => a.number),
        tecdocArticleId: part.tecdocArticleId,
        brand: part.brand,
        productName: part.productName,
        category: part.category,
        subcategory: part.subcategory,
      });

      const { documentId, embedded } = await this.ingestWithPacing({
        source: 'PARTS_CATALOG_AUTOHUB',
        sourceType: 'PARTS_DOCUMENTATION',
        title: part.productName,
        content,
        confidence: eligibility === 'MANUAL_REVIEW_REQUIRED' ? 0.6 : 1.0,
        partId: part.id,
        isApproved: eligibility !== 'MANUAL_REVIEW_REQUIRED',
        actorId: params.actorId,
      });
      await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { indexVersionId: indexVersion.id } });
      if (!embedded) embeddingFailures += 1;
      partsIndexed += 1;
    }

    let lubricantsIndexed = 0;
    const lubricants = await this.prisma.lubricantProduct.findMany({
      where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' },
      include: { approvals: true },
      take: params.maxLubricantsToIndex,
    });

    for (const product of lubricants) {
      if (!product.productName || product.productName.trim().length === 0) {
        exclusions.EXCLUDED_LOW_QUALITY += 1;
        continue;
      }
      exclusions.INDEX_ELIGIBLE += 1;

      const verifiedApprovals = product.approvals.filter((a) => a.isVerified).map((a) => ({ oemBrand: a.oemBrand, approvalCode: a.approvalCode }));
      const content = buildLubricantCorpusText({
        internalCode: product.internalCode,
        brand: product.brand,
        productName: product.productName,
        category: product.category,
        viscosity: product.viscosity,
        packageSize: product.packageSize?.toString() ?? null,
        packageUnit: product.packageUnit,
        apiClassification: product.apiClassification,
        aceaClassification: product.aceaClassification,
        verifiedApprovals,
      });

      const { documentId, embedded } = await this.ingestWithPacing({
        source: 'MOLAS_CACHE_LUBRICANTS',
        sourceType: 'LUBRICANT_DOCUMENTATION',
        title: product.productName,
        content,
        confidence: verifiedApprovals.length > 0 ? 1.0 : 0.5,
        lubricantProductId: product.id,
        isApproved: true,
        actorId: params.actorId,
      });
      await this.prisma.knowledgeDocument.update({ where: { id: documentId }, data: { indexVersionId: indexVersion.id } });
      if (!embedded) embeddingFailures += 1;
      lubricantsIndexed += 1;
    }

    const corpusChecksum = stableChecksum({ partsIndexed, lubricantsIndexed, versionNumber: indexVersion.versionNumber });

    const updated = await this.prisma.catalogueIndexVersion.update({
      where: { id: indexVersion.id },
      data: {
        status: CatalogueIndexStatus.VALIDATING,
        partsIndexed,
        lubricantsIndexed,
        partsExcluded: exclusions as unknown as object,
        corpusChecksum,
        embeddingModel: 'nomic-embed-text',
        embeddingModelVersion: 1,
      },
    });

    return { indexVersion: { id: updated.id, versionNumber: updated.versionNumber }, partsIndexed, lubricantsIndexed, exclusions, embeddingFailures };
  }

  async validateIndex(indexVersionId: string): Promise<{ valid: boolean; issues: string[] }> {
    const docCount = await this.prisma.knowledgeDocument.count({ where: { indexVersionId } });
    const chunkCount = await this.prisma.knowledgeChunk.count({ where: { document: { indexVersionId } } });
    const issues: string[] = [];
    if (docCount === 0) issues.push('No documents were indexed');
    if (chunkCount === 0) issues.push('No chunks/embeddings were generated');

    await this.prisma.catalogueIndexVersion.update({ where: { id: indexVersionId }, data: { status: CatalogueIndexStatus.VALIDATING, validatedAt: new Date() } });
    return { valid: issues.length === 0, issues };
  }

  async recordEvaluation(indexVersionId: string, metrics: Record<string, unknown>) {
    return this.prisma.catalogueIndexVersion.update({
      where: { id: indexVersionId },
      data: { status: CatalogueIndexStatus.EVALUATING, evaluationMetrics: metrics as object, evaluatedAt: new Date() },
    });
  }

  async approve(indexVersionId: string, approvedById: string) {
    return this.prisma.catalogueIndexVersion.update({
      where: { id: indexVersionId },
      data: { status: CatalogueIndexStatus.APPROVED, approvedById, approvedAt: new Date() },
    });
  }

  // The blue-green flip: the previously ACTIVE version (if any) is RETIRED
  // — its documents remain in the database (never deleted) but stop being
  // the ones new queries are scoped to — and the newly-approved version
  // becomes ACTIVE. Never an in-place overwrite.
  async activate(indexVersionId: string) {
    const toActivate = await this.prisma.catalogueIndexVersion.findUniqueOrThrow({ where: { id: indexVersionId } });
    if (toActivate.status !== CatalogueIndexStatus.APPROVED) {
      throw new Error(`Cannot activate index version ${indexVersionId} — status is ${toActivate.status}, must be APPROVED`);
    }

    const currentlyActive = await this.prisma.catalogueIndexVersion.findFirst({ where: { status: CatalogueIndexStatus.ACTIVE } });
    if (currentlyActive) {
      await this.prisma.catalogueIndexVersion.update({ where: { id: currentlyActive.id }, data: { status: CatalogueIndexStatus.RETIRED, retiredAt: new Date() } });
    }

    return this.prisma.catalogueIndexVersion.update({ where: { id: indexVersionId }, data: { status: CatalogueIndexStatus.ACTIVE, activatedAt: new Date() } });
  }

  async rollback(indexVersionId: string, reactivateVersionId: string) {
    await this.prisma.catalogueIndexVersion.update({ where: { id: indexVersionId }, data: { status: CatalogueIndexStatus.ROLLED_BACK } });
    return this.activate(reactivateVersionId);
  }

  getActiveIndexVersion() {
    return this.prisma.catalogueIndexVersion.findFirst({ where: { status: CatalogueIndexStatus.ACTIVE } });
  }

  private async classifyPart(part: { id: string; oemNumber: string; internalItemCode: string | null; externalRefs: { sourceRecordId: string }[] }): Promise<IndexEligibility> {
    const hasCanonicalId = !!part.id && !!part.oemNumber;
    const hasSourceProvenance = part.externalRefs.length > 0;
    const hasSearchableContent = true; // productName is NOT NULL in the schema — always present

    let hasCriticalIdentityConflict = false;
    let hasMinorConflict = false;
    if (part.externalRefs.length > 1) {
      const rawRecords = await this.prisma.rawSourceRecord.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordKey: { in: part.externalRefs.map((r) => r.sourceRecordId) } } });
      const categories = new Set(rawRecords.map((r) => (r.rawPayload as { part_group?: string }).part_group).filter(Boolean));
      const brands = new Set(rawRecords.map((r) => (r.rawPayload as { supplier_name?: string }).supplier_name).filter(Boolean));
      hasCriticalIdentityConflict = categories.size > 1;
      hasMinorConflict = !hasCriticalIdentityConflict && brands.size > 1;
    }

    return classifyIndexEligibility({
      hasCanonicalId,
      hasSourceProvenance,
      hasSearchableContent,
      hasCriticalIdentityConflict,
      hasMinorConflict,
      accessClassification: 'INTERNAL',
      isActiveOrHistorical: true,
    });
  }
}
