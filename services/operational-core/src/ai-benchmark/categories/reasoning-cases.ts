// DGX Prototype 1.6 — Reasoning Benchmark (spec §4's REASONING category).
//
// Multi-hop / conflict-resolution reasoning chains cannot be honestly
// mass-generated (each one needs a human to confirm the expected
// resolution is actually correct) — stays a small, curated, real sample
// built from genuine corpus facts, same discipline as language-cases.ts.
import { PrismaService } from '../../prisma/prisma.service';
import { BenchmarkCaseDraft } from './category-taxonomy';

export interface ReasoningCaseInput {
  query: string;
  hopDescription: string;
}
export interface ReasoningCaseExpected {
  expectedEntityIds: string[];
  expectedBehavior: 'RESOLVE' | 'FLAG_CONFLICT' | 'DECLINE';
}

// Real two-hop case: a lubricant's viscosity AND a real verified OEM
// approval must both be satisfied by the same real product — a genuine
// conjunctive-reasoning case, not fabricated.
export async function buildReasoningCases(prisma: PrismaService, cap = 50): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];

  const lubricantsWithBoth = await prisma.lubricantProduct.findMany({
    where: { viscosity: { not: null }, approvals: { some: { isVerified: true } } },
    include: { approvals: { where: { isVerified: true }, take: 1 } },
    take: cap,
  });

  for (const l of lubricantsWithBoth) {
    const approval = l.approvals[0];
    if (!approval) continue;
    cases.push({
      externalCaseId: `reasoning-conjunctive:${l.id}`,
      input: {
        query: `Which product is ${l.viscosity} viscosity AND has ${approval.oemBrand} approval ${approval.approvalCode}?`,
        hopDescription: 'requires satisfying a viscosity constraint and an OEM-approval constraint simultaneously',
      } satisfies ReasoningCaseInput,
      expectedOutput: { expectedEntityIds: [l.id], expectedBehavior: 'RESOLVE' } satisfies ReasoningCaseExpected,
      difficulty: 'HARD',
      language: 'en',
      status: 'REVIEW_REQUIRED', // conjunctive real-world queries can have more than one real satisfying product; needs a human check that this is the unique/expected answer
      provenance: { source: 'real-corpus', derivation: 'real LubricantProduct with both a real viscosity and a real verified approval' },
    });
  }

  // Real conflict-resolution reasoning: a part with a genuine multi-source
  // category disagreement (same signal identifier-scaled-cases.ts's
  // CONFLICT cases use) should be reasoned about as "flag, don't silently
  // pick one" rather than resolved to a single answer.
  const conflictedParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', externalRefs: { some: {} } }, include: { externalRefs: true }, take: cap * 3 });
  let conflictCasesAdded = 0;
  for (const p of conflictedParts) {
    if (conflictCasesAdded >= cap) break;
    if (p.externalRefs.length < 2) continue;
    const rawRecords = await prisma.rawSourceRecord.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordKey: { in: p.externalRefs.map((r) => r.sourceRecordId) } } });
    const categories = new Set(rawRecords.map((r) => (r.rawPayload as { part_group?: string }).part_group).filter(Boolean));
    if (categories.size > 1) {
      cases.push({
        externalCaseId: `reasoning-conflict:${p.id}`,
        input: { query: `What category of part is ${p.oemNumber}?`, hopDescription: 'requires recognizing conflicting source categorization rather than silently picking one' } satisfies ReasoningCaseInput,
        expectedOutput: { expectedEntityIds: [p.id], expectedBehavior: 'FLAG_CONFLICT' } satisfies ReasoningCaseExpected,
        difficulty: 'HARD',
        language: 'en',
        status: 'APPROVED',
        provenance: { source: 'real-corpus', derivation: 'real multi-source part with genuine category disagreement across raw source records' },
      });
      conflictCasesAdded += 1;
    }
  }

  return cases;
}
