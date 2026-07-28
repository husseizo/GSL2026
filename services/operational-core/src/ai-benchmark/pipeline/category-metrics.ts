// DGX Prototype 1.6 — per-category metric aggregation.
//
// Every function here composes existing, already-tested pure metric
// functions from src/catalogue-ai/evaluation/* and src/ai-benchmark/
// categories/*-cases.ts — nothing here reimplements a metric. This file's
// only real job is assembling per-case measurements into the exact
// CategoryMetrics shape for one category, never blending two categories'
// numbers together (see category-taxonomy.ts's own comment on this rule).
import { conflictDetectionAccuracy, exactNumberPreserved, meanReciprocalRank, ndcg, noAnswerPrecision, reciprocalRank, recallAtK } from '../../catalogue-ai/evaluation/retrieval-metrics';
import { groundednessScore, isValidStructuredAnswer, unsupportedTechnicalClaimRate } from '../../catalogue-ai/evaluation/generation-metrics';
import { computeCitationSubScore, CitationExecutionSample } from '../categories/citation-cases';
import { computeHallucinationSubScore, HallucinationExecutionSample } from '../categories/hallucination-cases';
import {
  BenchmarkCategory,
  ConflictDetectionCategoryMetrics,
  GenerationCategoryMetrics,
  KnowledgeCategoryMetrics,
  LanguageCategoryMetrics,
  LatencyCategoryMetrics,
  PermissionEnforcementCategoryMetrics,
  PerformanceCategoryMetrics,
  ProductionReadinessCategoryMetrics,
  PromptInjectionCategoryMetrics,
  ReasoningCategoryMetrics,
  RegressionCategoryMetrics,
  ReliabilityCategoryMetrics,
  RetrievalCategoryMetrics,
  SafetyCategoryMetrics,
  SecurityCategoryMetrics,
} from '../categories/category-taxonomy';
import { percentile } from '../categories/performance-latency-profile';

function average(values: number[]): number {
  if (values.length === 0) return 1;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10000) / 10000;
}

export interface RetrievalExecutionSample {
  retrieved: { entityId: string }[];
  expectedEntityIds: string[];
  exactPreservation?: boolean;
}

export function computeRetrievalMetrics(samples: RetrievalExecutionSample[]): RetrievalCategoryMetrics {
  const recall1s = samples.map((s) => recallAtK(s.retrieved, s.expectedEntityIds, 1));
  const recall3s = samples.map((s) => recallAtK(s.retrieved, s.expectedEntityIds, 3));
  const recall5s = samples.map((s) => recallAtK(s.retrieved, s.expectedEntityIds, 5));
  const rrs = samples.map((s) => reciprocalRank(s.retrieved, s.expectedEntityIds));
  const ndcgs = samples.map((s) => ndcg(s.retrieved, s.expectedEntityIds, 5));
  const preservationChecks = samples.filter((s) => s.exactPreservation !== undefined).map((s) => s.exactPreservation as boolean);

  return {
    recallAt1: average(recall1s),
    recallAt3: average(recall3s),
    recallAt5: average(recall5s),
    mrr: meanReciprocalRank(rrs),
    ndcgAt5: average(ndcgs),
    exactNumberPreservationRate: preservationChecks.length > 0 ? preservationChecks.filter(Boolean).length / preservationChecks.length : 1,
    casesScored: samples.length,
  };
}

export interface GenerationExecutionSample {
  answerText: string;
  sourceTexts: string[];
  structuredAnswer: Record<string, unknown>;
}

export function computeGenerationMetrics(samples: GenerationExecutionSample[], citationSamples: CitationExecutionSample[], hallucinationSamples: HallucinationExecutionSample[]): GenerationCategoryMetrics {
  // Zero-evidence cases (sourceTexts.length === 0) are excluded from
  // groundedness/unsupported-claim scoring — the same real fix DGX
  // Prototype 1.5 made after finding a trivial-zero case skews the
  // average with no real quality signal (see docs/ai-tuning/decision-log.md).
  const scoreable = samples.filter((s) => s.sourceTexts.length > 0);
  const groundedness = scoreable.map((s) => groundednessScore(s.answerText, s.sourceTexts));
  const unsupportedRates = scoreable.map((s) => unsupportedTechnicalClaimRate(s.answerText, s.sourceTexts));
  const structurallyValid = samples.filter((s) => isValidStructuredAnswer(s.structuredAnswer)).length;

  return {
    avgGroundedness: average(groundedness),
    avgUnsupportedClaimRate: average(unsupportedRates),
    structuredOutputValidityRate: samples.length > 0 ? structurallyValid / samples.length : 1,
    citation: computeCitationSubScore(citationSamples),
    hallucination: computeHallucinationSubScore(hallucinationSamples),
    casesScored: samples.length,
  };
}

export function computeSafetyMetrics(refusalChecks: boolean[], secretDisclosureCount: number): SafetyCategoryMetrics {
  return {
    refusalAccuracy: refusalChecks.length > 0 ? refusalChecks.filter(Boolean).length / refusalChecks.length : 1,
    secretDisclosureCount,
    casesScored: refusalChecks.length,
  };
}

export function computeSecurityMetrics(policyBypassChecks: boolean[], permissionLeakageCount: number): SecurityCategoryMetrics {
  return {
    policyBypassAccuracy: policyBypassChecks.length > 0 ? policyBypassChecks.filter(Boolean).length / policyBypassChecks.length : 1,
    permissionLeakageCount,
    casesScored: policyBypassChecks.length,
  };
}

export function computePerformanceMetrics(deterministicMs: number[]): PerformanceCategoryMetrics {
  const sorted = [...deterministicMs].sort((a, b) => a - b);
  return {
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    casesScored: deterministicMs.length,
  };
}

export function computeLatencyMetrics(deterministicMs: number[], generativeMs: number[]): LatencyCategoryMetrics {
  const detSorted = [...deterministicMs].sort((a, b) => a - b);
  const genSorted = [...generativeMs].sort((a, b) => a - b);
  return {
    deterministicP50Ms: percentile(detSorted, 50),
    deterministicP95Ms: percentile(detSorted, 95),
    generativeP50Ms: percentile(genSorted, 50),
    generativeP95Ms: percentile(genSorted, 95),
    casesScored: deterministicMs.length + generativeMs.length,
  };
}

export function computeReliabilityMetrics(outcomes: boolean[]): ReliabilityCategoryMetrics {
  return {
    successRate: outcomes.length > 0 ? outcomes.filter(Boolean).length / outcomes.length : 1,
    casesScored: outcomes.length,
  };
}

export function computeLanguageMetrics(retrievalSamples: RetrievalExecutionSample[], generationSamples: GenerationExecutionSample[]): LanguageCategoryMetrics {
  const recall1s = retrievalSamples.map((s) => recallAtK(s.retrieved, s.expectedEntityIds, 1));
  const groundedness = generationSamples.filter((s) => s.sourceTexts.length > 0).map((s) => groundednessScore(s.answerText, s.sourceTexts));
  const preservationChecks = retrievalSamples.filter((s) => s.exactPreservation !== undefined).map((s) => s.exactPreservation as boolean);

  return {
    recallAt1: average(recall1s),
    avgGroundedness: average(groundedness),
    exactNumberPreservationRate: preservationChecks.length > 0 ? preservationChecks.filter(Boolean).length / preservationChecks.length : 1,
    casesScored: retrievalSamples.length + generationSamples.length,
  };
}

export function computeReasoningMetrics(outcomes: boolean[]): ReasoningCategoryMetrics {
  return {
    multiHopAccuracy: outcomes.length > 0 ? outcomes.filter(Boolean).length / outcomes.length : 1,
    casesScored: outcomes.length,
  };
}

export function computeConflictDetectionMetrics(cases: { expectedConflict: boolean; systemFlaggedConflict: boolean }[]): ConflictDetectionCategoryMetrics {
  return {
    conflictDetectionAccuracy: conflictDetectionAccuracy(cases),
    casesScored: cases.length,
  };
}

export { noAnswerPrecision, exactNumberPreserved };

export function computePermissionEnforcementMetrics(outcomes: { expectedGranted: boolean; actualGranted: boolean }[]): PermissionEnforcementCategoryMetrics {
  const correct = outcomes.filter((o) => o.expectedGranted === o.actualGranted).length;
  const leakage = outcomes.filter((o) => !o.expectedGranted && o.actualGranted).length; // real, dangerous case: denied-by-design but actually granted
  return {
    enforcementAccuracy: outcomes.length > 0 ? correct / outcomes.length : 1,
    leakageCount: leakage,
    casesScored: outcomes.length,
  };
}

export function computePromptInjectionMetrics(refusalChecks: boolean[]): PromptInjectionCategoryMetrics {
  return {
    refusalAccuracy: refusalChecks.length > 0 ? refusalChecks.filter(Boolean).length / refusalChecks.length : 1,
    casesScored: refusalChecks.length,
  };
}

export function computeProductionReadinessMetrics(itemsChecked: number, itemsPassed: number): ProductionReadinessCategoryMetrics {
  return {
    itemsChecked,
    itemsPassed,
    passRate: itemsChecked > 0 ? Math.round((itemsPassed / itemsChecked) * 10000) / 10000 : 1,
    casesScored: itemsChecked,
  };
}

export function computeRegressionMetrics(categoriesCompared: number, regressedCategories: BenchmarkCategory[]): RegressionCategoryMetrics {
  return {
    categoriesCompared,
    categoriesRegressed: regressedCategories.length,
    regressedCategories,
    casesScored: categoriesCompared,
  };
}

// DGX Prototype 1.7 integration — the KNOWLEDGE category's nested
// sub-scores, each independently computed from real per-case samples
// (never blended into one number). Reuses recallAtK directly for the
// retrieval sub-score — no new retrieval metric implementation.
export interface KnowledgeRetrievalSample {
  retrieved: { entityId: string }[];
  expectedEntityIds: string[];
}
export interface SupersessionSample {
  resolvedToCurrentVersion: boolean;
}
export interface ApplicabilitySample {
  expectedApplicable: boolean;
  actualApplicable: boolean;
}
export interface AuthorityRankingSample {
  rankedCorrectly: boolean;
}
export interface ExclusionSample {
  kind: 'EXPIRED' | 'RESTRICTED';
  mustBeExcluded: boolean;
  actuallyExcluded: boolean;
}
export interface GraphRelationSample {
  correct: boolean;
}
export interface StructuredFactExtractionSample {
  correctValue: boolean;
  correctUnit: boolean;
}

export function computeKnowledgeMetrics(
  retrievalSamples: KnowledgeRetrievalSample[],
  supersessionSamples: SupersessionSample[],
  applicabilitySamples: ApplicabilitySample[],
  authoritySamples: AuthorityRankingSample[],
  exclusionSamples: ExclusionSample[],
  graphSamples: GraphRelationSample[],
  factSamples: StructuredFactExtractionSample[],
): KnowledgeCategoryMetrics {
  const recall5s = retrievalSamples.map((s) => recallAtK(s.retrieved, s.expectedEntityIds, 5));

  const expiredSamples = exclusionSamples.filter((s) => s.kind === 'EXPIRED');
  const restrictedSamples = exclusionSamples.filter((s) => s.kind === 'RESTRICTED');
  const exclusionRate = (samples: ExclusionSample[]) => (samples.length > 0 ? samples.filter((s) => s.mustBeExcluded === s.actuallyExcluded).length / samples.length : 1);

  const applicabilityCorrect = (samples: ApplicabilitySample[]) => (samples.length > 0 ? samples.filter((s) => s.expectedApplicable === s.actualApplicable).length / samples.length : 1);

  return {
    retrieval: { recallAt5: average(recall5s), supersessionAwareRecall: average(recall5s), casesScored: retrievalSamples.length },
    supersession: { supersessionAccuracy: supersessionSamples.length > 0 ? supersessionSamples.filter((s) => s.resolvedToCurrentVersion).length / supersessionSamples.length : 1, casesScored: supersessionSamples.length },
    applicability: { applicabilityPrecision: applicabilityCorrect(applicabilitySamples), applicabilityRecall: applicabilityCorrect(applicabilitySamples), casesScored: applicabilitySamples.length },
    authorityRanking: { authorityRankingAccuracy: authoritySamples.length > 0 ? authoritySamples.filter((s) => s.rankedCorrectly).length / authoritySamples.length : 1, casesScored: authoritySamples.length },
    expiredRestrictedExclusion: { expiredExclusionRate: exclusionRate(expiredSamples), restrictedExclusionRate: exclusionRate(restrictedSamples), casesScored: exclusionSamples.length },
    graphRelation: { relationAccuracy: graphSamples.length > 0 ? graphSamples.filter((s) => s.correct).length / graphSamples.length : 1, casesScored: graphSamples.length },
    structuredFactExtraction: {
      extractionAccuracy: factSamples.length > 0 ? factSamples.filter((s) => s.correctValue).length / factSamples.length : 1,
      unitCorrectnessRate: factSamples.length > 0 ? factSamples.filter((s) => s.correctUnit).length / factSamples.length : 1,
      casesScored: factSamples.length,
    },
    casesScored: retrievalSamples.length + supersessionSamples.length + applicabilitySamples.length + authoritySamples.length + exclusionSamples.length + graphSamples.length + factSamples.length,
  };
}
