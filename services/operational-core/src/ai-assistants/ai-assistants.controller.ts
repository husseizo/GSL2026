import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RecommendationStatus } from '@prisma/client';
import type { Request } from 'express';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { getRequestActor } from '../common/permissions/request-actor';
import { PurchaseRecommendationsService } from '../purchase-recommendations/purchase-recommendations.service';
import { LubricantAssistantService, LubricantRecommendationParams } from './lubricant-assistant.service';
import { ManagerAssistantService } from './manager-assistant.service';
import { PartsAssistantService } from './parts-assistant.service';
import { TechnicianAssistantService, TechnicianAssistParams } from './technician-assistant.service';

@Controller('ai')
@UseGuards(PermissionsGuard)
export class AiAssistantsController {
  constructor(
    private readonly technicianAssistant: TechnicianAssistantService,
    private readonly partsAssistant: PartsAssistantService,
    private readonly lubricantAssistant: LubricantAssistantService,
    private readonly managerAssistant: ManagerAssistantService,
    private readonly purchaseRecs: PurchaseRecommendationsService,
  ) {}

  @Post('technician-assistant')
  @RequirePermissions('ai.technicianAssistant')
  technicianAssist(@Body() body: Omit<TechnicianAssistParams, 'actorId' | 'correlationId'> & { correlationId?: string }, @Req() req: Request) {
    const actor = getRequestActor(req);
    return this.technicianAssistant.assist({ ...body, actorId: actor.userId });
  }

  @Get('recommend-parts/:partId')
  @RequirePermissions('ai.recommend')
  recommendParts(@Param('partId') partId: string) {
    return this.partsAssistant.lookup(partId);
  }

  @Post('recommend-lubricant')
  @RequirePermissions('ai.recommend')
  recommendLubricant(@Body() body: LubricantRecommendationParams) {
    return this.lubricantAssistant.recommend(body);
  }

  // Thin, read-only alias into Phase 2's existing purchase-recommendation
  // engine under the /ai namespace the spec's API list asks for — no
  // recommendation logic is duplicated here, this just re-exposes
  // PurchaseRecommendationsService.list().
  @Get('recommend-purchase')
  @RequirePermissions('ai.recommend')
  recommendPurchase(@Query('status') status?: RecommendationStatus) {
    return this.purchaseRecs.list({ status });
  }

  @Post('manager-assistant')
  @RequirePermissions('ai.managerAssistant')
  managerAssist(@Body() body: { question: string; correlationId?: string }, @Req() req: Request) {
    const actor = getRequestActor(req);
    return this.managerAssistant.ask(body.question, actor.userId, body.correlationId);
  }
}
