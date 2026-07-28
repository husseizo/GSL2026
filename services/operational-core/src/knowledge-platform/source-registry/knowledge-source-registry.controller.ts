import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { KnowledgeSourceAuthority, KnowledgeSourceStatus } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeSourceRegistryService, RegisterSourceInput } from './knowledge-source-registry.service';

@Controller('knowledge/sources')
@UseGuards(PermissionsGuard)
export class KnowledgeSourceRegistryController {
  constructor(private readonly registry: KnowledgeSourceRegistryService) {}

  @Get()
  @RequirePermissions('knowledgeSource.read')
  list(@Query('status') status?: KnowledgeSourceStatus, @Query('authority') authority?: KnowledgeSourceAuthority) {
    return this.registry.list({ status, authority });
  }

  @Get(':id')
  @RequirePermissions('knowledgeSource.read')
  getById(@Param('id') id: string) {
    return this.registry.getById(id);
  }

  @Post()
  @RequirePermissions('knowledgeSource.manage')
  register(@Body() body: RegisterSourceInput) {
    return this.registry.register(body);
  }

  @Post(':id/verify-license')
  @RequirePermissions('knowledgeSource.verifyLicense')
  verifyLicense(@Param('id') id: string, @Body() body: { reviewerId: string }) {
    return this.registry.verifyLicense(id, body.reviewerId);
  }

  @Post(':id/approve-with-restrictions')
  @RequirePermissions('knowledgeSource.verifyLicense')
  approveWithRestrictions(@Param('id') id: string, @Body() body: { reviewerId: string; restrictedReason: string }) {
    return this.registry.approveWithRestrictions(id, body.reviewerId, body.restrictedReason);
  }

  @Post(':id/reject')
  @RequirePermissions('knowledgeSource.verifyLicense')
  reject(@Param('id') id: string, @Body() body: { reviewerId: string; reason: string }) {
    return this.registry.reject(id, body.reviewerId, body.reason);
  }

  @Post(':id/suspend')
  @RequirePermissions('knowledgeSource.manage')
  suspend(@Param('id') id: string, @Body() body: { actorId: string; reason: string }) {
    return this.registry.suspend(id, body.actorId, body.reason);
  }
}
