// DGX Prototype 1.6 — mechanically-scaled RETRIEVAL / CONFLICT_DETECTION
// case generation from the real catalogue (7,723 parts, 434 lubricants).
// This is the same self-consistency principle DGX Prototype 1.5's
// buildEvalSet() already used (a part's own real identifier must retrieve
// that same real part) — extended here by removing its `.slice(0,5)` /
// single-instance caps so the mechanically-derivable categories can
// genuinely scale into the hundreds, per the honest dataset-scale plan in
// docs/ai-evaluation/gold-dataset.md. Every case here has a structurally
// verifiable expected answer (an OEM number's expected entity is a fact,
// not a judgment call) — this is exactly the class of case that can be
// scaled without needing new human review for each one, unlike Swahili/
// Reasoning/injection-phrasing cases (see language-cases.ts,
// reasoning-cases.ts, safety-security-cases.ts).
import { PrismaService } from '../../prisma/prisma.service';
import { BenchmarkCaseDraft } from './category-taxonomy';

export const IDENTIFIER_CASE_CAP_PER_TYPE = 500;

export async function buildRetrievalCases(prisma: PrismaService, capPerType = IDENTIFIER_CASE_CAP_PER_TYPE): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];

  const realParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' }, take: capPerType });
  for (const p of realParts) {
    cases.push({
      externalCaseId: `exact-oem:${p.id}`,
      input: { query: p.oemNumber, queryType: 'EXACT_OEM' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'EASY',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'Part.oemNumber self-consistency' },
    });
  }

  // Formatted-variation: same real OEM number, real formatting noise
  // (hyphenated), scaled to the full cap rather than 5.
  for (const p of realParts.slice(0, capPerType)) {
    cases.push({
      externalCaseId: `formatted-oem:${p.id}`,
      input: { query: p.oemNumber.split('').join('-'), queryType: 'FORMATTED_OEM_VARIATION' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'MEDIUM',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'Part.oemNumber with real formatting noise injected' },
    });
  }

  const partsWithInternalCode = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', internalItemCode: { not: null } }, take: capPerType });
  for (const p of partsWithInternalCode) {
    cases.push({
      externalCaseId: `internal-code:${p.id}`,
      input: { query: p.internalItemCode, queryType: 'INTERNAL_CODE' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'EASY',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'Part.internalItemCode self-consistency' },
    });
  }

  const realAlternates = await prisma.partAlternateNumber.findMany({ take: capPerType });
  for (const a of realAlternates) {
    cases.push({
      externalCaseId: `alternate-number:${a.id}`,
      input: { query: a.number, queryType: 'ALTERNATE_NUMBER' },
      expectedOutput: { expectedEntityIds: [a.partId] },
      difficulty: 'EASY',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'PartAlternateNumber self-consistency' },
    });
  }

  const partsWithTecdoc = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', tecdocArticleId: { not: null } }, take: capPerType });
  for (const p of partsWithTecdoc) {
    cases.push({
      externalCaseId: `tecdoc-id:${p.id}`,
      input: { query: p.tecdocArticleId, queryType: 'TECDOC_ID' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'EASY',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'Part.tecdocArticleId self-consistency' },
    });
  }

  const lubricantsWithViscosity = await prisma.lubricantProduct.findMany({ where: { viscosity: { not: null } }, take: capPerType });
  for (const l of lubricantsWithViscosity) {
    cases.push({
      externalCaseId: `lubricant-viscosity:${l.id}`,
      input: { query: l.viscosity, queryType: 'LUBRICANT_VISCOSITY' },
      expectedOutput: { expectedEntityIds: [l.id] },
      difficulty: 'EASY',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'LubricantProduct.viscosity self-consistency' },
    });
  }

  const verifiedApprovals = await prisma.lubricantApproval.findMany({ where: { isVerified: true }, take: capPerType });
  for (const a of verifiedApprovals) {
    cases.push({
      externalCaseId: `lubricant-approval:${a.id}`,
      input: { query: `${a.oemBrand} ${a.approvalCode}`, queryType: 'LUBRICANT_APPROVAL' },
      expectedOutput: { expectedEntityIds: [a.lubricantProductId] },
      difficulty: 'EASY',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus', derivation: 'LubricantApproval.isVerified self-consistency' },
    });
  }

  // Partial/misspelled description perturbations — deterministic but
  // judgment-laden (is the truncation/misspelling still fair?), so these
  // stay REVIEW_REQUIRED exactly as buildEvalSet() already established,
  // scaled up rather than reduced to one instance.
  const partsWithLongNames = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', productName: { not: '' } }, take: capPerType });
  for (const p of partsWithLongNames) {
    if (p.productName.length <= 8) continue;
    const words = p.productName.split(' ');
    if (words.length > 1) {
      cases.push({
        externalCaseId: `partial-description:${p.id}`,
        input: { query: words[0], queryType: 'PARTIAL_DESCRIPTION' },
        expectedOutput: { expectedEntityIds: [p.id] },
        difficulty: 'MEDIUM',
        language: 'en',
        status: 'REVIEW_REQUIRED',
        provenance: { source: 'real-corpus', derivation: 'Part.productName truncated to first word' },
      });
    }
    const misspelled = p.productName.slice(0, -1) + (p.productName.at(-1) === 'e' ? 'a' : 'e');
    cases.push({
      externalCaseId: `misspelled-description:${p.id}`,
      input: { query: misspelled, queryType: 'MISSPELLED_DESCRIPTION' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'HARD',
      language: 'en',
      status: 'REVIEW_REQUIRED',
      provenance: { source: 'real-corpus', derivation: 'Part.productName with one deterministic character perturbation' },
    });
  }

  return cases;
}

// Real conflict cases: bounded by how many genuine multi-source-category
// disagreements actually exist (previously found to be a small minority —
// 592/898 multi-source parts are brand-only differences, which is expected
// aftermarket coverage, not a conflict). Stays honestly small — padding
// this would misrepresent how common real conflicts are.
export async function buildConflictDetectionCases(prisma: PrismaService, capTotal = IDENTIFIER_CASE_CAP_PER_TYPE): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];
  const multiSourceParts = await prisma.part.findMany({
    where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', externalRefs: { some: {} } },
    include: { externalRefs: true },
    take: capTotal * 4, // over-fetch since most multi-source parts turn out to be brand-only, not real conflicts
  });

  for (const p of multiSourceParts) {
    if (cases.length >= capTotal) break;
    if (p.externalRefs.length < 2) continue;
    const rawRecords = await prisma.rawSourceRecord.findMany({
      where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB', sourceRecordKey: { in: p.externalRefs.map((r) => r.sourceRecordId) } },
    });
    const categories = new Set(rawRecords.map((r) => (r.rawPayload as { part_group?: string }).part_group).filter(Boolean));
    if (categories.size > 1) {
      cases.push({
        externalCaseId: `conflict:${p.id}`,
        input: { query: p.oemNumber, queryType: 'CONFLICT' },
        expectedOutput: { expectedEntityIds: [p.id], expectedConflict: true },
        difficulty: 'HARD',
        language: 'en',
        status: 'APPROVED',
        provenance: { source: 'real-corpus', derivation: 'multi-source part with genuine category disagreement across raw source records' },
      });
    }
  }

  return cases;
}

// A real, structurally-correct no-answer case (a random string genuinely
// has no real catalogue match) — kept singular since one is sufficient to
// prove the behavior and there's no real corpus dimension to scale it
// against (unlike identifier-derived cases, "more nonexistent part numbers"
// adds no new information).
export function buildNoAnswerCase(): BenchmarkCaseDraft {
  return {
    externalCaseId: 'no-answer:canonical',
    input: { query: 'ZZZ-NONEXISTENT-PART-NUMBER-000000', queryType: 'NO_ANSWER' },
    expectedOutput: { expectedEntityIds: [], expectedNoAnswer: true },
    difficulty: 'EASY',
    language: 'en',
    status: 'APPROVED',
    provenance: { source: 'structural', derivation: 'a nonexistent part number has no real ground truth by construction' },
  };
}
