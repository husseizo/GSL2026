import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { getRequestActor } from '../common/permissions/request-actor';
import { AiFeedbackService } from '../ai-feedback/ai-feedback.service';
import { ManualReviewService } from '../data-consolidation/manual-review.service';
import { CatalogueSearchService } from './search/catalogue-search.service';
import { ProductComparisonService } from './comparison/product-comparison.service';
import { CatalogueRagService } from './rag/catalogue-rag.service';
import { AiFeedbackDecision } from '@prisma/client';

// Every endpoint uses this project's existing authentication/policy/audit
// conventions (PermissionsGuard, getRequestActor, correlation IDs already
// applied globally by Phase 5's middleware) — no new auth mechanism. See
// docs/ai/security-and-access.md.
@ApiTags('catalogue-ai')
@Controller('catalogue')
@UseGuards(PermissionsGuard)
export class CatalogueAiController {
  constructor(
    private readonly catalogueSearch: CatalogueSearchService,
    private readonly comparison: ProductComparisonService,
    private readonly catalogueRag: CatalogueRagService,
    private readonly aiFeedback: AiFeedbackService,
    private readonly manualReview: ManualReviewService,
  ) {}

  @Post('search')
  @RequirePermissions('parts.read')
  async search(@Body() body: { query: string }) {
    const [byOem, byAlternate, keyword] = await Promise.all([
      this.catalogueSearch.findByOemNumber(body.query),
      this.catalogueSearch.findByAlternateNumber(body.query),
      this.catalogueSearch.keywordSearchParts(body.query),
    ]);
    return { results: [...byOem, ...byAlternate, ...keyword] };
  }

  @Get('parts/by-oem/:number')
  @RequirePermissions('parts.read')
  findByOem(@Param('number') number: string) {
    return this.catalogueSearch.findByOemNumber(number);
  }

  @Get('parts/:id/alternatives')
  @RequirePermissions('parts.read')
  async alternatives(@Param('id') id: string) {
    return this.catalogueSearch.findByAlternateNumber(id);
  }

  @Get('parts/:id/supersessions')
  @RequirePermissions('parts.read')
  supersessions(@Param('id') id: string) {
    return this.catalogueSearch.findSupersessions(id);
  }

  @Post('compare-parts')
  @RequirePermissions('parts.read')
  compareParts(@Body() body: { partIdA: string; partIdB: string }) {
    return this.comparison.compareParts(body.partIdA, body.partIdB);
  }

  @Post('compare-lubricants')
  @RequirePermissions('lubricants.read')
  compareLubricants(@Body() body: { lubricantIdA: string; lubricantIdB: string }) {
    return this.comparison.compareLubricants(body.lubricantIdA, body.lubricantIdB);
  }

  @Post('search-lubricants')
  @RequirePermissions('lubricants.read')
  async searchLubricants(@Query('viscosity') viscosity?: string, @Query('oemBrand') oemBrand?: string, @Query('approvalCode') approvalCode?: string) {
    if (viscosity) return this.catalogueSearch.findLubricantsByViscosity(viscosity);
    if (oemBrand && approvalCode) return this.catalogueSearch.findLubricantsByVerifiedApproval(oemBrand, approvalCode);
    return [];
  }

  @Post('rag/ask')
  @RequirePermissions('ai.chat')
  async ask(@Body() body: { question: string; correlationId?: string }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.catalogueRag.ask(body.question, actor.userId, body.correlationId);
  }

  @Post('feedback')
  @RequirePermissions('ai.chat')
  async feedback(@Body() body: { inferenceLogId: string; decision: AiFeedbackDecision; note?: string }, @Req() request: Request) {
    const actor = getRequestActor(request);
    return this.aiFeedback.record(body.inferenceLogId, body.decision, actor.userId, body.note);
  }

  @Post('review-handoff')
  @RequirePermissions('reviewQueue.assign')
  async reviewHandoff(@Body() body: { queueType: string; proposedAction: string; evidence: Record<string, unknown>; confidence?: number }) {
    return this.manualReview.enqueue(body);
  }
}
