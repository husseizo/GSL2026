import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { RateLimiterService } from '../ai-gateway/rate-limiter.service';
import { AuditService } from '../common/audit/audit.service';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { InventoryAnalyticsService } from '../inventory-analytics/inventory-analytics.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { AiPurchasingSignalsService } from '../purchase-recommendations/ai-purchasing-signals.service';
import { PurchaseRecommendationsService } from '../purchase-recommendations/purchase-recommendations.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromptRegistryService } from '../prompt-registry/prompt-registry.service';
import { RagService } from '../rag/rag.service';
import { SupplierAnalyticsService } from '../supplier-analytics/supplier-analytics.service';
import { createPartFixture, createVehicleFixture, createWarehouseFixture } from '../test-helpers/db-fixtures';
import { PostgresArrayVectorIndexProvider } from '../vector-search/postgres-array-vector-index.provider';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { RepeatRepairService } from '../vehicle-lifecycle/repeat-repair.service';
import { VehicleDigitalTwinService } from '../vehicle-lifecycle/digital-twin.service';
import { WorkshopAnalyticsService } from '../workshop-analytics/workshop-analytics.service';
import { LubricantAssistantService } from './lubricant-assistant.service';
import { ManagerAssistantService } from './manager-assistant.service';
import { PartsAssistantService } from './parts-assistant.service';
import { TechnicianAssistantService } from './technician-assistant.service';

// Real Ollama for the two generation-backed assistants (technician,
// manager); parts/lubricant assistants are deliberately LLM-free (see their
// own header comments) so those tests never touch Ollama at all.
describe('AI Assistants (integration, real DGX/Ollama where applicable)', () => {
  let prisma: PrismaService;
  let technicianAssistant: TechnicianAssistantService;
  let partsAssistant: PartsAssistantService;
  let lubricantAssistant: LubricantAssistantService;
  let managerAssistant: ManagerAssistantService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const dgxClient = new DgxClientService();
    const aiGateway = new AiGatewayService(prisma, dgxClient, new RateLimiterService());
    const vectorSearch = new VectorSearchService(prisma, new PostgresArrayVectorIndexProvider(prisma));
    const promptRegistry = new PromptRegistryService(prisma);
    const rag = new RagService(aiGateway, vectorSearch, promptRegistry);
    const ledger = new InventoryLedgerService(prisma, new DataQualityService(prisma));
    const digitalTwin = new VehicleDigitalTwinService(prisma);
    const repeatRepair = new RepeatRepairService(prisma, new AuditService(prisma));

    technicianAssistant = new TechnicianAssistantService(rag, digitalTwin, repeatRepair);
    partsAssistant = new PartsAssistantService(prisma, ledger);
    lubricantAssistant = new LubricantAssistantService(prisma, ledger);

    const inventoryAnalytics = new InventoryAnalyticsService(prisma);
    const workshopAnalytics = new WorkshopAnalyticsService(prisma);
    const supplierAnalytics = new SupplierAnalyticsService(prisma);
    const purchaseRecs = new PurchaseRecommendationsService(prisma, new AuditService(prisma), new AiPurchasingSignalsService(prisma));
    managerAssistant = new ManagerAssistantService(aiGateway, rag, promptRegistry, inventoryAnalytics, workshopAnalytics, supplierAnalytics, purchaseRecs);
  }, 30_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('TechnicianAssistantService never declares a confirmed diagnosis and cites real vehicle history', async () => {
    const { branch } = await createWarehouseFixture(prisma, 'techassist-1');
    const vehicle = await createVehicleFixture(prisma, 'techassist-1');
    const job = await prisma.garageJob.create({ data: { jobNumber: 'JOB-TA-1', vehicleId: vehicle.id, branchId: branch.id } });
    const session = await prisma.diagnosticSession.create({ data: { jobId: job.id } });
    await prisma.diagnosticCode.create({ data: { sessionId: session.id, code: 'P0301', source: 'GENERIC_OBD', description: 'Cylinder 3 misfire' } });

    const result = await technicianAssistant.assist({
      vehicleId: vehicle.id,
      symptoms: ['rough idle', 'check engine light on'],
      dtcCodes: ['P0301'],
    });

    expect(result.available).toBe(true);
    expect(result.similarHistoricalJobs.length).toBeGreaterThan(0);
    expect(Array.isArray(result.repeatRepairFlags)).toBe(true);
    if (result.answer) {
      expect(result.answer.toLowerCase()).not.toContain('confirmed diagnosis');
    }
  }, 60_000);

  it('PartsAssistantService returns real stock/cross-reference/frequently-replaced-together data, no LLM call', async () => {
    const part = await createPartFixture(prisma, 'partsassist-1');
    const altPart = await createPartFixture(prisma, 'partsassist-1-alt');
    await prisma.partMatchCandidate.create({
      data: { partAId: part.id, partBId: altPart.id, stage: 'RULE_BASED', score: 0.9, rationale: 'Same OEM family', status: 'APPROVED' },
    });

    const result = await partsAssistant.lookup(part.id);
    expect(result.crossReferencesAndSupersessions).toHaveLength(1);
    expect(result.crossReferencesAndSupersessions[0].partId).toBe(altPart.id);
    expect(result.confidence).toBe('MEDIUM');
  });

  it('LubricantAssistantService returns no recommendation (not a guess) when no compatibility record exists', async () => {
    const result = await lubricantAssistant.recommend({ brand: 'NonexistentBrand', model: 'NoSuchModel' });
    expect(result.recommendations).toEqual([]);
    expect(result.confidence).toBe('LOW');
    expect(result.evidence[0]).toContain('No LubricantCompatibility record');
  });

  it('LubricantAssistantService cites real OEM approvals when a compatibility record exists', async () => {
    const product = await prisma.lubricantProduct.create({
      data: { brand: 'Castrol', productName: 'EDGE 5W-30 LL', normalizedName: 'castrol edge 5w-30 ll', category: 'ENGINE_OIL', viscosity: '5W-30' },
    });
    await prisma.lubricantApproval.create({ data: { lubricantProductId: product.id, oemBrand: 'BMW', approvalCode: 'LL-04', isVerified: true } });
    await prisma.lubricantCompatibility.create({ data: { lubricantProductId: product.id, brand: 'BMW', model: '5 Series', engineCode: 'N20' } });

    const result = await lubricantAssistant.recommend({ brand: 'BMW', model: '5 Series', engineCode: 'N20' });
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].oemApprovals).toContainEqual({ oemBrand: 'BMW', approvalCode: 'LL-04', isVerified: true });
    expect(result.confidence).toBe('HIGH');
  });

  it('ManagerAssistantService grounds its answer in real computed analytics, citing evidence', async () => {
    const result = await managerAssistant.ask('Which parts are becoming dead stock?');
    expect(result.available).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.some((e) => e.includes('dead stock'))).toBe(true);
  }, 120_000);
});
