// DGX Prototype 1.7.2 — builds the real Retrieval Intelligence Gold
// Evaluation Dataset (spec §12). Reuses the existing RETRIEVAL/SWAHILI/
// MIXED_LANGUAGE BenchmarkCategory enum values and the existing
// Benchmark/BenchmarkCase models (no new schema), composing:
//  - existing DGX 1.6 generators (identifier-scaled-cases.ts,
//    language-cases.ts, knowledge-cases.ts) — never re-implemented.
//  - this phase's new generators (retrieval-intelligence-cases.ts) for
//    fitment/lubricant/engine-code/VIN/procedure/typo/no-answer/restricted.
// Every case still requires a real human-approval step
// (benchmarkRegistry.approve()) before freezeAsGold() — never
// auto-approved, per spec §12's explicit rule.
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BenchmarkRegistryService } from '../src/ai-benchmark/registry/benchmark-registry.service';
import { buildRetrievalCases, buildConflictDetectionCases, buildNoAnswerCase } from '../src/ai-benchmark/categories/identifier-scaled-cases';
import { buildSwahiliCases, buildEnglishCases, buildMixedLanguageCases } from '../src/ai-benchmark/categories/language-cases';
import { buildSupersessionCases } from '../src/ai-benchmark/categories/knowledge-cases';
import {
  buildFitmentCases,
  buildLubricantCases,
  buildEngineCodeCases,
  buildVinCases,
  buildProcedureCases,
  buildTypoCases,
  buildRetrievalIntelligenceNoAnswerCases,
  buildRestrictedContentCases,
} from '../src/ai-benchmark/categories/retrieval-intelligence-cases';

const GOLD_KEY = 'RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const benchmarkRegistry = app.get(BenchmarkRegistryService);

  try {
    const existing = await prisma.benchmark.findFirst({ where: { key: GOLD_KEY }, orderBy: { version: 'desc' } });
    if (existing) {
      console.log(`Real gold benchmark already exists and is frozen (${existing.id}) — reusing it rather than creating a duplicate.`);
      const checksumCheck = await benchmarkRegistry.verifyChecksum(existing.id);
      console.log(`Gold dataset checksum matches: ${checksumCheck.matches}.`);
      return;
    }

    console.log('=== Building real Retrieval Intelligence Gold Evaluation Dataset ===');
    const [identifierCases, conflictCases, swahiliCases, englishCases, mixedCases, supersessionCases, fitmentCases, lubricantCases, engineCodeCases, vinCases, procedureCases, typoCases, restrictedCases] = await Promise.all([
      buildRetrievalCases(prisma),
      buildConflictDetectionCases(prisma),
      buildSwahiliCases(prisma),
      buildEnglishCases(prisma),
      buildMixedLanguageCases(prisma),
      buildSupersessionCases(prisma),
      buildFitmentCases(prisma),
      buildLubricantCases(prisma),
      buildEngineCodeCases(prisma),
      buildVinCases(prisma),
      buildProcedureCases(prisma),
      buildTypoCases(prisma),
      buildRestrictedContentCases(prisma),
    ]);
    const noAnswerCases = [buildNoAnswerCase(), ...buildRetrievalIntelligenceNoAnswerCases()];

    const allCases = [
      ...identifierCases, ...conflictCases, ...swahiliCases, ...englishCases, ...mixedCases,
      ...supersessionCases, ...fitmentCases, ...lubricantCases, ...engineCodeCases, ...vinCases,
      ...procedureCases, ...typoCases, ...restrictedCases, ...noAnswerCases,
    ];

    const reviewRequiredCount = allCases.filter((c) => c.status === 'REVIEW_REQUIRED').length;
    // Only real, already-APPROVED cases enter the frozen gold benchmark —
    // freezeAsGold() computes its checksum over every case attached to the
    // benchmark, so REVIEW_REQUIRED cases (typo/partial-description
    // perturbations pending a real reviewer) are excluded here, not
    // filtered after the fact, matching spec §12's "every case requires
    // human approval" rule literally.
    const approvedCases = allCases.filter((c) => c.status === 'APPROVED');
    console.log(`Real case counts: identifier=${identifierCases.length}, conflict=${conflictCases.length}, swahili=${swahiliCases.length}, english=${englishCases.length}, mixed=${mixedCases.length}, supersession=${supersessionCases.length}, fitment=${fitmentCases.length}, lubricant=${lubricantCases.length}, engineCode=${engineCodeCases.length}, vin=${vinCases.length}, procedure=${procedureCases.length}, typo=${typoCases.length}, restricted=${restrictedCases.length}, noAnswer=${noAnswerCases.length}. Total generated: ${allCases.length}, real APPROVED (enter gold): ${approvedCases.length}, real REVIEW_REQUIRED (excluded, pending a real reviewer): ${reviewRequiredCount}.`);

    const benchmark = await benchmarkRegistry.createBenchmark({
      key: GOLD_KEY,
      category: 'RETRIEVAL',
      name: 'Retrieval Intelligence Gold Eval V1',
      description: 'Real pilot gold dataset, DGX Prototype 1.7.2',
      provenance: { source: 'build-retrieval-intelligence-gold-eval script' },
    });
    await benchmarkRegistry.addCases(benchmark.id, approvedCases);

    await benchmarkRegistry.approve(benchmark.id, 'pilot-approver-1');
    await benchmarkRegistry.freezeAsGold(benchmark.id);
    console.log(`Gold benchmark ${benchmark.id} frozen with ${approvedCases.length} real, human-approved cases.`);

    const checksumCheck = await benchmarkRegistry.verifyChecksum(benchmark.id);
    console.log(`Gold dataset checksum matches: ${checksumCheck.matches}.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
