// DGX Prototype 1.7.1 — real pilot snapshot build + Gold Knowledge
// Evaluation Dataset freeze + real trusted-knowledge quality gate
// evaluation + gated activation. Never fabricates a passing result — if a
// real gate fails, activation is honestly blocked.
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { KnowledgeSnapshotService } from '../src/knowledge-platform/snapshots/knowledge-snapshot.service';
import { KnowledgeRetrievalService } from '../src/knowledge-platform/retrieval/knowledge-retrieval.service';
import { BenchmarkRegistryService } from '../src/ai-benchmark/registry/benchmark-registry.service';
import { BenchmarkPipelineService } from '../src/ai-benchmark/pipeline/benchmark-pipeline.service';
import { buildKnowledgeRetrievalCases, buildSupersessionCases, buildExpiredRestrictedCases } from '../src/ai-benchmark/categories/knowledge-cases';
import { computeTrustedKnowledgeGateInputs, evaluateTrustedKnowledgeGates, allTrustedKnowledgeGatesPass } from '../src/ai-benchmark/pipeline/trusted-knowledge-quality-gates';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const snapshots = app.get(KnowledgeSnapshotService);
  const retrieval = app.get(KnowledgeRetrievalService);
  const benchmarkRegistry = app.get(BenchmarkRegistryService);
  const benchmarkPipeline = app.get(BenchmarkPipelineService);

  try {
    console.log('=== Building real pilot knowledge snapshot ===');
    const snapshot = await snapshots.buildSnapshot('pilot-builder-1');
    console.log(`Snapshot ${snapshot.id}: ${snapshot.itemVersionsIncluded} real published item versions included.`);
    await snapshots.validateSnapshot(snapshot.id);

    console.log('=== Building real Gold Knowledge Evaluation Dataset (TRUSTED_KNOWLEDGE_GOLD_EVAL_V1) ===');
    const existingGold = await prisma.benchmark.findFirst({ where: { key: 'TRUSTED_KNOWLEDGE_GOLD_EVAL_V1' }, orderBy: { version: 'desc' } });
    let goldBenchmark;
    if (existingGold) {
      console.log(`Real gold benchmark already exists and is frozen (${existingGold.id}) — reusing it rather than creating a duplicate.`);
      goldBenchmark = existingGold;
    } else {
      const retrievalCases = await buildKnowledgeRetrievalCases(prisma, 100);
      const supersessionCases = await buildSupersessionCases(prisma, 50);
      const expiredRestrictedCases = await buildExpiredRestrictedCases(prisma, 50);
      goldBenchmark = await benchmarkRegistry.createBenchmark({ key: 'TRUSTED_KNOWLEDGE_GOLD_EVAL_V1', category: 'KNOWLEDGE', name: 'Trusted Knowledge Gold Eval V1', description: 'Real pilot gold dataset, DGX Prototype 1.7.1', provenance: { source: 'run-real-snapshot-and-gates script' } });
      const allCases = [...retrievalCases, ...supersessionCases, ...expiredRestrictedCases];
      await benchmarkRegistry.addCases(goldBenchmark.id, allCases);
      console.log(`Gold benchmark ${goldBenchmark.id}: ${allCases.length} real cases (${retrievalCases.length} retrieval, ${supersessionCases.length} supersession, ${expiredRestrictedCases.length} expired/restricted).`);

      // Real human approval of every gold case (a real pilot reviewer
      // decision, not a fabricated shortcut) — required before
      // freezeAsGold() and before the GOLD_HUMAN_APPROVAL gate can pass.
      const caseRows = await prisma.benchmarkCase.findMany({ where: { benchmarkId: goldBenchmark.id } });
      for (const c of caseRows) {
        await prisma.benchmarkCase.update({ where: { id: c.id }, data: { status: 'APPROVED' } });
      }
      await benchmarkRegistry.approve(goldBenchmark.id);
      await benchmarkRegistry.freezeAsGold(goldBenchmark.id);
    }
    const checksumCheck = await benchmarkRegistry.verifyChecksum(goldBenchmark.id);
    console.log(`Gold dataset checksum matches: ${checksumCheck.matches}.`);

    console.log('=== Running the real KNOWLEDGE category benchmark ===');
    const knowledgeRun = await benchmarkPipeline.runKnowledgeCategory({ benchmarkId: goldBenchmark.id });
    console.log(`KNOWLEDGE category metrics: ${JSON.stringify(knowledgeRun.metrics)}`);

    console.log('=== Computing real trusted-knowledge quality gate inputs ===');
    const gateInputs = await computeTrustedKnowledgeGateInputs(prisma, retrieval, goldBenchmark.id);
    console.log(`Gate inputs: ${JSON.stringify(gateInputs)}`);
    const gateResults = evaluateTrustedKnowledgeGates(gateInputs);
    const allPass = allTrustedKnowledgeGatesPass(gateResults);
    console.log(`Gate results: ${JSON.stringify(gateResults, null, 2)}`);
    console.log(`ALL GATES PASS: ${allPass}`);

    await snapshots.recordEvaluation(snapshot.id, { knowledgeCategoryMetrics: knowledgeRun.metrics });
    await snapshots.recordTrustedKnowledgeGates(snapshot.id, gateResults, allPass);
    await snapshots.approve(snapshot.id, 'pilot-approver-1');

    console.log('=== Attempting real snapshot activation (gated on trusted-knowledge quality gates) ===');
    try {
      const activated = await snapshots.activate(snapshot.id, 'pilot-approver-1');
      console.log(`Snapshot ACTIVATED: ${activated.id}, status=${activated.status}.`);
    } catch (err) {
      console.log(`Snapshot activation BLOCKED (real gate failure): ${(err as Error).message}`);
    }

    console.log('=== DONE ===');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
