import { Module } from '@nestjs/common';
import { IntegrationAdaptersController } from './adapters/integration-adapters.controller';
import { PartSyncHandler } from './handlers/part-sync.handler';
import { VehicleSyncHandler } from './handlers/vehicle-sync.handler';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';

@Module({
  controllers: [IntegrationController, IntegrationAdaptersController],
  providers: [IntegrationService, VehicleSyncHandler, PartSyncHandler],
  exports: [IntegrationService],
})
export class IntegrationModule {}
