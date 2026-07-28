import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PurchaseRecommendationAction, RecommendationStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { PurchaseRecommendationsService } from './purchase-recommendations.service';

@Controller('purchase-recommendations')
@UseGuards(PermissionsGuard)
export class PurchaseRecommendationsController {
  constructor(private readonly recommendations: PurchaseRecommendationsService) {}

  @Post('generate')
  @RequirePermissions('recommendations.generate')
  generate() {
    return this.recommendations.generate();
  }

  @Get()
  @RequirePermissions('recommendations.read')
  list(@Query('action') action?: PurchaseRecommendationAction, @Query('status') status?: RecommendationStatus) {
    return this.recommendations.list({ action, status });
  }

  @Get(':id')
  @RequirePermissions('recommendations.read')
  getById(@Param('id') id: string) {
    return this.recommendations.getById(id);
  }

  @Patch(':id/approve')
  @RequirePermissions('recommendations.approve')
  approve(@Param('id') id: string, @Body('decidedById') decidedById: string, @Body('decisionNote') decisionNote?: string) {
    return this.recommendations.approve(id, decidedById, decisionNote);
  }

  @Patch(':id/reject')
  @RequirePermissions('recommendations.approve')
  reject(@Param('id') id: string, @Body('decidedById') decidedById: string, @Body('decisionNote') decisionNote?: string) {
    return this.recommendations.reject(id, decidedById, decisionNote);
  }

  @Patch(':id/implemented')
  @RequirePermissions('recommendations.approve')
  markImplemented(@Param('id') id: string) {
    return this.recommendations.markImplemented(id);
  }
}
