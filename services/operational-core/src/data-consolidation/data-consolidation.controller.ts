import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { getRequestActor } from '../common/permissions/request-actor';
import { ManualReviewService } from './manual-review.service';
import { ReconciliationService } from './reconciliation.service';
import { StagingService } from './staging.service';

// Minimal admin surface for this phase — list staged/reviewable records and
// resolve manual-review items. Real production-triggering commands
// (start/pause/resume backfill) are run via scripts/verify-real-data-
// consolidation.ts and the adapter/import services directly in this pass,
// not yet exposed as unrestricted HTTP endpoints — see
// docs/data-consolidation/production-backfill-runbook.md for what's
// deliberately still a scripted, human-supervised operation rather than a
// self-service API call.
@ApiTags('data-consolidation')
@Controller('data-consolidation')
@UseGuards(PermissionsGuard)
export class DataConsolidationController {
  constructor(
    private readonly staging: StagingService,
    private readonly manualReview: ManualReviewService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Get('staged/:feedName')
  @RequirePermissions('dataSources.read')
  listStaged(@Param('feedName') feedName: string) {
    return this.staging.listStaged(feedName);
  }

  @Get('manual-review')
  @RequirePermissions('mappings.read')
  listManualReview(@Query('queueType') queueType?: string, @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED') {
    return this.manualReview.list(queueType, status);
  }

  @Patch('manual-review/:id/approve')
  @RequirePermissions('mappings.approve')
  approveManualReview(@Param('id') id: string, @Body() body: { reason?: string }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.manualReview.approve(id, actor.userId ?? 'unknown', body.reason);
  }

  @Patch('manual-review/:id/reject')
  @RequirePermissions('mappings.approve')
  rejectManualReview(@Param('id') id: string, @Body() body: { reason?: string }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.manualReview.reject(id, actor.userId ?? 'unknown', body.reason);
  }

  @Get('reconciliation/:batchId')
  @RequirePermissions('imports.reconcile')
  listReconciliation(@Param('batchId') batchId: string) {
    return this.reconciliation.listForBatch(batchId);
  }
}
