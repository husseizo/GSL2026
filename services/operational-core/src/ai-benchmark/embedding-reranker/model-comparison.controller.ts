import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { EmbeddingBenchmarkService } from './embedding-benchmark.service';
import { RerankerBenchmarkService } from './reranker-benchmark.service';

@Controller('ai/model-comparison')
@UseGuards(PermissionsGuard)
export class ModelComparisonController {
  constructor(
    private readonly embeddingBenchmark: EmbeddingBenchmarkService,
    private readonly rerankerBenchmark: RerankerBenchmarkService,
  ) {}

  @Get('embedding')
  @RequirePermissions('ai.evaluations.read')
  embedding(@Query('sampleSize') sampleSize?: string) {
    return this.embeddingBenchmark.compareRegisteredModels(sampleSize ? Number(sampleSize) : undefined);
  }

  @Get('reranker')
  @RequirePermissions('ai.evaluations.read')
  reranker(@Query('sampleSize') sampleSize?: string) {
    return this.rerankerBenchmark.compareRerankers(sampleSize ? Number(sampleSize) : undefined);
  }
}
