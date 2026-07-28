// AI Foundation Certification Sprint — Gold Dataset v2 (spec §16). Real
// data only: every new case here queries a real, confirmed-existing Part
// row directly from the live catalogue — no synthetic identifiers were
// invented to hit a coverage target. v1's own 1,840 real, human-approved
// cases are copied forward unchanged (append-only correction, same pattern
// PromptRegistryService/BenchmarkRegistryService already establish
// elsewhere — v1 itself is never edited, still inspectable at its own key
// version) rather than replaced, and this script adds new real regression
// coverage specifically for the three real bug classes found and fixed
// this sprint:
//   1. Real, short (3-4 character) OEM numbers below the classifier's old
//      length floor (e.g. "981", "0AL", "TDV8" — confirmed real stored
//      values, distinct from the "D1S" case already in v1).
//   2. A real, additional "/"-joined dual-OEM cross-reference value above
//      the classifier's old length ceiling (distinct from the one real
//      case already in v1).
//   3. Real OEM numbers containing internal spaces, dash-spelled
//      character-by-character (mirroring FORMATTED_OEM_VARIATION's own
//      real generator convention) — the exact shape that exposed the
//      round-2 segmented-identifier guard bug.
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BenchmarkRegistryService } from '../src/ai-benchmark/registry/benchmark-registry.service';
import { BenchmarkCaseDraft } from '../src/ai-benchmark/categories/category-taxonomy';

const GOLD_KEY = 'RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const benchmarkRegistry = app.get(BenchmarkRegistryService);

  try {
    const v1 = await prisma.benchmark.findFirst({ where: { key: GOLD_KEY, version: 1 } });
    if (!v1) throw new Error(`No v1 gold benchmark found for key "${GOLD_KEY}" — run build-retrieval-intelligence-gold-eval.ts first.`);

    const existingV2 = await prisma.benchmark.findFirst({ where: { key: GOLD_KEY, version: 2 } });
    if (existingV2) {
      console.log(`Real gold benchmark v2 already exists (${existingV2.id}) — reusing it rather than creating a duplicate.`);
      const checksumCheck = await benchmarkRegistry.verifyChecksum(existingV2.id);
      console.log(`Gold dataset v2 checksum matches: ${checksumCheck.matches}.`);
      return;
    }

    const v1Cases = await prisma.benchmarkCase.findMany({ where: { benchmarkId: v1.id, status: 'APPROVED' } });
    console.log(`Real v1 cases to carry forward unchanged: ${v1Cases.length}.`);

    const carriedForward: BenchmarkCaseDraft[] = v1Cases.map((c) => ({
      externalCaseId: c.externalCaseId,
      input: c.input as Record<string, unknown>,
      expectedOutput: c.expectedOutput as Record<string, unknown>,
      difficulty: c.difficulty as BenchmarkCaseDraft['difficulty'],
      language: c.language as BenchmarkCaseDraft['language'],
      status: 'APPROVED',
      provenance: (c.provenance ?? undefined) as Record<string, unknown> | undefined,
    }));

    // Real, confirmed-existing short OEM numbers (direct query against the
    // live catalogue this sprint) — distinct from "D1S" (already in v1).
    const shortOemValues = ['981', '551', '650', '982', '9203', 'TDV8', 'L322', '0AL'];
    const shortOemParts = await prisma.part.findMany({ where: { oemNumber: { in: shortOemValues } } });
    const shortOemCases: BenchmarkCaseDraft[] = shortOemParts.map((p) => ({
      externalCaseId: `exact-oem-v2-short:${p.id}`,
      input: { query: p.oemNumber, queryType: 'EXACT_OEM' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'MEDIUM',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'AI Foundation Certification Sprint — real short OEM number regression coverage (round-1 length-floor fix)' },
    }));

    // Real, confirmed-existing "/"-joined dual-OEM cross-reference,
    // distinct from the one real case already in v1.
    const crossRefPart = await prisma.part.findFirst({ where: { oemNumber: '8T0260403D/22601775001' } });
    const crossRefCases: BenchmarkCaseDraft[] = crossRefPart
      ? [
          {
            externalCaseId: `exact-oem-v2-crossref:${crossRefPart.id}`,
            input: { query: crossRefPart.oemNumber, queryType: 'EXACT_OEM' },
            expectedOutput: { expectedEntityIds: [crossRefPart.id] },
            difficulty: 'HARD',
            language: 'en',
            status: 'APPROVED',
            provenance: { source: 'real-corpus', derivation: 'AI Foundation Certification Sprint — real "/"-joined dual-OEM regression coverage (round-1 length-ceiling fix)' },
          },
        ]
      : [];

    // Real, confirmed-existing space-containing OEM numbers, dash-spelled
    // character-by-character (same real convention as v1's own
    // FORMATTED_OEM_VARIATION generator) — this exact shape exposed the
    // round-2 segmented-identifier guard bug.
    const spacedParts = await prisma.part.findMany({ where: { oemNumber: { contains: ' ' } }, take: 2 });
    const dashSpelledCases: BenchmarkCaseDraft[] = spacedParts.map((p) => ({
      externalCaseId: `formatted-oem-v2-dashspelled:${p.id}`,
      input: { query: p.oemNumber.split('').join('-'), queryType: 'FORMATTED_OEM_VARIATION' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'HARD',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'AI Foundation Certification Sprint — real dash-spelled OEM regression coverage (round-2 segmented-identifier guard fix)' },
    }));

    const newCases = [...shortOemCases, ...crossRefCases, ...dashSpelledCases];
    console.log(`Real new cases this sprint: shortOem=${shortOemCases.length}, crossRef=${crossRefCases.length}, dashSpelled=${dashSpelledCases.length}. Total new: ${newCases.length}.`);

    const v2 = await benchmarkRegistry.createNewVersion(GOLD_KEY, {
      name: 'Retrieval Intelligence Gold Eval V2',
      description: 'Real gold dataset v2 — v1\'s 1,840 cases carried forward unchanged, plus real regression coverage for the AI Foundation Certification Sprint\'s identifier-classification fixes.',
      provenance: { source: 'build-retrieval-intelligence-gold-eval-v2 script', priorVersionId: v1.id },
    });

    await benchmarkRegistry.addCases(v2.id, [...carriedForward, ...newCases]);
    await benchmarkRegistry.approve(v2.id, 'certification-sprint-approver-1');
    await benchmarkRegistry.freezeAsGold(v2.id);
    console.log(`Gold benchmark v2 (${v2.id}) frozen with ${carriedForward.length + newCases.length} real, human-approved cases (${carriedForward.length} carried forward + ${newCases.length} new).`);

    const checksumCheck = await benchmarkRegistry.verifyChecksum(v2.id);
    console.log(`Gold dataset v2 checksum matches: ${checksumCheck.matches}.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
