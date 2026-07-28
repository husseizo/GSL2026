import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { InventoryAnalyticsModule } from '../inventory-analytics/inventory-analytics.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PromptRegistryModule } from '../prompt-registry/prompt-registry.module';
import { PurchaseRecommendationsModule } from '../purchase-recommendations/purchase-recommendations.module';
import { RagModule } from '../rag/rag.module';
import { SupplierAnalyticsModule } from '../supplier-analytics/supplier-analytics.module';
import { VehicleLifecycleModule } from '../vehicle-lifecycle/vehicle-lifecycle.module';
import { WorkshopAnalyticsModule } from '../workshop-analytics/workshop-analytics.module';
import { AiAssistantsController } from './ai-assistants.controller';
import { LubricantAssistantService } from './lubricant-assistant.service';
import { ManagerAssistantService } from './manager-assistant.service';
import { PartsAssistantService } from './parts-assistant.service';
import { TechnicianAssistantService } from './technician-assistant.service';

// Every assistant reuses an existing Phase 2/3/4 service rather than
// re-querying its tables — see each assistant file's header comment for
// exactly which service it reuses. This module only wires them together.
@Module({
  imports: [
    AiGatewayModule,
    RagModule,
    PromptRegistryModule,
    InventoryModule,
    InventoryAnalyticsModule,
    WorkshopAnalyticsModule,
    SupplierAnalyticsModule,
    PurchaseRecommendationsModule,
    VehicleLifecycleModule,
  ],
  controllers: [AiAssistantsController],
  providers: [TechnicianAssistantService, PartsAssistantService, LubricantAssistantService, ManagerAssistantService],
})
export class AiAssistantsModule {}
