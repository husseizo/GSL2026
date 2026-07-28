import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EvaluationPurpose } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { AiEvaluationService, RetrievalCase, RetrievalExpectation } from './ai-evaluation.service';

@Controller('ai/evaluations')
@UseGuards(PermissionsGuard)
export class AiEvaluationController {
  constructor(private readonly evaluations: AiEvaluationService) {}

  @Get()
  @RequirePermissions('ai.evaluations.read')
  list(@Query('datasetId') datasetId?: string) {
    return this.evaluations.listRuns(datasetId);
  }

  @Get('datasets')
  @RequirePermissions('ai.evaluations.read')
  listDatasets() {
    return this.evaluations.listDatasets();
  }

  @Post('datasets')
  @RequirePermissions('ai.evaluations.manage')
  createDataset(@Body() body: { name: string; purpose: EvaluationPurpose }) {
    return this.evaluations.createDataset(body.name, body.purpose);
  }

  @Post('datasets/:id/cases')
  @RequirePermissions('ai.evaluations.manage')
  addCase(@Param('id') datasetId: string, @Body() body: { input: RetrievalCase; expectedOutput: RetrievalExpectation }) {
    return this.evaluations.addCase(datasetId, body.input, body.expectedOutput);
  }

  @Post('datasets/:id/run')
  @RequirePermissions('ai.evaluations.manage')
  run(@Param('id') datasetId: string, @Body() body: { modelId?: string }) {
    return this.evaluations.runRetrievalEvaluation(datasetId, body.modelId);
  }
}
