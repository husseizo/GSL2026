import { Module } from '@nestjs/common';
import { IntegrationModule } from '../integration/integration.module';
import { StagingService } from './staging.service';
import { ImportService } from './import.service';
import { ManualReviewService } from './manual-review.service';
import { ReconciliationService } from './reconciliation.service';
import { CustomerMatchingService } from './matching/customer-matching.service';
import { LubricantMatchingService } from './matching/lubricant-matching.service';
import { PartConsolidationMatchingService } from './matching/part-consolidation-matching.service';
import { DataConsolidationController } from './data-consolidation.controller';

// Real Data Consolidation phase — read-only extraction from MolasCacheDb
// (lubricants) and Parts_Catalog (spare parts/AutoHub/TecDoc/VIN), staged,
// matched, and imported into the existing Phase 1-5 domain tables. See
// docs/data-consolidation/real-data-architecture.md.
@Module({
  imports: [IntegrationModule],
  providers: [
    StagingService,
    ImportService,
    ManualReviewService,
    ReconciliationService,
    CustomerMatchingService,
    LubricantMatchingService,
    PartConsolidationMatchingService,
  ],
  controllers: [DataConsolidationController],
  exports: [StagingService, ImportService, ManualReviewService, ReconciliationService],
})
export class DataConsolidationModule {}
