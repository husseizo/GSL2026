import { Module } from '@nestjs/common';
import { CatalogueAiModule } from '../catalogue-ai/catalogue-ai.module';
import { PromptRegistryModule } from '../prompt-registry/prompt-registry.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { VectorSearchModule } from '../vector-search/vector-search.module';
import { KnowledgePlatformModule } from '../knowledge-platform/knowledge-platform.module';
import { BenchmarkRegistryService } from './registry/benchmark-registry.service';
import { BenchmarkRegistryController } from './registry/benchmark-registry.controller';
import { GoldDatasetService } from './registry/gold-dataset.service';
import { BenchmarkPipelineService } from './pipeline/benchmark-pipeline.service';
import { PromptExperimentService } from './experiments/prompt-experiment.service';
import { PromptExperimentController } from './experiments/prompt-experiment.controller';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { LeaderboardController } from './leaderboard/leaderboard.controller';
import { DashboardDataService } from './reports/dashboard-data';
import { DashboardController } from './reports/dashboard.controller';
import { CertificationDashboardDataService } from './reports/certification-data';
import { EmbeddingBenchmarkService } from './embedding-reranker/embedding-benchmark.service';
import { RerankerBenchmarkService } from './embedding-reranker/reranker-benchmark.service';
import { ModelComparisonController } from './embedding-reranker/model-comparison.controller';

// DGX Prototype 1.6 — Automotive AI Evaluation Framework. A new module,
// deliberately separate from the existing src/ai-evaluation/ (a real,
// working, differently-scoped Phase 4/5 module over generic
// EvaluationDataset/Case/Run + RagService) — this is new infrastructure,
// not a redesign of that one. Imports CatalogueAiModule directly to reuse
// CatalogueSearchService/CatalogueRagService's real execution paths rather
// than duplicating retrieval/generation logic. See
// docs/ai-evaluation/benchmark-architecture.md.
@Module({
  imports: [CatalogueAiModule, PromptRegistryModule, AiGatewayModule, VectorSearchModule, KnowledgePlatformModule],
  providers: [BenchmarkRegistryService, GoldDatasetService, BenchmarkPipelineService, PromptExperimentService, LeaderboardService, DashboardDataService, CertificationDashboardDataService, EmbeddingBenchmarkService, RerankerBenchmarkService],
  controllers: [BenchmarkRegistryController, PromptExperimentController, LeaderboardController, DashboardController, ModelComparisonController],
  exports: [BenchmarkRegistryService, GoldDatasetService, BenchmarkPipelineService, PromptExperimentService, LeaderboardService, DashboardDataService, CertificationDashboardDataService, EmbeddingBenchmarkService, RerankerBenchmarkService],
})
export class AiBenchmarkModule {}
