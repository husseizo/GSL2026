import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeAuditService } from './knowledge-audit.service';

@Controller('knowledge/audit')
@UseGuards(PermissionsGuard)
export class KnowledgeAuditController {
  constructor(private readonly auditService: KnowledgeAuditService) {}

  @Get('ingestion-runs')
  @RequirePermissions('knowledgeSecurity.read')
  listIngestionRuns() {
    return this.auditService.listIngestionRuns();
  }

  @Get('quarantine')
  @RequirePermissions('knowledgeSecurity.read')
  listQuarantineEvents() {
    return this.auditService.listQuarantineEvents();
  }

  @Get('history')
  @RequirePermissions('knowledgeSecurity.read')
  listAuditHistory(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    return this.auditService.listAuditHistory(entityType, entityId);
  }
}
