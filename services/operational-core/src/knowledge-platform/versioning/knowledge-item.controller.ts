// DGX Prototype 1.7.1 — real "Document Viewer" screen backend (spec §21
// screen 4). Thin wrapper over the existing, unmodified
// KnowledgeItemRegistryService — zero new versioning logic.
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeItemRegistryService } from './knowledge-item-registry.service';

@Controller('knowledge/items')
@UseGuards(PermissionsGuard)
export class KnowledgeItemController {
  constructor(private readonly itemRegistry: KnowledgeItemRegistryService) {}

  @Get(':key/versions')
  @RequirePermissions('knowledgeItem.read')
  listVersions(@Param('key') key: string) {
    return this.itemRegistry.listVersions(key);
  }

  @Get(':key/current')
  @RequirePermissions('knowledgeItem.read')
  getCurrentVersion(@Param('key') key: string) {
    return this.itemRegistry.getCurrentVersion(key);
  }
}
