import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { RequireBranchScope } from '../authorization/scope.decorator';
import { ScopeGuard } from '../authorization/scope.guard';
import { BranchGatewayService } from './branch-gateway.service';

@ApiTags('branch-gateway')
@Controller('branch-gateway/:branchId')
@UseGuards(PermissionsGuard, ScopeGuard)
export class BranchGatewayController {
  constructor(private readonly gateway: BranchGatewayService) {}

  @Post('messages')
  @RequirePermissions('branchGateway.manage')
  @RequireBranchScope('branchId')
  enqueue(@Param('branchId') branchId: string, @Body() body: { messageType: string; payload: unknown; priority?: number }) {
    return this.gateway.enqueue(branchId, body.messageType, body.payload, body.priority);
  }

  @Get('messages')
  @RequirePermissions('branchGateway.read')
  @RequireBranchScope('branchId')
  list(@Param('branchId') branchId: string, @Query('status') status?: string) {
    return this.gateway.listMessages(branchId, status);
  }

  @Post('messages/:messageId/replay')
  @RequirePermissions('branchGateway.manage')
  @RequireBranchScope('branchId')
  replay(@Param('messageId') messageId: string) {
    return this.gateway.replay(messageId);
  }

  @Get('queue-depth')
  @RequirePermissions('branchGateway.read')
  @RequireBranchScope('branchId')
  queueDepth(@Param('branchId') branchId: string) {
    return this.gateway.getQueueDepth(branchId);
  }

  @Post('health-ping')
  @RequirePermissions('branchGateway.manage')
  @RequireBranchScope('branchId')
  healthPing(@Param('branchId') branchId: string, @Body() body: { isOnline: boolean; latencyMs?: number }) {
    return this.gateway.recordHealthPing(branchId, body.isOnline, body.latencyMs);
  }

  @Get('health')
  @RequirePermissions('branchGateway.read')
  @RequireBranchScope('branchId')
  health(@Param('branchId') branchId: string) {
    return this.gateway.getLatestHealth(branchId);
  }
}
