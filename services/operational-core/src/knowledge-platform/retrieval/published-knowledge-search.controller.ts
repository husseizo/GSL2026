import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeRetrievalService, AiConsumerRequest } from './knowledge-retrieval.service';

// DGX Prototype 1.7.1 — the real "Published Knowledge Search" screen
// backend (spec §21 screen 9). Thin wrapper over the existing, unmodified
// searchKnowledge() contract — zero new retrieval logic.
@Controller('knowledge/search')
@UseGuards(PermissionsGuard)
export class PublishedKnowledgeSearchController {
  constructor(private readonly retrieval: KnowledgeRetrievalService) {}

  @Post()
  @RequirePermissions('knowledgeRetrieval.query')
  search(@Body() request: AiConsumerRequest) {
    return this.retrieval.searchKnowledge(request);
  }
}
