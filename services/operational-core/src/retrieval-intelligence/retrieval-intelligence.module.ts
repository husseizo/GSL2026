// DGX Prototype 1.7.2 — Retrieval Intelligence Platform. A new module,
// deliberately separate from src/catalogue-ai/ and src/knowledge-platform/
// (both reused unmodified via module import below, never redesigned) —
// wiring into those consumers happens additively, feature-flagged, inside
// their own existing services (see decision-log.md), not by importing
// this module back into theirs (that would create a circular import;
// instead app.module.ts wires the optional dependency at the Nest DI
// container level via a forwardRef, see catalogue-ai.module.ts /
// knowledge-platform.module.ts's own updates this phase).
import { Module, forwardRef } from '@nestjs/common';
import { CatalogueAiModule } from '../catalogue-ai/catalogue-ai.module';
import { KnowledgePlatformModule } from '../knowledge-platform/knowledge-platform.module';
import { VectorSearchModule } from '../vector-search/vector-search.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ObservabilityModule } from '../observability/observability.module';
import { GraphExpansionService } from './graph-expansion/graph-expansion.service';
import { NewEdgeTypePopulationService } from './graph-expansion/populate-new-edge-types';
import { RetrievalQueryLogService } from './pipeline/retrieval-query-log.service';
import { RetrievalPipelineService } from './pipeline/retrieval-pipeline.service';
import { RetrievalLabService } from './lab/retrieval-lab.service';
import { TermAliasService } from './query-understanding/term-alias.service';
import { RetrievalIntelligenceController } from './retrieval-intelligence.controller';

@Module({
  imports: [forwardRef(() => CatalogueAiModule), forwardRef(() => KnowledgePlatformModule), VectorSearchModule, AiGatewayModule, ObservabilityModule],
  providers: [GraphExpansionService, NewEdgeTypePopulationService, RetrievalQueryLogService, RetrievalPipelineService, RetrievalLabService, TermAliasService],
  controllers: [RetrievalIntelligenceController],
  exports: [RetrievalPipelineService, GraphExpansionService, RetrievalQueryLogService, RetrievalLabService, TermAliasService, NewEdgeTypePopulationService],
})
export class RetrievalIntelligenceModule {}
