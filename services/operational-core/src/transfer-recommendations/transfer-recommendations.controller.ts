import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RecommendationStatus } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { TransferRecommendationsService } from './transfer-recommendations.service';

@Controller('transfer-recommendations')
@UseGuards(PermissionsGuard)
export class TransferRecommendationsController {
  constructor(private readonly recommendations: TransferRecommendationsService) {}

  @Post('generate')
  @RequirePermissions('recommendations.generate')
  generate() {
    return this.recommendations.generate();
  }

  @Get()
  @RequirePermissions('recommendations.read')
  list(@Query('status') status?: RecommendationStatus) {
    return this.recommendations.list({ status });
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
}
