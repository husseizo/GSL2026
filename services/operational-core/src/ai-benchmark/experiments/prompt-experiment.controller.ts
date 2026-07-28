import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { CreateExperimentInput, ExperimentArmDefinition, PromptExperimentService } from './prompt-experiment.service';

@Controller('ai/prompt-experiments')
@UseGuards(PermissionsGuard)
export class PromptExperimentController {
  constructor(private readonly experiments: PromptExperimentService) {}

  @Get()
  @RequirePermissions('ai.prompts.read')
  list() {
    return this.experiments.listExperiments();
  }

  @Get(':id')
  @RequirePermissions('ai.prompts.read')
  get(@Param('id') id: string) {
    return this.experiments.getExperiment(id);
  }

  @Post()
  @RequirePermissions('ai.prompts.manage')
  create(@Body() body: CreateExperimentInput) {
    return this.experiments.createExperiment(body);
  }

  @Post(':id/run')
  @RequirePermissions('ai.prompts.manage')
  run(@Param('id') id: string, @Body() body: { promptTemplateName: string; arms: ExperimentArmDefinition[]; category?: 'GENERATION' | 'SWAHILI' | 'ENGLISH' | 'MIXED_LANGUAGE' }) {
    return this.experiments.runExperiment(id, body.promptTemplateName, body.arms, body.category);
  }

  @Post(':id/decide-winner')
  @RequirePermissions('ai.prompts.manage')
  decideWinner(@Param('id') id: string, @Body() body: { winnerArmId: string; decidedById: string; decisionNotes: string }) {
    return this.experiments.decideWinner(id, body.winnerArmId, body.decidedById, body.decisionNotes);
  }
}
