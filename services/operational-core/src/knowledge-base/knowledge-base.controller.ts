import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { KnowledgeSourceType } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { IngestDocumentParams, KnowledgeBaseService } from './knowledge-base.service';

@Controller('ai/knowledge-base')
@UseGuards(PermissionsGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBase: KnowledgeBaseService) {}

  @Get()
  @RequirePermissions('ai.knowledgeBase.read')
  list(@Query('sourceType') sourceType?: KnowledgeSourceType, @Query('isApproved') isApproved?: string) {
    return this.knowledgeBase.list({
      sourceType,
      isApproved: isApproved === undefined ? undefined : isApproved === 'true',
    });
  }

  @Get(':id')
  @RequirePermissions('ai.knowledgeBase.read')
  getById(@Param('id') id: string) {
    return this.knowledgeBase.getById(id);
  }

  @Post()
  @RequirePermissions('ai.knowledgeBase.manage')
  ingest(@Body() body: IngestDocumentParams) {
    return this.knowledgeBase.ingestDocument(body);
  }

  @Patch(':id/approve')
  @RequirePermissions('ai.knowledgeBase.manage')
  approve(@Param('id') id: string) {
    return this.knowledgeBase.approve(id);
  }

  @Patch(':id/reject')
  @RequirePermissions('ai.knowledgeBase.manage')
  reject(@Param('id') id: string) {
    return this.knowledgeBase.reject(id);
  }

  @Post(':id/reindex')
  @RequirePermissions('ai.knowledgeBase.manage')
  reindex(@Param('id') id: string) {
    return this.knowledgeBase.reindex(id);
  }
}
