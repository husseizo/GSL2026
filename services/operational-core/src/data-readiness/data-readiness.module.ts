import { Module } from '@nestjs/common';
import { SourceAuthorityService } from './authority/source-authority.service';
import { CustomerQualityService } from './quality/customer-quality.service';
import { PartsQualityService } from './quality/parts-quality.service';
import { LubricantsQualityService } from './quality/lubricants-quality.service';
import { DataQualityScoringService } from './quality/data-quality-scoring.service';
import { ReviewPrioritizationService } from './review/review-prioritization.service';
import { BranchWarehouseMappingService } from './mapping/branch-warehouse-mapping.service';
import { InventoryReadinessService } from './inventory-readiness.service';
import { BaselineService } from './baseline/baseline.service';
import { DataSnapshotService } from './snapshot/data-snapshot.service';
import { AIUseCaseReadinessService } from './ai-readiness/ai-use-case-readiness.service';
import { LubricantDemandDatasetService } from './ml/lubricant-demand-dataset.service';
import { CatalogueRagCorpusService } from './rag/catalogue-rag-corpus.service';
import { DataReadinessController } from './data-readiness.controller';

// Data Validation, Business Baselining & AI Readiness phase — builds on
// (and never modifies) the Data Consolidation phase's real imported data.
// See docs/data-readiness/real-data-architecture equivalent:
// docs/data-readiness/source-of-truth-registry.md for the full picture.
@Module({
  providers: [
    SourceAuthorityService,
    CustomerQualityService,
    PartsQualityService,
    LubricantsQualityService,
    DataQualityScoringService,
    ReviewPrioritizationService,
    BranchWarehouseMappingService,
    InventoryReadinessService,
    BaselineService,
    DataSnapshotService,
    AIUseCaseReadinessService,
    LubricantDemandDatasetService,
    CatalogueRagCorpusService,
  ],
  controllers: [DataReadinessController],
  exports: [
    SourceAuthorityService,
    CustomerQualityService,
    PartsQualityService,
    LubricantsQualityService,
    DataQualityScoringService,
    ReviewPrioritizationService,
    BranchWarehouseMappingService,
    InventoryReadinessService,
    BaselineService,
    DataSnapshotService,
    AIUseCaseReadinessService,
    LubricantDemandDatasetService,
    CatalogueRagCorpusService,
  ],
})
export class DataReadinessModule {}
