import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { KnowledgeReviewDecision, KnowledgeReviewerRole } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeReviewService } from './knowledge-review.service';

@Controller('knowledge/review')
@UseGuards(PermissionsGuard)
export class KnowledgeReviewController {
  constructor(private readonly reviewService: KnowledgeReviewService) {}

  @Get('queue')
  @RequirePermissions('knowledgeReview.read')
  queue() {
    return this.reviewService.reviewQueue();
  }

  @Post(':versionId/assign')
  @RequirePermissions('knowledgeReview.assign')
  assign(@Param('versionId') versionId: string, @Body() body: { reviewerRole: KnowledgeReviewerRole; assignedToId?: string; actorId?: string }) {
    return this.reviewService.assignReviewer(versionId, body.reviewerRole, body.assignedToId, body.actorId);
  }

  @Post('assignments/:assignmentId/decide')
  @RequirePermissions('knowledgeReview.decide')
  decide(@Param('assignmentId') assignmentId: string, @Body() body: { decision: KnowledgeReviewDecision; decisionNote?: string; actorId?: string }) {
    return this.reviewService.decide(assignmentId, body.decision, body.decisionNote, body.actorId);
  }
}
