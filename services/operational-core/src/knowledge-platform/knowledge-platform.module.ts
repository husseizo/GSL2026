import { Module, forwardRef } from '@nestjs/common';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { RetrievalIntelligenceModule } from '../retrieval-intelligence/retrieval-intelligence.module';
import { VectorSearchModule } from '../vector-search/vector-search.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ObservabilityModule } from '../observability/observability.module';
import { KnowledgeSourceRegistryService } from './source-registry/knowledge-source-registry.service';
import { KnowledgeSourceRegistryController } from './source-registry/knowledge-source-registry.controller';
import { KnowledgeItemRegistryService } from './versioning/knowledge-item-registry.service';
import { KnowledgeClaimService } from './provenance/knowledge-claim.service';
import { StructuredFactService } from './structured-facts/structured-fact.service';
import { KnowledgeConflictService } from './conflicts/knowledge-conflict.service';
import { KnowledgeReviewService } from './review-workflow/knowledge-review.service';
import { KnowledgeReviewController } from './review-workflow/knowledge-review.controller';
import { KnowledgeLifecycleService } from './expiry-supersession/knowledge-lifecycle.service';
import { KnowledgeSnapshotService } from './snapshots/knowledge-snapshot.service';
import { KnowledgeSnapshotController } from './snapshots/knowledge-snapshot.controller';
import { KnowledgeGraphService } from './graph/knowledge-graph.service';
import { KnowledgeGraphController } from './graph/knowledge-graph.controller';
import { KnowledgeRetrievalService } from './retrieval/knowledge-retrieval.service';
import { DedupVersionDetectStage } from './ingestion/stages/dedup-version-detect.stage';
import { IngestionPipelineService } from './ingestion/ingestion-pipeline.service';
import { IngestionController } from './ingestion/ingestion.controller';
import { KnowledgeSourcePermissionService } from './permissions/knowledge-source-permission.service';
import { KnowledgeSourcePermissionController } from './permissions/knowledge-source-permission.controller';
import { StructuredSourceIngestionService } from './structured-ingestion/structured-source-ingestion.service';
import { EicarTestScannerAdapter } from './acquisition/eicar-test-scanner.adapter';
import { ClamAvScannerAdapter } from './acquisition/clamav-scanner.adapter';
import { DocumentAcquisitionService } from './acquisition/document-acquisition.service';
import { DocumentEncryptionKeyService } from './security/document-encryption-key.service';
import { ExtractionProfileService } from './extraction-profiles/extraction-profile.service';
import { ExtractionProfileController } from './extraction-profiles/extraction-profile.controller';
import { StructuredFactsController } from './structured-facts/structured-facts.controller';
import { KnowledgeConflictController } from './conflicts/knowledge-conflict.controller';
import { PublishedKnowledgeSearchController } from './retrieval/published-knowledge-search.controller';
import { KnowledgeAuditService } from './audit/knowledge-audit.service';
import { KnowledgeAuditController } from './audit/knowledge-audit.controller';
import { EvaluationResultsController } from './evaluation-results/evaluation-results.controller';
import { KnowledgeItemController } from './versioning/knowledge-item.controller';
import { KnowledgeClaimController } from './provenance/knowledge-claim.controller';

// DGX Prototype 1.7 — Automotive Knowledge Platform. A new module,
// deliberately separate from src/knowledge-base/ (the real, working Phase
// 4 KnowledgeDocument/KnowledgeChunk ingestion primitive — reused
// unmodified via KnowledgeBaseModule import below, never redesigned) and
// src/catalogue-ai/ (unmodified; integration is additive-only, see
// docs/knowledge-platform/catalogue-ai-integration.md). See
// docs/knowledge-platform/benchmark-architecture.md-equivalent,
// docs/knowledge-platform/architecture.md.
@Module({
  imports: [KnowledgeBaseModule, VectorSearchModule, AiGatewayModule, ObservabilityModule, forwardRef(() => RetrievalIntelligenceModule)],
  providers: [
    KnowledgeSourceRegistryService,
    KnowledgeItemRegistryService,
    KnowledgeClaimService,
    StructuredFactService,
    KnowledgeConflictService,
    KnowledgeReviewService,
    KnowledgeLifecycleService,
    KnowledgeSnapshotService,
    KnowledgeGraphService,
    KnowledgeRetrievalService,
    DedupVersionDetectStage,
    IngestionPipelineService,
    KnowledgeSourcePermissionService,
    StructuredSourceIngestionService,
    EicarTestScannerAdapter,
    ClamAvScannerAdapter,
    DocumentAcquisitionService,
    DocumentEncryptionKeyService,
    ExtractionProfileService,
    KnowledgeAuditService,
  ],
  controllers: [
    KnowledgeSourceRegistryController,
    KnowledgeReviewController,
    KnowledgeSnapshotController,
    KnowledgeGraphController,
    IngestionController,
    KnowledgeSourcePermissionController,
    ExtractionProfileController,
    StructuredFactsController,
    KnowledgeConflictController,
    PublishedKnowledgeSearchController,
    KnowledgeAuditController,
    EvaluationResultsController,
    KnowledgeItemController,
    KnowledgeClaimController,
  ],
  exports: [
    KnowledgeSourceRegistryService,
    KnowledgeItemRegistryService,
    KnowledgeClaimService,
    StructuredFactService,
    KnowledgeConflictService,
    KnowledgeReviewService,
    KnowledgeLifecycleService,
    KnowledgeSnapshotService,
    KnowledgeGraphService,
    KnowledgeRetrievalService,
    IngestionPipelineService,
    KnowledgeSourcePermissionService,
    StructuredSourceIngestionService,
    DocumentAcquisitionService,
    DocumentEncryptionKeyService,
    ExtractionProfileService,
    KnowledgeAuditService,
  ],
})
export class KnowledgePlatformModule {}
