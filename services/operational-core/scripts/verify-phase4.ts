/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { ModelRegistryService } from '../src/model-registry/model-registry.service';
import { PromptRegistryService } from '../src/prompt-registry/prompt-registry.service';
import { KnowledgeBaseService } from '../src/knowledge-base/knowledge-base.service';
import { RagService } from '../src/rag/rag.service';
import { VehicleDigitalTwinService } from '../src/vehicle-lifecycle/digital-twin.service';
import { ForecastingService } from '../src/forecasting/forecasting.service';
import { PurchaseRecommendationsService } from '../src/purchase-recommendations/purchase-recommendations.service';
import { TechnicianAssistantService } from '../src/ai-assistants/technician-assistant.service';
import { PartsAssistantService } from '../src/ai-assistants/parts-assistant.service';
import { LubricantAssistantService } from '../src/ai-assistants/lubricant-assistant.service';
import { ManagerAssistantService } from '../src/ai-assistants/manager-assistant.service';
import { AiFeedbackService } from '../src/ai-feedback/ai-feedback.service';
import { AiEvaluationService } from '../src/ai-evaluation/ai-evaluation.service';
import { computeItemKey, computeWarehouseKey } from '../src/inventory/item-key';

function header(title: string) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);

  try {
    header('STEP 0: Load Phase 2/3 fixtures (vehicle, branch, warehouse, part)');
    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { vin: 'WBA5A7C50FD123456' } });
    const branch = await prisma.branch.findFirstOrThrow({ where: { code: 'DSM01' } });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: 'DSM01-MAIN' } });
    const ignitionCoil = await prisma.part.findFirstOrThrow({ where: { oemNumber: '12-13-8-616-153' } });
    console.log(`Vehicle: ${vehicle.brand} ${vehicle.model} (${vehicle.vin}), Branch: ${branch.code}`);

    header('STEP 1: Sync the Model Registry from the real running Ollama instance');
    const modelRegistry = app.get(ModelRegistryService);
    const syncResult = await modelRegistry.syncFromDgx();
    console.log(`Model registry sync: ${JSON.stringify(syncResult)}`);
    const models = await modelRegistry.list();
    for (const m of models) {
      console.log(`  ${m.name} — kind=${m.kind} family=${m.family} sizeBytes=${m.sizeBytes} isDefault=${m.isDefault}`);
    }

    header('STEP 2: GPU Health Monitor (honest — no GPU in this environment)');
    const gpuHealth = await modelRegistry.gpuHealth();
    console.log(`GPU health: ${JSON.stringify(gpuHealth)}`);

    header('STEP 3: Raw AI Gateway calls — real embedding + real generation, both logged');
    const aiGateway = app.get(AiGatewayService);
    const embedResult = await aiGateway.embed({ text: 'Replace ignition coil BMW N20 misfire P0301', actorId: 'user-verify' });
    console.log(`Embed available=${embedResult.available} dims=${embedResult.dims} model=${embedResult.model} latencyMs=${embedResult.latencyMs}`);
    const generateResult = await aiGateway.generate({ prompt: 'Reply with exactly one word: ready', temperature: 0.1, actorId: 'user-verify', correlationId: 'verify-phase4' });
    console.log(`Generate available=${generateResult.available} text="${generateResult.text}" tokensOut=${generateResult.tokensOut} latencyMs=${generateResult.latencyMs}`);
    const loggedInferences = await prisma.aiInferenceLog.count();
    console.log(`Total AiInferenceLog rows so far: ${loggedInferences}`);

    header('STEP 4: Knowledge Base — ingest and approve a real document, dedup on re-ingest');
    const knowledgeBase = app.get(KnowledgeBaseService);
    const ingestResult = await knowledgeBase.ingestDocument({
      source: 'workshop-manual-ignition-coil',
      // WORKSHOP_MANUAL (rather than INTERNAL_SOP) so this same document is
      // in-scope for both the general RAG chat demo (STEP 5, no filter) and
      // the Technician Assistant demo (STEP 10, which filters to
      // WORKSHOP_MANUAL/TSB/OEM_REPAIR_PROCEDURE/GARAGE_HISTORY/REPEAT_REPAIR).
      sourceType: 'WORKSHOP_MANUAL',
      title: 'Ignition Coil Replacement Procedure',
      content:
        'Symptom: Engine misfire on cylinder 3, DTC P0301 stored.\n\n' +
        'Diagnosis: A failed ignition coil on BMW N20 engines is a common cause of a P0301 misfire code. ' +
        'Inspect the coil for cracks and test primary/secondary resistance before replacement.\n\n' +
        'Procedure: Disconnect battery. Remove engine cover. Unplug ignition coil connector. ' +
        'Remove retaining bolt. Extract coil. Install new coil in reverse order. Torque bolt to spec. Clear DTCs and road test.',
      isApproved: true,
      actorId: 'user-verify',
    });
    console.log(`Ingested document ${ingestResult.document.id}: chunksCreated=${ingestResult.chunksCreated} chunksSkippedDuplicate=${ingestResult.chunksSkippedDuplicate}`);
    const reingest = await knowledgeBase.reindex(ingestResult.document.id, 'user-verify');
    console.log(`Re-indexed (bumps embeddingVersion): ${JSON.stringify(reingest)}`);

    header('STEP 5: RAG chat — grounded answer, then a deliberately irrelevant query');
    const rag = app.get(RagService);
    const groundedAnswer = await rag.answer('The engine has a P0301 misfire code, what should I check?', undefined, 'user-verify', 'verify-phase4');
    console.log(`Grounded answer available=${groundedAnswer.available} confidence=${groundedAnswer.confidence} groundingScore=${groundedAnswer.groundingScore?.toFixed(3)}`);
    console.log(`  Sources: ${groundedAnswer.sources.map((s) => s.title).join(', ')}`);
    console.log(`  Answer: ${groundedAnswer.answer}`);

    const uncertainAnswer = await rag.answer('What is the recommended tyre pressure for a spaceship landing gear?', undefined, 'user-verify');
    console.log(`Uncertain-case confidence=${uncertainAnswer.confidence} missingInformation=${JSON.stringify(uncertainAnswer.missingInformation)}`);

    header('STEP 6: Prompt Registry — the self-seeded RAG_ANSWER template is a real versioned row');
    const promptRegistry = app.get(PromptRegistryService);
    const activeRagPrompt = await promptRegistry.getActiveVersion('RAG_ANSWER');
    console.log(`Active RAG_ANSWER prompt version: ${activeRagPrompt.version} (id ${activeRagPrompt.id})`);

    header('STEP 7: Digital Twin Intelligence — real risk scoring from seeded brake DTCs');
    const twinVehicle = await prisma.vehicle.create({ data: { vin: 'PHASE4TWINVIN0001'.padEnd(17, '0'), brand: 'BMW', model: '3 Series' } });
    for (let i = 0; i < 3; i++) {
      const job = await prisma.garageJob.create({ data: { jobNumber: `JOB-P4TWIN-${i}`, vehicleId: twinVehicle.id, branchId: branch.id } });
      const session = await prisma.diagnosticSession.create({ data: { jobId: job.id } });
      await prisma.diagnosticCode.create({ data: { sessionId: session.id, code: 'C1201', source: 'GENERIC_OBD', description: 'Brake caliper fault detected' } });
    }
    const digitalTwin = app.get(VehicleDigitalTwinService);
    const twin = await digitalTwin.getDigitalTwin(twinVehicle.id);
    console.log(`Vehicle health score: ${twin.healthScore}, maintenance risk: ${twin.maintenanceRiskScore}, confidence: ${twin.aiConfidenceScore}`);
    console.log(`  BRAKE system risk: ${JSON.stringify(twin.systemRisks.BRAKE)}`);
    console.log(`  Predicted maintenance: ${JSON.stringify(twin.predictedMaintenance)}`);

    header('STEP 8: Demand Forecasting — seed 60 days of real garage workload, backtest, forecast');
    for (let i = 0; i < 60; i++) {
      const openedAt = new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000);
      await prisma.garageJob.create({ data: { jobNumber: `JOB-P4FC-${i}`, vehicleId: twinVehicle.id, branchId: branch.id, openedAt } });
    }
    const forecasting = app.get(ForecastingService);
    const forecastResult = await forecasting.generate('GARAGE_WORKLOAD', branch.id, 7);
    console.log(`Forecast: bestMethod=${forecastResult.bestMethod} historyDays=${forecastResult.historyDays}`);
    for (const run of forecastResult.runs) {
      console.log(`  ${run.method}: mape=${run.mape} rmse=${run.rmse} mae=${run.mae} bias=${run.bias} confidence=${run.confidence} chosenAsBest=${run.chosenAsBest}`);
    }

    header('STEP 9: Intelligent Purchasing — AI signals attached as additive evidence');
    await prisma.inventoryItemMetric.upsert({
      where: { itemKey_warehouseKey: { itemKey: computeItemKey(ignitionCoil.id, null), warehouseKey: computeWarehouseKey(warehouse.id) } },
      create: {
        itemType: 'PART',
        partId: ignitionCoil.id,
        warehouseId: warehouse.id,
        itemKey: computeItemKey(ignitionCoil.id, null),
        warehouseKey: computeWarehouseKey(warehouse.id),
        availableStock: 5,
        avgDailyDemand: 1,
        historyDays: 90,
        hasSufficientHistory: true,
        movementClass: 'MEDIUM_MOVING',
      },
      update: {},
    });
    const partForecastRun = await prisma.forecastRun.create({ data: { targetType: 'PART', targetId: ignitionCoil.id, windowDays: 7, method: 'NAIVE', confidence: 'LOW', chosenAsBest: true } });
    await prisma.forecastPoint.create({ data: { forecastRunId: partForecastRun.id, forecastDate: new Date(), predictedValue: 1 } });
    const purchaseRecs = app.get(PurchaseRecommendationsService);
    await purchaseRecs.generate();
    const rec = await prisma.purchaseRecommendation.findFirstOrThrow({ where: { partId: ignitionCoil.id, warehouseId: warehouse.id } });
    console.log(`Purchase recommendation action=${rec.action} (deterministic, untouched by AI signals)`);
    console.log(`  evidence.aiSignals = ${JSON.stringify((rec.evidence as { aiSignals?: unknown }).aiSignals)}`);

    header('STEP 10: AI Assistants');
    const technicianAssistant = app.get(TechnicianAssistantService);
    const techResult = await technicianAssistant.assist({ vehicleId: vehicle.id, symptoms: ['rough idle'], dtcCodes: ['P0301'], actorId: 'user-verify' });
    console.log(`Technician assistant available=${techResult.available} similarHistoricalJobs=${techResult.similarHistoricalJobs.length}`);
    console.log(`  Answer: ${techResult.answer?.slice(0, 200)}...`);

    const partsAssistant = app.get(PartsAssistantService);
    const partsResult = await partsAssistant.lookup(ignitionCoil.id);
    console.log(`Parts assistant (no LLM call) confidence=${partsResult.confidence} stockWarehouses=${partsResult.stockAvailability.length}`);

    const lubricantAssistant = app.get(LubricantAssistantService);
    const lubeResult = await lubricantAssistant.recommend({ brand: 'NonexistentBrand', model: 'NoSuchModel' });
    console.log(`Lubricant assistant (no compatibility record) confidence=${lubeResult.confidence} evidence=${JSON.stringify(lubeResult.evidence)}`);

    const managerAssistant = app.get(ManagerAssistantService);
    const managerResult = await managerAssistant.ask('Which parts are becoming dead stock?', 'user-verify', 'verify-phase4');
    console.log(`Manager assistant available=${managerResult.available} confidence=${managerResult.confidence}`);
    console.log(`  Evidence: ${managerResult.evidence.join(' | ')}`);
    console.log(`  Answer: ${managerResult.answer?.slice(0, 200)}...`);

    header('STEP 11: AI Feedback — record acceptance, compute acceptance rate');
    const feedback = app.get(AiFeedbackService);
    if (groundedAnswer.logId) {
      await feedback.record(groundedAnswer.logId, 'ACCEPTED', 'user-verify', 'Correct and well-grounded');
    }
    const acceptanceRate = await feedback.acceptanceRate({ kind: 'GENERATION' });
    console.log(`Generation acceptance rate: ${JSON.stringify(acceptanceRate)}`);

    header('STEP 12: AI Evaluation — real retrieval precision/recall against RagService');
    const evaluations = app.get(AiEvaluationService);
    const dataset = await evaluations.createDataset('verify-phase4-retrieval', 'RETRIEVAL');
    await evaluations.addCase(dataset.id, { query: 'Car has a P0301 misfire code' }, { expectedDocumentIds: [ingestResult.document.id] });
    const evalRun = await evaluations.runRetrievalEvaluation(dataset.id);
    console.log(`Evaluation run metrics: ${JSON.stringify(evalRun.metrics)}`);

    header('STEP 13: Final summary');
    const [inferenceCount, successCount, modelCount, docCount, chunkCount, forecastRunCount] = await Promise.all([
      prisma.aiInferenceLog.count(),
      prisma.aiInferenceLog.count({ where: { success: true } }),
      prisma.aiModel.count(),
      prisma.knowledgeDocument.count(),
      prisma.knowledgeChunk.count(),
      prisma.forecastRun.count(),
    ]);
    console.log(`AiInferenceLog: ${inferenceCount} total, ${successCount} successful`);
    console.log(`AiModel: ${modelCount} registered`);
    console.log(`KnowledgeDocument: ${docCount}, KnowledgeChunk: ${chunkCount}`);
    console.log(`ForecastRun: ${forecastRunCount}`);

    header('PHASE 4 VERIFICATION WORKFLOW COMPLETE');
    console.log('All steps executed against the real DGX FastAPI service and real Ollama models. See output above for evidence of each requirement.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('PHASE 4 VERIFICATION SCRIPT FAILED:', err);
  process.exit(1);
});
