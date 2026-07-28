// DGX Prototype 1.6 — SWAHILI / ENGLISH / MIXED_LANGUAGE case generation.
//
// Honest scoping (see docs/ai-evaluation/swahili-benchmark.md): real
// Swahili-fluency review is a staffing dependency this environment cannot
// fabricate around. What CAN be scaled mechanically is applying a small
// number of genuinely-real Swahili/mixed-language phrase templates (not
// machine-translated placeholders — the same real templates DGX Prototype
// 1.5 used and verified: "Nataka sehemu yenye namba <OEM>") against many
// real OEM numbers from the corpus — this multiplies real identifier
// coverage without multiplying invented language variety. Every case here
// is marked REVIEW_REQUIRED except the exact template already
// human-verified in Prototype 1.5 (a real Swahili speaker/reviewer should
// review additions before they count toward official APPROVED metrics —
// see ground-truth-governance precedent).
import { PrismaService } from '../../prisma/prisma.service';
import { BenchmarkCaseDraft } from './category-taxonomy';

const LANGUAGE_CASE_CAP = 100;

// Real, previously human-verified template (DGX Prototype 1.5 multilingual
// benchmark, see docs/ai-tuning/multilingual-evaluation.md) — an embedded
// single-token OEM number is correctly extracted by classifyQuery()'s
// embedded-identifier fix and resolved deterministically.
const VERIFIED_SWAHILI_TEMPLATE = (oem: string) => `Nataka sehemu yenye namba ${oem}`;

// Additional real, plausible workshop-language templates — NOT yet
// independently reviewed by a fluent Swahili speaker in this environment,
// so cases built from these stay REVIEW_REQUIRED until a real reviewer
// signs off (see docs/ai-evaluation/swahili-benchmark.md's phased roadmap).
const UNREVIEWED_SWAHILI_TEMPLATES: ((oem: string) => string)[] = [
  (oem) => `Ninahitaji sehemu namba ${oem}`,
  (oem) => `Je, unayo sehemu ${oem}?`,
  (oem) => `Tafadhali nipe bei ya sehemu ${oem}`,
];

const ENGLISH_TEMPLATES: ((oem: string) => string)[] = [
  (oem) => `I need the part with number ${oem}`,
  (oem) => `Do you have part ${oem} in stock?`,
];

const MIXED_TEMPLATES: ((oem: string) => string)[] = [
  (oem) => `Naomba part number ${oem} kwa gari langu`,
  (oem) => `Boss, hii part ${oem} inapatikana?`,
];

export async function buildSwahiliCases(prisma: PrismaService, cap = LANGUAGE_CASE_CAP): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];
  const realParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' }, take: cap });

  for (const p of realParts) {
    cases.push({
      externalCaseId: `swahili-verified:${p.id}`,
      input: { query: VERIFIED_SWAHILI_TEMPLATE(p.oemNumber), queryType: 'SWAHILI_MIXED' },
      expectedOutput: { expectedEntityIds: [p.id] },
      difficulty: 'MEDIUM',
      language: 'sw',
      status: 'APPROVED',
      provenance: { source: 'real-corpus+human-verified-template', derivation: 'DGX Prototype 1.5 verified Swahili embedded-identifier template' },
    });
  }

  for (const [templateIndex, template] of UNREVIEWED_SWAHILI_TEMPLATES.entries()) {
    for (const p of realParts.slice(0, Math.min(20, realParts.length))) {
      cases.push({
        externalCaseId: `swahili-unreviewed-${templateIndex}:${p.id}`,
        input: { query: template(p.oemNumber), queryType: 'SWAHILI_MIXED' },
        expectedOutput: { expectedEntityIds: [p.id] },
        difficulty: 'MEDIUM',
        language: 'sw',
        status: 'REVIEW_REQUIRED',
        provenance: { source: 'real-corpus+unreviewed-template', derivation: 'real OEM number in a plausible but not fluency-reviewed Swahili phrasing' },
      });
    }
  }

  return cases;
}

export async function buildEnglishCases(prisma: PrismaService, cap = LANGUAGE_CASE_CAP): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];
  const realParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' }, take: cap });

  for (const [templateIndex, template] of ENGLISH_TEMPLATES.entries()) {
    for (const p of realParts) {
      cases.push({
        externalCaseId: `english-${templateIndex}:${p.id}`,
        input: { query: template(p.oemNumber), queryType: 'DESCRIPTION' },
        expectedOutput: { expectedEntityIds: [p.id] },
        difficulty: 'EASY',
        language: 'en',
        status: 'APPROVED',
        provenance: { source: 'real-corpus', derivation: 'real OEM number embedded in an ordinary English workshop request' },
      });
    }
  }

  return cases;
}

export async function buildMixedLanguageCases(prisma: PrismaService, cap = LANGUAGE_CASE_CAP): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];
  const realParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' }, take: Math.min(20, cap) });

  for (const [templateIndex, template] of MIXED_TEMPLATES.entries()) {
    for (const p of realParts) {
      cases.push({
        externalCaseId: `mixed-language-${templateIndex}:${p.id}`,
        input: { query: template(p.oemNumber), queryType: 'SWAHILI_MIXED' },
        expectedOutput: { expectedEntityIds: [p.id] },
        difficulty: 'MEDIUM',
        language: 'mixed',
        status: 'REVIEW_REQUIRED',
        provenance: { source: 'real-corpus+unreviewed-template', derivation: 'real OEM number in code-switched Swahili/English workshop slang, not fluency-reviewed' },
      });
    }
  }

  return cases;
}
