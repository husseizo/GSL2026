// DGX Prototype 1.7.1 — real ETL orchestration from the two already-
// integrated company databases (spec §4 Priority A/B, §15). Composes the
// EXISTING, unmodified data-consolidation adapters and the EXISTING,
// unmodified IngestionPipelineService — this file is glue, not new
// connectivity or a parallel ingestion path. Every record's full provenance
// (database/table/primary key/source timestamp/checksum) is captured
// directly from the adapter's own RawChangeRecord shape. Read-only against
// both external databases (inherited discipline from data-consolidation,
// not re-implemented here).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { stableChecksum } from '../../integration/checksum';
import { MolasLubricantsCacheAdapter } from '../../data-consolidation/adapters/molas-lubricants-cache.adapter';
import { PartsCatalogAutoHubAdapter } from '../../data-consolidation/adapters/parts-catalog-autohub.adapter';
import { KnowledgeSourceRegistryService } from '../source-registry/knowledge-source-registry.service';
import { KnowledgeSourcePermissionService, ALL_KNOWLEDGE_SOURCE_ACTIONS } from '../permissions/knowledge-source-permission.service';
import { IngestionPipelineService } from '../ingestion/ingestion-pipeline.service';
import { StructuredFactService } from '../structured-facts/structured-fact.service';
import { KnowledgeGraphService } from '../graph/knowledge-graph.service';
import { LIQUI_MOLY_FEED_CONFIG, TECDOC_ARTICLE_FEED_CONFIG, TECDOC_ARTICLE_VEHICLE_FEED_CONFIG } from './source-configs';
import { buildLiquiMolySummaryText, extractLiquiMolyFacts, LiquiMolyProductRow } from './liqui-moly-extraction';
import { buildTecdocArticleSummaryText, extractTecdocArticleFacts, buildFitmentGraphEdge, TecdocArticleRow, TecdocArticleVehicleRow } from './tecdoc-fitment-extraction';
import { classifyDiagnosticSession, classifyInspectionResult, buildDiagnosticSessionSummaryText, buildInspectionResultSummaryText } from './repair-case-extraction';

// Internal-use-only actions the user's real decision permits for these two
// sources (see the plan's Context section): real AI use/embedding for
// internal retrieval, no export/redistribution/training pending a real
// external license review.
const INTERNAL_USE_ALLOWED_ACTIONS = ['STORE_ORIGINAL', 'PARSE', 'EXTRACT_METADATA', 'EXTRACT_STRUCTURED_FACTS', 'CREATE_SEARCH_INDEX', 'CREATE_EMBEDDINGS', 'USE_FOR_RAG', 'DISPLAY_TO_INTERNAL_USER', 'DISPLAY_EXCERPT'] as const;

export interface StructuredIngestionResult {
  sourceId: string;
  itemsCreated: number;
  factsCreated: number;
  skipped: number;
}

@Injectable()
export class StructuredSourceIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sourceRegistry: KnowledgeSourceRegistryService,
    private readonly sourcePermissions: KnowledgeSourcePermissionService,
    private readonly pipeline: IngestionPipelineService,
    private readonly structuredFacts: StructuredFactService,
    private readonly graph: KnowledgeGraphService,
  ) {}

  // Registers a real KnowledgeSource (idempotent — reuses an existing row
  // with the same name) and applies the user's real, confirmed internal-
  // use-only permission decision to every one of the 13 real actions.
  private async ensureInternalSource(name: string, actorId?: string) {
    const existing = await this.prisma.knowledgeSource.findUnique({ where: { name } });
    const source = existing ?? (await this.sourceRegistry.register({ name, authority: 'INTERNAL_WORKSHOP', allowedAiUse: true, allowedEmbeddingUse: true, allowedQuotationUse: false, createdById: actorId }));
    await this.sourcePermissions.setPermissionMatrix(
      source.id,
      ALL_KNOWLEDGE_SOURCE_ACTIONS.filter((a) => (INTERNAL_USE_ALLOWED_ACTIONS as readonly string[]).includes(a)),
      'Company-owned internal operational data (own SAP<->Odoo lubricants bridge / AutoHub+TecDoc catalogue) — internal AI use/embedding allowed, export/redistribution/training denied pending a real external license review.',
      actorId,
    );
    return source;
  }

  async ingestLiquiMolyProducts(actorId?: string): Promise<StructuredIngestionResult> {
    const source = await this.ensureInternalSource('MOLAS_CACHE_LUBRICANTS', actorId);
    const adapter = new MolasLubricantsCacheAdapter(LIQUI_MOLY_FEED_CONFIG);

    let itemsCreated = 0;
    let factsCreated = 0;
    let skipped = 0;

    for await (const batch of adapter.fetchChanges(null)) {
      for (const record of batch.records) {
        const row = record.payload as unknown as LiquiMolyProductRow;
        const checksum = stableChecksum(record.payload);
        const summaryText = buildLiquiMolySummaryText(row);
        if (summaryText.trim().length === 0) {
          skipped += 1;
          continue;
        }

        const result = await this.pipeline.ingest({
          itemKey: `liqui-moly-${row.ArticleNumber}`,
          sourceId: source.id,
          format: 'text',
          rawContent: summaryText,
          fallbackTitle: `Liqui Moly ${row.ArticleNumber}`,
          itemTypeOverride: 'LUBRICANT_APPROVAL',
          createdById: actorId,
        });
        if (result.quarantined || !result.itemId || !result.versionId) {
          skipped += 1;
          continue;
        }
        itemsCreated += 1;

        await this.recordProvenance(result.versionId, { database: 'MolasCacheDb', table: 'dbo.CacheLiquiMolyProducts', primaryKeyColumn: 'ArticleNumber', primaryKeyValue: row.ArticleNumber, sourceTimestamp: record.sourceTimestamp.toISOString(), checksum, extractedAt: batch.cursor });

        for (const fact of extractLiquiMolyFacts(row)) {
          await this.structuredFacts.createFact({ itemId: result.itemId, versionId: result.versionId, factType: fact.factType, value: fact.value, unit: fact.unit, conditions: fact.conditions, extractedBy: 'PARSER_DETERMINISTIC', createdById: actorId });
          factsCreated += 1;
        }
      }
    }

    await this.audit.log({ action: 'STRUCTURED_INGESTION_COMPLETED', entityType: 'KnowledgeSource', entityId: source.id, afterState: { itemsCreated, factsCreated, skipped }, actorId });
    return { sourceId: source.id, itemsCreated, factsCreated, skipped };
  }

  async ingestTecdocArticles(actorId?: string): Promise<StructuredIngestionResult> {
    const source = await this.ensureInternalSource('PARTS_CATALOG_AUTOHUB_TECDOC', actorId);
    const adapter = new PartsCatalogAutoHubAdapter(TECDOC_ARTICLE_FEED_CONFIG);

    let itemsCreated = 0;
    let factsCreated = 0;
    let skipped = 0;

    for await (const batch of adapter.fetchChanges(null)) {
      for (const record of batch.records) {
        const row = record.payload as unknown as TecdocArticleRow;
        const checksum = stableChecksum(record.payload);
        const summaryText = buildTecdocArticleSummaryText(row);

        const result = await this.pipeline.ingest({
          itemKey: `tecdoc-article-${row.tecdoc_article_id}`,
          sourceId: source.id,
          format: 'text',
          rawContent: summaryText,
          fallbackTitle: `TecDoc article ${row.tecdoc_article_id}`,
          itemTypeOverride: 'PRODUCT_TECHNICAL_DATA',
          createdById: actorId,
        });
        if (result.quarantined || !result.itemId || !result.versionId) {
          skipped += 1;
          continue;
        }
        itemsCreated += 1;

        await this.recordProvenance(result.versionId, { database: 'Parts_Catalog', table: 'tecdoc_article', primaryKeyColumn: 'tecdoc_article_id', primaryKeyValue: row.tecdoc_article_id, sourceTimestamp: record.sourceTimestamp.toISOString(), checksum, extractedAt: batch.cursor });

        // Real graph presence for this part — a KNOWLEDGE_ITEM node (this
        // item) and a PART node (keyed by the real tecdoc_article_id, the
        // same key the fitment-edge sampling below uses), connected by the
        // existing REFERENCES edge type.
        const itemNode = await this.graph.upsertNode('KNOWLEDGE_ITEM', result.itemId, summaryText.slice(0, 120));
        const partNode = await this.graph.upsertNode('PART', String(row.tecdoc_article_id), row.name);
        await this.graph.upsertEdge(itemNode.id, partNode.id, 'REFERENCES');

        for (const fact of extractTecdocArticleFacts(row)) {
          await this.structuredFacts.createFact({ itemId: result.itemId, versionId: result.versionId, factType: fact.factType, value: fact.value, unit: fact.unit, extractedBy: 'PARSER_DETERMINISTIC', createdById: actorId });
          factsCreated += 1;
        }
      }
    }

    await this.audit.log({ action: 'STRUCTURED_INGESTION_COMPLETED', entityType: 'KnowledgeSource', entityId: source.id, afterState: { itemsCreated, factsCreated, skipped }, actorId });
    return { sourceId: source.id, itemsCreated, factsCreated, skipped };
  }

  // Bounded, deterministic fitment-edge sample (see source-configs.ts's
  // TECDOC_FITMENT_EDGE_CAP) — real graph edges, never routed through the
  // item/claim/review pipeline (fitment triples are not reviewable prose).
  // Bypasses the generic adapter's fetchChanges() for this one table only,
  // since the existing adapter has no article-set-scoping mechanism beyond
  // its own additive `limit` field, which is exactly what's used here.
  async ingestTecdocFitmentEdges(actorId?: string): Promise<{ sourceId: string; edgesCreated: number }> {
    const source = await this.ensureInternalSource('PARTS_CATALOG_AUTOHUB_TECDOC', actorId);
    const adapter = new PartsCatalogAutoHubAdapter(TECDOC_ARTICLE_VEHICLE_FEED_CONFIG);

    let edgesCreated = 0;
    for await (const batch of adapter.fetchChanges(null)) {
      for (const record of batch.records) {
        const row = record.payload as unknown as TecdocArticleVehicleRow;
        const edge = buildFitmentGraphEdge(row);
        const partNode = await this.graph.upsertNode('PART', edge.partRefId, edge.partRefId);
        const vehicleNode = await this.graph.upsertNode('VEHICLE', edge.vehicleRefId, edge.vehicleLabel);
        await this.graph.upsertEdge(partNode.id, vehicleNode.id, 'FITS');
        edgesCreated += 1;
      }
    }

    await this.audit.log({ action: 'STRUCTURED_INGESTION_FITMENT_EDGES_COMPLETED', entityType: 'KnowledgeSource', entityId: source.id, afterState: { edgesCreated }, actorId });
    return { sourceId: source.id, edgesCreated };
  }

  // Real (if tiny) internal repair-case knowledge (spec §38) — direct
  // Prisma reads, no external adapter (these rows already live in
  // aios_operational). Only VERIFIED_RESOLUTION cases are marked as such in
  // provenance; the retrieval layer/review workflow is what actually
  // decides default surfacing, this function just classifies honestly.
  async ingestRepairCases(actorId?: string): Promise<StructuredIngestionResult> {
    const source = await this.ensureInternalSource('GARAGE_VERIFIED_REPAIR_CASES', actorId);

    let itemsCreated = 0;
    let skipped = 0;

    const sessions = await this.prisma.diagnosticSession.findMany({ include: { codes: true } });
    for (const session of sessions) {
      const input = { id: session.id, completedAt: session.completedAt, notes: session.notes, codes: session.codes.map((c) => ({ code: c.code, description: c.description })) };
      const classification = classifyDiagnosticSession(input);
      const summaryText = buildDiagnosticSessionSummaryText(input);
      const result = await this.pipeline.ingest({
        itemKey: `repair-case-diagnostic-${session.id}`,
        sourceId: source.id,
        format: 'text',
        rawContent: summaryText,
        fallbackTitle: `Repair case ${session.id}`,
        itemTypeOverride: 'INTERNAL_CASE_NOTE',
        createdById: actorId,
      });
      if (result.quarantined || !result.versionId) {
        skipped += 1;
        continue;
      }
      itemsCreated += 1;
      await this.recordProvenance(result.versionId, { database: 'aios_operational', table: 'DiagnosticSession', primaryKeyColumn: 'id', primaryKeyValue: session.id, sourceTimestamp: (session.completedAt ?? session.startedAt).toISOString(), checksum: stableChecksum(session), extractedAt: new Date().toISOString(), classification });
    }

    const inspections = await this.prisma.inspectionResult.findMany();
    for (const inspection of inspections) {
      const input = { id: inspection.id, finding: inspection.finding, severity: inspection.severity, recommendedAction: inspection.recommendedAction, safetyWarning: inspection.safetyWarning, note: inspection.note };
      const classification = classifyInspectionResult(input);
      const summaryText = buildInspectionResultSummaryText(input);
      const result = await this.pipeline.ingest({
        itemKey: `repair-case-inspection-${inspection.id}`,
        sourceId: source.id,
        format: 'text',
        rawContent: summaryText,
        fallbackTitle: `Inspection case ${inspection.id}`,
        itemTypeOverride: 'REPEAT_REPAIR_CASE',
        createdById: actorId,
      });
      if (result.quarantined || !result.versionId) {
        skipped += 1;
        continue;
      }
      itemsCreated += 1;
      await this.recordProvenance(result.versionId, { database: 'aios_operational', table: 'InspectionResult', primaryKeyColumn: 'id', primaryKeyValue: inspection.id, sourceTimestamp: inspection.inspectedAt.toISOString(), checksum: stableChecksum(inspection), extractedAt: new Date().toISOString(), classification });
    }

    await this.audit.log({ action: 'STRUCTURED_INGESTION_COMPLETED', entityType: 'KnowledgeSource', entityId: source.id, afterState: { itemsCreated, skipped }, actorId });
    return { sourceId: source.id, itemsCreated, factsCreated: 0, skipped };
  }

  private async recordProvenance(versionId: string, provenanceExtra: Record<string, unknown>): Promise<void> {
    const version = await this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId } });
    const existingProvenance = (version.provenance as Record<string, unknown>) ?? {};
    await this.prisma.knowledgeItemVersion.update({ where: { id: versionId }, data: { provenance: { ...existingProvenance, sourceRecord: provenanceExtra } as object } });
  }
}
