import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { InventoryAnalyticsService } from '../inventory-analytics/inventory-analytics.service';
import { PromptRegistryService } from '../prompt-registry/prompt-registry.service';
import { PurchaseRecommendationsService } from '../purchase-recommendations/purchase-recommendations.service';
import { RagService } from '../rag/rag.service';
import { SupplierAnalyticsService } from '../supplier-analytics/supplier-analytics.service';
import { WorkshopAnalyticsService } from '../workshop-analytics/workshop-analytics.service';

export interface ManagerAssistantResult {
  available: boolean;
  answer: string | null;
  evidence: string[];
  confidence: string;
  logId?: string;
  errorMessage?: string;
}

// Spec §14: "What should we buy next month? Which branches are
// underperforming? Which supplier is becoming unreliable? ... Every answer
// must contain evidence." This is grounding from LIVE OPERATIONAL
// ANALYTICS, not the document knowledge base — deliberately bypasses
// RagService's vector search and calls AiGatewayService.generate()
// directly, because the "evidence" a manager's question needs is real-time
// numbers from InventoryAnalyticsService/SupplierAnalyticsService/
// WorkshopAnalyticsService/PurchaseRecommendationsService (all Phase 2/3
// engines, reused verbatim, never recomputed here). The LLM's job is only
// to summarize and answer in natural language from numbers already computed
// deterministically — it never invents a metric that isn't in the bundle.
@Injectable()
export class ManagerAssistantService {
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly rag: RagService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly inventoryAnalytics: InventoryAnalyticsService,
    private readonly workshopAnalytics: WorkshopAnalyticsService,
    private readonly supplierAnalytics: SupplierAnalyticsService,
    private readonly purchaseRecs: PurchaseRecommendationsService,
  ) {}

  async ask(question: string, actorId?: string, correlationId?: string): Promise<ManagerAssistantResult> {
    const [deadStock, commonRepairs, delayedJobs, supplierMetrics, pendingPurchaseRecs] = await Promise.all([
      this.inventoryAnalytics.getClassification({ movementClass: 'DEAD_STOCK' }),
      this.workshopAnalytics.getMostCommonRepairs(),
      this.workshopAnalytics.getDelayedJobs(),
      this.supplierAnalytics.listMetrics(),
      this.purchaseRecs.list({ status: 'PENDING' }),
    ]);

    const evidence: string[] = [
      `${deadStock.length} item(s) classified as dead stock`,
      `Top repairs by frequency: ${commonRepairs.slice(0, 5).map((r) => `${r.operation} (${r.count})`).join(', ') || 'none recorded'}`,
      `${delayedJobs.length} job(s) currently delayed past their expected completion time`,
      `Supplier reliability: ${supplierMetrics
        .slice(0, 5)
        .map((s) => `${s.supplierId} on-time ${s.onTimeDeliveryPct ?? 'insufficient data'}%`)
        .join(', ') || 'no supplier metrics available'}`,
      `${pendingPurchaseRecs.length} purchase recommendation(s) awaiting approval`,
    ];

    const hasRealData = deadStock.length > 0 || commonRepairs.length > 0 || delayedJobs.length > 0 || supplierMetrics.length > 0 || pendingPurchaseRecs.length > 0;

    await this.rag.ensurePromptSeeded('MANAGER_ASSISTANT', {
      systemPrompt:
        'You are a management analytics assistant for an automotive operations business. Answer ONLY using the operational data bundle provided — every claim in your answer must be traceable to a number in that bundle. If the bundle does not contain enough information to answer the question, say so explicitly rather than speculating.',
      userPromptTemplate:
        'Question: {{question}}\n\nOperational data bundle:\n{{context}}\n\nProvide a concise, evidence-based answer. Cite the specific figures you used.',
      temperature: 0.2,
    });

    const rendered = await this.promptRegistry.render('MANAGER_ASSISTANT', {
      question,
      context: evidence.join('\n'),
    });

    const generation = await this.aiGateway.generate({
      prompt: rendered.userPrompt,
      system: rendered.systemPrompt,
      temperature: rendered.temperature,
      maxTokens: rendered.maxTokens,
      promptVersionId: rendered.promptVersionId,
      actorId,
      correlationId,
      retrievedDocumentIds: [],
    });

    if (!generation.available) {
      return { available: false, answer: null, evidence, confidence: 'NONE', errorMessage: generation.errorMessage };
    }

    return {
      available: true,
      answer: generation.text ?? null,
      evidence,
      confidence: hasRealData ? 'MEDIUM' : 'LOW',
      logId: generation.logId,
    };
  }
}
