import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env-validation';
import { AuditModule } from './common/audit/audit.module';
import { DataQualityModule } from './common/data-quality/data-quality.module';
import { AppEventsModule } from './app-events/app-events.module';
import { AiAssistantsModule } from './ai-assistants/ai-assistants.module';
import { AiEvaluationModule } from './ai-evaluation/ai-evaluation.module';
import { AiFeedbackModule } from './ai-feedback/ai-feedback.module';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module';
import { ApiPlatformModule } from './api-platform/api-platform.module';
import { BackupModule } from './backup/backup.module';
import { BranchesModule } from './branches/branches.module';
import { BranchGatewayModule } from './branch-gateway/branch-gateway.module';
import { CdcModule } from './cdc/cdc.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DataConsolidationModule } from './data-consolidation/data-consolidation.module';
import { DataReadinessModule } from './data-readiness/data-readiness.module';
import { CatalogueAiModule } from './catalogue-ai/catalogue-ai.module';
import { AiBenchmarkModule } from './ai-benchmark/ai-benchmark.module';
import { KnowledgePlatformModule } from './knowledge-platform/knowledge-platform.module';
import { RetrievalIntelligenceModule } from './retrieval-intelligence/retrieval-intelligence.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { EstimatesModule } from './estimates/estimates.module';
import { GarageInventoryModule } from './garage-inventory/garage-inventory.module';
import { GarageJobsModule } from './garage-jobs/garage-jobs.module';
import { IdentityModule } from './identity/identity.module';
import { InspectionsModule } from './inspections/inspections.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReceptionModule } from './reception/reception.module';
import { CustomersModule } from './customers/customers.module';
import { IntegrationModule } from './integration/integration.module';
import { InventoryModule } from './inventory/inventory.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ForecastingModule } from './forecasting/forecasting.module';
import { InventoryAnalyticsModule } from './inventory-analytics/inventory-analytics.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { LabourModule } from './labour/labour.module';
import { LostSalesModule } from './lost-sales/lost-sales.module';
import { LubricantsModule } from './lubricants/lubricants.module';
import { ModelRegistryModule } from './model-registry/model-registry.module';
import { NeonCacheModule } from './neon-cache/neon-cache.module';
import { NotificationServiceModule } from './notification-service/notification-service.module';
import { ObservabilityModule } from './observability/observability.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PartsModule } from './parts/parts.module';
import { PrismaModule } from './prisma/prisma.module';
import { PromptRegistryModule } from './prompt-registry/prompt-registry.module';
import { RagModule } from './rag/rag.module';
import { RedisModule } from './redis/redis.module';
import { TwinIntelligenceModule } from './twin-intelligence/twin-intelligence.module';
import { VectorSearchModule } from './vector-search/vector-search.module';
import { PurchaseRecommendationsModule } from './purchase-recommendations/purchase-recommendations.module';
import { PurchasesModule } from './purchases/purchases.module';
import { QualityControlModule } from './quality-control/quality-control.module';
import { SalesModule } from './sales/sales.module';
import { SupplierAnalyticsModule } from './supplier-analytics/supplier-analytics.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { TechniciansModule } from './technicians/technicians.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { TransferRecommendationsModule } from './transfer-recommendations/transfer-recommendations.module';
import { VehicleLifecycleModule } from './vehicle-lifecycle/vehicle-lifecycle.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { WorkshopAnalyticsModule } from './workshop-analytics/workshop-analytics.module';
import { WorkshopInventoryRequestsModule } from './workshop-inventory-requests/workshop-inventory-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuditModule,
    DataQualityModule,
    VehiclesModule,
    PartsModule,
    IntegrationModule,
    OrganizationsModule,
    BranchesModule,
    WarehousesModule,
    CustomersModule,
    LubricantsModule,
    InventoryModule,
    SuppliersModule,
    PurchasesModule,
    SalesModule,
    AppEventsModule,
    LostSalesModule,
    InventoryAnalyticsModule,
    PurchaseRecommendationsModule,
    TransferRecommendationsModule,
    SupplierAnalyticsModule,
    TechniciansModule,
    LabourModule,
    ChecklistsModule,
    ReceptionModule,
    GarageJobsModule,
    InspectionsModule,
    DiagnosticsModule,
    EstimatesModule,
    GarageInventoryModule,
    QualityControlModule,
    VehicleLifecycleModule,
    NotificationsModule,
    WorkshopAnalyticsModule,
    WorkshopInventoryRequestsModule,
    AiGatewayModule,
    ModelRegistryModule,
    PromptRegistryModule,
    EmbeddingsModule,
    VectorSearchModule,
    KnowledgeBaseModule,
    RagModule,
    TwinIntelligenceModule,
    ForecastingModule,
    AiAssistantsModule,
    AiFeedbackModule,
    AiEvaluationModule,
    IdentityModule,
    TenancyModule,
    RedisModule,
    ApiPlatformModule,
    CdcModule,
    BranchGatewayModule,
    NeonCacheModule,
    NotificationServiceModule,
    BackupModule,
    ObservabilityModule,
    DataConsolidationModule,
    DataReadinessModule,
    CatalogueAiModule,
    AiBenchmarkModule,
    KnowledgePlatformModule,
    RetrievalIntelligenceModule,
  ],
})
export class AppModule {}
