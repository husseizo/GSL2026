// DGX Prototype 1.7.2 — the Retrieval Intelligence Platform's own API
// surface. New public routes (this is a new platform, not an existing
// consumer contract — Catalogue AI's and the Knowledge Platform's own
// existing public APIs are untouched, see decision-log.md).
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { RetrievalPipelineService, RetrievalRequest } from './pipeline/retrieval-pipeline.service';
import { classifyRetrievalQuery } from './query-understanding/query-classifier';
import { RetrievalQueryLogService } from './pipeline/retrieval-query-log.service';
import { RetrievalLabService } from './lab/retrieval-lab.service';

@Controller('retrieval')
@UseGuards(PermissionsGuard)
export class RetrievalIntelligenceController {
  constructor(
    private readonly pipeline: RetrievalPipelineService,
    private readonly queryLog: RetrievalQueryLogService,
    private readonly lab: RetrievalLabService,
  ) {}

  @Post('query')
  @RequirePermissions('retrievalIntelligence.query')
  query(@Body() request: RetrievalRequest) {
    return this.pipeline.retrieve(request);
  }

  @Post('classify')
  @RequirePermissions('retrievalIntelligence.query')
  classify(@Body() body: { query: string; knownIdentifierSample?: string[] }) {
    return classifyRetrievalQuery(body.query, body.knownIdentifierSample ?? []);
  }

  @Get('logs')
  @RequirePermissions('retrievalIntelligence.query')
  logs(@Query('consumerName') consumerName?: string, @Query('take') take?: string) {
    return this.queryLog.listRecent(consumerName, take ? Number(take) : undefined);
  }

  @Post('lab/replay/:logId')
  @RequirePermissions('retrievalIntelligence.manage')
  replay(@Param('logId') logId: string) {
    return this.lab.replayQuery(logId);
  }

  @Post('lab/compare')
  @RequirePermissions('retrievalIntelligence.manage')
  compare(@Body() body: { queries: string[] }) {
    return this.lab.compareStrategies(body.queries);
  }

  @Get('lab/experiments')
  @RequirePermissions('retrievalIntelligence.manage')
  experiments() {
    return this.lab.listExperiments();
  }
}
