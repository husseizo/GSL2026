import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeSnapshotService } from './knowledge-snapshot.service';

@Controller('knowledge/snapshots')
@UseGuards(PermissionsGuard)
export class KnowledgeSnapshotController {
  constructor(private readonly snapshots: KnowledgeSnapshotService) {}

  @Get('active')
  @RequirePermissions('knowledgeSnapshot.read')
  active() {
    return this.snapshots.getActiveSnapshot();
  }

  @Post()
  @RequirePermissions('knowledgeSnapshot.manage')
  build(@Body() body: { actorId?: string }) {
    return this.snapshots.buildSnapshot(body.actorId);
  }

  @Post(':id/validate')
  @RequirePermissions('knowledgeSnapshot.manage')
  validate(@Param('id') id: string) {
    return this.snapshots.validateSnapshot(id);
  }

  @Post(':id/approve')
  @RequirePermissions('knowledgeSnapshot.manage')
  approve(@Param('id') id: string, @Body() body: { approvedById: string }) {
    return this.snapshots.approve(id, body.approvedById);
  }

  @Post(':id/activate')
  @RequirePermissions('knowledgeSnapshot.manage')
  activate(@Param('id') id: string, @Body() body: { actorId?: string }) {
    return this.snapshots.activate(id, body.actorId);
  }

  @Post(':id/rollback')
  @RequirePermissions('knowledgeSnapshot.manage')
  rollback(@Param('id') id: string, @Body() body: { reactivateSnapshotId: string; actorId?: string }) {
    return this.snapshots.rollback(id, body.reactivateSnapshotId, body.actorId);
  }

  @Get(':id/verify-checksum')
  @RequirePermissions('knowledgeSnapshot.read')
  verifyChecksum(@Param('id') id: string) {
    return this.snapshots.verifyChecksum(id);
  }
}
