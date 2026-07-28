import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AiModelKind, AiModelStatus, ModelApprovalState } from '@prisma/client';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { ModelRegistryService } from './model-registry.service';

@Controller('ai/model-registry')
@UseGuards(PermissionsGuard)
export class ModelRegistryController {
  constructor(private readonly models: ModelRegistryService) {}

  @Get()
  @RequirePermissions('ai.modelRegistry.read')
  list(@Query('kind') kind?: AiModelKind, @Query('status') status?: AiModelStatus) {
    return this.models.list({ kind, status });
  }

  @Get('gpu-health')
  @RequirePermissions('ai.modelRegistry.read')
  gpuHealth() {
    return this.models.gpuHealth();
  }

  @Post('sync')
  @RequirePermissions('ai.modelRegistry.manage')
  sync() {
    return this.models.syncFromDgx();
  }

  @Patch(':id/set-default')
  @RequirePermissions('ai.modelRegistry.manage')
  setDefault(@Param('id') id: string) {
    return this.models.setDefault(id);
  }

  @Patch(':id/status')
  @RequirePermissions('ai.modelRegistry.manage')
  setStatus(@Param('id') id: string, @Body() body: { status: AiModelStatus }) {
    return this.models.setStatus(id, body.status);
  }

  @Patch(':id/approval-state')
  @RequirePermissions('ai.modelRegistry.manage')
  setApprovalState(@Param('id') id: string, @Body() body: { approvalState: ModelApprovalState }) {
    return this.models.setApprovalState(id, body.approvalState);
  }

  @Patch(':id/rollback-target')
  @RequirePermissions('ai.modelRegistry.manage')
  setRollbackTarget(@Param('id') id: string, @Body() body: { rollbackTargetId: string | null }) {
    return this.models.setRollbackTarget(id, body.rollbackTargetId);
  }

  @Patch(':id/hardware-metadata')
  @RequirePermissions('ai.modelRegistry.manage')
  updateHardwareMetadata(@Param('id') id: string, @Body() body: { contextLength?: number; license?: string; hardwareRequirements?: Record<string, unknown>; embeddingDimensions?: number; embeddingCompatibleWith?: string[] }) {
    return this.models.updateHardwareMetadata(id, body);
  }

  @Get(':id/evaluation-history')
  @RequirePermissions('ai.modelRegistry.read')
  evaluationHistory(@Param('id') id: string) {
    return this.models.evaluationHistory(id);
  }
}
