import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { StructuredFactType } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { StructuredFactService, CreateFactInput } from './structured-fact.service';

@Controller('knowledge/structured-facts')
@UseGuards(PermissionsGuard)
export class StructuredFactsController {
  constructor(private readonly facts: StructuredFactService) {}

  @Get('by-item/:itemId')
  @RequirePermissions('structuredFact.read')
  listByItem(@Param('itemId') itemId: string, @Query('factType') factType?: StructuredFactType) {
    return this.facts.listByItem(itemId, factType);
  }

  @Get('by-item/:itemId/ai-consumer-visible')
  @RequirePermissions('structuredFact.read')
  listAiConsumerVisible(@Param('itemId') itemId: string, @Query('factType') factType?: StructuredFactType) {
    return this.facts.listAiConsumerVisibleFacts(itemId, factType);
  }

  @Post()
  @RequirePermissions('structuredFact.manage')
  create(@Body() body: CreateFactInput) {
    return this.facts.createFact(body);
  }

  @Post(':id/review')
  @RequirePermissions('structuredFact.review')
  review(@Param('id') id: string, @Body() body: { reviewerId: string; actorRole?: string }) {
    return this.facts.review(id, body.reviewerId, body.actorRole);
  }
}
