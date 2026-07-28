import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AiFeedbackDecision, AiInferenceKind } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { AiFeedbackService } from './ai-feedback.service';

@Controller('ai')
@UseGuards(PermissionsGuard)
export class AiFeedbackController {
  constructor(private readonly feedback: AiFeedbackService) {}

  @Post('inferences/:logId/feedback')
  @RequirePermissions('ai.feedback.manage')
  record(@Param('logId') logId: string, @Body() body: { decision: AiFeedbackDecision; actorId?: string; note?: string }) {
    return this.feedback.record(logId, body.decision, body.actorId, body.note);
  }

  @Get('inferences/:logId/feedback')
  @RequirePermissions('ai.feedback.manage')
  listForLog(@Param('logId') logId: string) {
    return this.feedback.listForLog(logId);
  }

  @Get('feedback/acceptance-rate')
  @RequirePermissions('ai.feedback.manage')
  acceptanceRate(@Query('kind') kind?: AiInferenceKind) {
    return this.feedback.acceptanceRate({ kind });
  }
}
