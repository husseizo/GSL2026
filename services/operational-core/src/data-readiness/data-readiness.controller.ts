import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AIUseCaseStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { getRequestActor } from '../common/permissions/request-actor';
import { SourceAuthorityService } from './authority/source-authority.service';
import { CustomerQualityService } from './quality/customer-quality.service';
import { PartsQualityService } from './quality/parts-quality.service';
import { LubricantsQualityService } from './quality/lubricants-quality.service';
import { ReviewPrioritizationService } from './review/review-prioritization.service';
import { BaselineService } from './baseline/baseline.service';
import { DataSnapshotService } from './snapshot/data-snapshot.service';
import { AIUseCaseReadinessService } from './ai-readiness/ai-use-case-readiness.service';

// Minimal admin surface, matching the Data Consolidation phase's own
// precedent — real, working service-layer capability first; a broader
// self-service API surface (pause/resume/cancel-style commands) is
// deliberately not built this pass. See docs/data-readiness/decision-log.md.
@ApiTags('data-readiness')
@Controller('data-readiness')
@UseGuards(PermissionsGuard)
export class DataReadinessController {
  constructor(
    private readonly sourceAuthority: SourceAuthorityService,
    private readonly customerQuality: CustomerQualityService,
    private readonly partsQuality: PartsQualityService,
    private readonly lubricantsQuality: LubricantsQualityService,
    private readonly reviewPrioritization: ReviewPrioritizationService,
    private readonly baseline: BaselineService,
    private readonly snapshot: DataSnapshotService,
    private readonly aiReadiness: AIUseCaseReadinessService,
  ) {}

  @Get('authority-rules')
  @RequirePermissions('dataAuthority.read')
  listAuthorityRules() {
    return this.sourceAuthority.listCurrentRules();
  }

  @Get('authority-conflicts')
  @RequirePermissions('dataAuthority.read')
  listAuthorityConflicts() {
    return this.sourceAuthority.listOpenConflicts();
  }

  @Get('quality/customers')
  @RequirePermissions('dataQuality.profile')
  profileCustomers() {
    return this.customerQuality.profile();
  }

  @Get('quality/parts')
  @RequirePermissions('dataQuality.profile')
  profileParts() {
    return this.partsQuality.profile();
  }

  @Get('quality/lubricants')
  @RequirePermissions('dataQuality.profile')
  profileLubricants() {
    return this.lubricantsQuality.profile();
  }

  @Post('review/score-customer-matches')
  @RequirePermissions('reviewQueue.assign')
  scoreCustomerMatches() {
    return this.reviewPrioritization.scoreCustomerMatchReviews();
  }

  @Post('review/create-batch')
  @RequirePermissions('reviewQueue.assign')
  createReviewBatch(@Body() body: { name: string; limit: number }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.reviewPrioritization.createPriorityBatch(body.name, body.limit, actor.userId);
  }

  @Post('review/:id/decision')
  @RequirePermissions('reviewQueue.decide')
  recordDecision(
    @Param('id') id: string,
    @Body() body: { decisionType: 'MERGE_APPROVED' | 'KEEP_SEPARATE' | 'LINK_AS_RELATED' | 'REQUEST_MORE_INFORMATION' | 'REJECT_PROPOSAL' | 'DEFER' | 'ESCALATE'; evidence: Record<string, unknown>; confidence?: number; reason: string; sourceRecordRefs: string[]; canonicalEntityId?: string },
    @Req() request: Request,
  ) {
    const actor = getRequestActor(request);
    return this.reviewPrioritization.recordDecision({ manualReviewItemId: id, reviewerId: actor.userId ?? 'unknown', ...body });
  }

  @Post('review/decision/:id/undo')
  @RequirePermissions('reviewQueue.undo')
  undoDecision(@Param('id') id: string, @Body() body: { reason: string }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.reviewPrioritization.reverseDecision(id, actor.userId ?? 'unknown', body.reason);
  }

  @Post('baseline/run')
  @RequirePermissions('baseline.generate')
  runBaseline(@Body() body: { dateRangeStart: string; dateRangeEnd: string }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.baseline.runBaseline(new Date(body.dateRangeStart), new Date(body.dateRangeEnd), actor.userId);
  }

  @Post('baseline/:id/approve')
  @RequirePermissions('baseline.approve')
  approveBaseline(@Param('id') id: string, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.baseline.approveBaseline(id, actor.userId ?? 'unknown');
  }

  @Get('baseline/compare')
  @RequirePermissions('baseline.read')
  compareBaselines(@Query('runA') runA: string, @Query('runB') runB: string) {
    return this.baseline.compareBaselineRuns(runA, runB);
  }

  @Post('snapshots')
  @RequirePermissions('dataSnapshots.create')
  createSnapshot(@Body() body: { snapshotName: string }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.snapshot.createSnapshot(body.snapshotName, actor.userId);
  }

  @Get('snapshots/:name/validate')
  @RequirePermissions('dataSnapshots.read')
  validateSnapshot(@Param('name') name: string) {
    return this.snapshot.validateSnapshot(name);
  }

  @Post('ai-readiness/refresh')
  @RequirePermissions('aiReadiness.manage')
  refreshAiReadiness() {
    return this.aiReadiness.persistAssessments();
  }

  @Get('ai-readiness')
  @RequirePermissions('aiReadiness.read')
  listAiReadiness(@Query('status') status?: AIUseCaseStatus) {
    return this.aiReadiness.listByStatus(status);
  }
}
