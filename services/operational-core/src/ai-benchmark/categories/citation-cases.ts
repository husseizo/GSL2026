// DGX Prototype 1.6 — Citation Benchmark (spec §13).
//
// Per the honest dataset-scale plan: citation quality is measured on top
// of whatever generative answers already exist from OTHER categories
// (every generative answer's citations are checkable) rather than being a
// separately-authored case pool — computeCitationSubScore() is the shared
// scoring utility every category's pipeline run calls after generation.
// A small number of dedicated multi-source stress-test cases are added
// here too, targeting real parts/lubricants that have more than one real
// KnowledgeDocument, since citation completeness is only meaningfully
// testable when multiple real sources actually exist to (under-)cite.
import { PrismaService } from '../../prisma/prisma.service';
import { citationCorrectness, citationCompleteness } from '../../catalogue-ai/evaluation/generation-metrics';
import { validateCitations } from '../../catalogue-ai/rag/citation-validator';
import { BenchmarkCaseDraft, CitationSubScore } from './category-taxonomy';

const CITATION_CASE_CAP = 100;

export interface CitationCaseInput {
  query: string;
  probedEntityId: string;
}
export interface CitationCaseExpected {
  minMaterialSources: number;
}

// Real, dedicated multi-source stress-test cases — parts/lubricants with
// more than one real KnowledgeDocument, so under-citation is genuinely
// measurable (not just structurally guaranteed to be 1.0, as it trivially
// is for a single-source answer).
export async function buildCitationStressCases(prisma: PrismaService, cap = CITATION_CASE_CAP): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];
  const docs = await prisma.knowledgeDocument.findMany({ where: { partId: { not: null }, isApproved: true }, select: { partId: true } });
  const countByPart = new Map<string, number>();
  for (const d of docs) {
    if (!d.partId) continue;
    countByPart.set(d.partId, (countByPart.get(d.partId) ?? 0) + 1);
  }
  const multiSourcePartIds = [...countByPart.entries()].filter(([, count]) => count > 1).slice(0, cap);

  for (const [partId, count] of multiSourcePartIds) {
    const part = await prisma.part.findUnique({ where: { id: partId } });
    if (!part) continue;
    cases.push({
      externalCaseId: `citation-stress:${part.id}`,
      input: { query: part.oemNumber, probedEntityId: part.id } satisfies CitationCaseInput,
      expectedOutput: { minMaterialSources: count } satisfies CitationCaseExpected,
      difficulty: 'MEDIUM',
      language: 'en',
      status: 'REVIEW_REQUIRED', // "material" source count needs a human spot-check per case, not assumed
      provenance: { source: 'real-corpus', derivation: `real part with ${count} real approved KnowledgeDocument rows` },
    });
  }

  return cases;
}

export interface CitationExecutionSample {
  citedSourceIds: string[];
  retrievedSourceIds: string[];
  materialSourceIds: string[]; // caller's judgment of which retrieved sources were actually material — see generation-metrics.ts's own documented limitation
}

// Shared across every category's pipeline run — never reimplements
// citationCorrectness()/citationCompleteness()/validateCitations(), only
// aggregates their real outputs into the dedicated CitationSubScore shape.
export function computeCitationSubScore(samples: CitationExecutionSample[]): CitationSubScore {
  if (samples.length === 0) {
    return { correctness: 1, completeness: 1, precision: 1, recall: 1, brokenCitationCount: 0, wrongCitationCount: 0, missingCitationCount: 0, casesScored: 0 };
  }

  const correctness = citationCorrectness(samples.map((s) => ({ citedSourceIds: s.citedSourceIds, retrievedSourceIds: s.retrievedSourceIds })));
  const completeness = citationCompleteness(samples.map((s) => ({ materialSourceIds: s.materialSourceIds, citedSourceIds: s.citedSourceIds })));

  let broken = 0;
  let wrong = 0;
  let missing = 0;
  for (const s of samples) {
    const check = validateCitations(s.citedSourceIds, s.retrievedSourceIds);
    wrong += check.missingSourceIds.length; // cited but not retrieved — a fabricated-looking citation
    missing += s.materialSourceIds.filter((id) => !s.citedSourceIds.includes(id)).length;
    broken += s.citedSourceIds.filter((id) => id.trim().length === 0).length;
  }

  return {
    correctness,
    completeness,
    precision: correctness,
    recall: completeness,
    brokenCitationCount: broken,
    wrongCitationCount: wrong,
    missingCitationCount: missing,
    casesScored: samples.length,
  };
}
