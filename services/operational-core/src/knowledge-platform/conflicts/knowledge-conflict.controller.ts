import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConflictStatus } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeConflictService } from './knowledge-conflict.service';

@Controller('knowledge/conflicts')
@UseGuards(PermissionsGuard)
export class KnowledgeConflictController {
  constructor(private readonly conflicts: KnowledgeConflictService) {}

  @Get()
  @RequirePermissions('knowledgeConflict.read')
  listOpen() {
    return this.conflicts.listOpen();
  }

  @Post('detect/:itemId')
  @RequirePermissions('knowledgeConflict.read')
  detect(@Param('itemId') itemId: string, @Body() body: { actorId?: string }) {
    return this.conflicts.detectAndPersistConflicts(itemId, body.actorId);
  }

  @Post(':id/resolve')
  @RequirePermissions('knowledgeConflict.resolve')
  resolve(@Param('id') id: string, @Body() body: { resolverId: string; status: ConflictStatus; resolutionNote: string; actorRole?: string }) {
    return this.conflicts.resolve(id, body.resolverId, body.status, body.resolutionNote, body.actorRole);
  }
}
