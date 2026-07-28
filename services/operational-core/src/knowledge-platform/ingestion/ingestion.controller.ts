import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { KnowledgeItemType } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { IngestionPipelineService } from './ingestion-pipeline.service';
import { SupportedFormat } from '../parsing/parser-registry';

@Controller('knowledge/ingestion')
@UseGuards(PermissionsGuard)
export class IngestionController {
  constructor(private readonly pipeline: IngestionPipelineService) {}

  @Post()
  @RequirePermissions('knowledgeItem.draft')
  ingest(@Body() body: { itemKey: string; sourceId: string; format: SupportedFormat; rawContent: string; fallbackTitle: string; itemTypeOverride?: KnowledgeItemType; createdById?: string }) {
    return this.pipeline.ingest(body);
  }
}
