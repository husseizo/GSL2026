import { Module } from '@nestjs/common';
import { NeonCacheController } from './neon-cache.controller';
import { NeonCacheSyncService } from './neon-cache-sync.service';

@Module({
  controllers: [NeonCacheController],
  providers: [NeonCacheSyncService],
  exports: [NeonCacheSyncService],
})
export class NeonCacheModule {}
