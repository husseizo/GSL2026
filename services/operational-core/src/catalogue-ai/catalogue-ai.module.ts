import { Module, forwardRef } from '@nestjs/common';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { RetrievalIntelligenceModule } from '../retrieval-intelligence/retrieval-intelligence.module';
import { RagModule } from '../rag/rag.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { VectorSearchModule } from '../vector-search/vector-search.module';
import { PromptRegistryModule } from '../prompt-registry/prompt-registry.module';
import { AiFeedbackModule } from '../ai-feedback/ai-feedback.module';
import { DataConsolidationModule } from '../data-consolidation/data-consolidation.module';
import { ObservabilityModule } from '../observability/observability.module';
import { RedisModule } from '../redis/redis.module';
import { CatalogueSearchService } from './search/catalogue-search.service';
import { CatalogueIndexVersionService } from './index-lifecycle/catalogue-index-version.service';
import { PartRelationshipService } from './relationships/part-relationship.service';
import { ProductComparisonService } from './comparison/product-comparison.service';
import { CatalogueRagService } from './rag/catalogue-rag.service';
import { CatalogueEvaluationService } from './evaluation/catalogue-evaluation.service';
import { CatalogueAiController } from './catalogue-ai.controller';

// DGX Prototype 1 — Automotive Catalogue RAG, Parts Intelligence & Verified
// Product Retrieval. Reuses Phase 4's KnowledgeBaseModule/RagModule/
// AiFeedbackModule and the Data Consolidation phase's ManualReviewService
// unchanged — see docs/ai/catalogue-rag-architecture.md. DGX Prototype 1.5
// additionally imports AiGatewayModule/VectorSearchModule/
// PromptRegistryModule directly — CatalogueRagService now composes these
// lower-level primitives itself for retrieval-stage decomposition (see
// docs/ai-tuning/retrieval-optimization.md) rather than only calling
// RagService.retrieveAndGenerate() as one opaque step. RagModule is still
// imported for RagService.ensurePromptSeeded(), a real reused helper.
@Module({
  imports: [KnowledgeBaseModule, RagModule, AiGatewayModule, VectorSearchModule, PromptRegistryModule, AiFeedbackModule, DataConsolidationModule, ObservabilityModule, RedisModule, forwardRef(() => RetrievalIntelligenceModule)],
  providers: [CatalogueSearchService, CatalogueIndexVersionService, PartRelationshipService, ProductComparisonService, CatalogueRagService, CatalogueEvaluationService],
  controllers: [CatalogueAiController],
  exports: [CatalogueSearchService, CatalogueIndexVersionService, PartRelationshipService, ProductComparisonService, CatalogueRagService, CatalogueEvaluationService],
})
export class CatalogueAiModule {}
