import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { KnowledgeSourceAction } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeSourcePermissionService } from './knowledge-source-permission.service';

@Controller('knowledge/sources/:sourceId/permissions')
@UseGuards(PermissionsGuard)
export class KnowledgeSourcePermissionController {
  constructor(private readonly permissions: KnowledgeSourcePermissionService) {}

  @Get()
  @RequirePermissions('knowledgeSource.read')
  list(@Param('sourceId') sourceId: string) {
    return this.permissions.listBySource(sourceId);
  }

  @Post(':action')
  @RequirePermissions('knowledgeSource.manage')
  set(@Param('sourceId') sourceId: string, @Param('action') action: KnowledgeSourceAction, @Body() body: { allowed: boolean; reason?: string; setById?: string }) {
    return this.permissions.setPermission(sourceId, action, body.allowed, body.reason, body.setById);
  }
}
