import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { NeonCacheSyncService } from './neon-cache-sync.service';

@ApiTags('neon-cache')
@Controller('neon-cache')
@UseGuards(PermissionsGuard)
export class NeonCacheController {
  constructor(private readonly neonCache: NeonCacheSyncService) {}

  @Get('health')
  @RequirePermissions('observability.read')
  async health() {
    return { configured: this.neonCache.isConfigured(), available: await this.neonCache.isAvailable() };
  }

  @Post('sync/purchase-recommendations')
  @RequirePermissions('integration.manage')
  syncPurchaseRecommendations() {
    return this.neonCache.syncPurchaseRecommendations();
  }

  @Get('datasets/:name')
  @RequirePermissions('observability.read')
  getDataset(@Param('name') name: string) {
    return this.neonCache.getCachedDataset(name);
  }
}
