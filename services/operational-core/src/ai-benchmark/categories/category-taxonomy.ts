// DGX Prototype 1.6 — Automotive AI Evaluation Framework
//
// The 16-value BenchmarkCategory list (spec §4), mirrored from the Prisma
// enum so pure functions in this module don't need to import @prisma/client
// just for the type. "Never collapse everything into one average" (spec's
// explicit rule) is enforced here at the type level: CategoryMetrics is a
// per-category union, and the only aggregate shape any pipeline function
// may return is Record<BenchmarkCategory, CategoryMetrics | undefined> —
// never a single number. See docs/ai-evaluation/benchmark-architecture.md.
//
// Hallucination (spec §12) and Citation (spec §13) are deliberately NOT
// separate BenchmarkCategory values — a real decision confirmed with the
// user during planning, since spec §4's literal category list doesn't name
// them. They get their own dedicated sub-scores (CitationSubScore,
// HallucinationSubScore) nested inside GENERATION's CategoryMetrics, with
// their own dedicated case files, docs, and independently-reported numbers
// — "dedicated," per §12/§13, but not top-level "never collapsed"
// categories in the §4 sense.
//
// DGX Prototype 1.7 (Automotive Knowledge Platform) addition — a second
// real decision confirmed with the user: ONE new category, KNOWLEDGE,
// houses retrieval/supersession/applicability/authority-ranking/expired-
// restricted-exclusion/graph-relation/structured-fact-extraction accuracy
// as nested sub-scores, mirroring the same Hallucination/Citation pattern.
// Knowledge-specific conflict-detection/prompt-injection benchmarks reuse
// the EXISTING CONFLICT_DETECTION/PROMPT_INJECTION categories directly
// (new case generators, same pipeline methods) — see
// docs/knowledge-platform/evaluation-framework-integration.md.
export type BenchmarkCategory =
  | 'RETRIEVAL'
  | 'GENERATION'
  | 'SAFETY'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'SWAHILI'
  | 'ENGLISH'
  | 'MIXED_LANGUAGE'
  | 'REASONING'
  | 'CONFLICT_DETECTION'
  | 'PERMISSION_ENFORCEMENT'
  | 'PROMPT_INJECTION'
  | 'LATENCY'
  | 'RELIABILITY'
  | 'REGRESSION'
  | 'PRODUCTION_READINESS'
  | 'KNOWLEDGE';

export const ALL_BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
  'RETRIEVAL',
  'GENERATION',
  'SAFETY',
  'SECURITY',
  'PERFORMANCE',
  'SWAHILI',
  'ENGLISH',
  'MIXED_LANGUAGE',
  'REASONING',
  'CONFLICT_DETECTION',
  'PERMISSION_ENFORCEMENT',
  'PROMPT_INJECTION',
  'LATENCY',
  'RELIABILITY',
  'REGRESSION',
  'PRODUCTION_READINESS',
  'KNOWLEDGE',
];

export type QualityGate = 'RETRIEVAL' | 'SAFETY' | 'CITATION' | 'GROUNDEDNESS' | 'PERFORMANCE' | 'REGRESSION' | 'HUMAN_APPROVAL';

export const ALL_QUALITY_GATES: QualityGate[] = ['RETRIEVAL', 'SAFETY', 'CITATION', 'GROUNDEDNESS', 'PERFORMANCE', 'REGRESSION', 'HUMAN_APPROVAL'];

// Section 13 — measured on top of whatever generative cases already exist
// in any category (not a separately-authored case pool, see
// categories/citation-cases.ts).
export interface CitationSubScore {
  correctness: number; // of everything cited, how much was a real retrieved source
  completeness: number; // of material real sources, how many were actually cited
  precision: number; // same as correctness, named per spec §13's own vocabulary
  recall: number; // same as completeness, named per spec §13's own vocabulary
  brokenCitationCount: number; // cited an id that doesn't resolve to any real record at all
  wrongCitationCount: number; // cited a real record that was not actually retrieved (fabricated-but-real-looking)
  missingCitationCount: number; // a material real source that went uncited
  casesScored: number;
}

// Section 12 — every hallucination is classified by subtype, not just
// counted. Each subtype is a rate (0 = never observed this run).
export interface HallucinationSubScore {
  invalidOemRate: number;
  invalidFitmentRate: number;
  invalidLubricantApprovalRate: number;
  invalidCompatibilityRate: number;
  invalidCitationRate: number;
  unsupportedDiagnosisRate: number;
  unsupportedEquivalenceRate: number;
  overallHallucinationRate: number; // fraction of cases with >=1 hallucination of any subtype
  casesScored: number;
}

export interface RetrievalCategoryMetrics {
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
  ndcgAt5: number;
  exactNumberPreservationRate: number;
  casesScored: number;
}

export interface GenerationCategoryMetrics {
  avgGroundedness: number;
  avgUnsupportedClaimRate: number;
  structuredOutputValidityRate: number;
  citation: CitationSubScore;
  hallucination: HallucinationSubScore;
  casesScored: number;
}

export interface SafetyCategoryMetrics {
  refusalAccuracy: number; // unsafe-advice / policy-bypass style refusals
  secretDisclosureCount: number; // must always be 0
  casesScored: number;
}

export interface SecurityCategoryMetrics {
  policyBypassAccuracy: number;
  permissionLeakageCount: number; // must always be 0
  casesScored: number;
}

export interface PerformanceCategoryMetrics {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  casesScored: number;
}

export interface LanguageCategoryMetrics {
  // SWAHILI / ENGLISH / MIXED_LANGUAGE all share this shape — a
  // language-filtered view of the same real retrieval+generation
  // execution, not a separately-invented metric family.
  recallAt1: number;
  avgGroundedness: number;
  exactNumberPreservationRate: number;
  casesScored: number;
}

export interface ReasoningCategoryMetrics {
  multiHopAccuracy: number; // conflict-resolution / comparison chains resolved correctly
  casesScored: number;
}

export interface ConflictDetectionCategoryMetrics {
  conflictDetectionAccuracy: number;
  casesScored: number;
}

export interface PermissionEnforcementCategoryMetrics {
  enforcementAccuracy: number; // fraction of real @RequirePermissions-guarded routes that correctly deny an under-privileged actor
  leakageCount: number; // must always be 0
  casesScored: number;
}

export interface PromptInjectionCategoryMetrics {
  refusalAccuracy: number;
  casesScored: number;
}

export interface LatencyCategoryMetrics {
  deterministicP50Ms: number;
  deterministicP95Ms: number;
  generativeP50Ms: number;
  generativeP95Ms: number;
  casesScored: number;
}

export interface ReliabilityCategoryMetrics {
  successRate: number; // fraction of real calls that completed without throwing/erroring
  casesScored: number;
}

export interface RegressionCategoryMetrics {
  categoriesCompared: number;
  categoriesRegressed: number;
  regressedCategories: BenchmarkCategory[];
  casesScored: number;
}

// Not case-based at all (spec's own distinction) — a checklist, scored as
// a pass fraction, never averaged with a numeric benchmark metric from
// another category.
export interface ProductionReadinessCategoryMetrics {
  itemsChecked: number;
  itemsPassed: number;
  passRate: number;
  casesScored: number;
}

// DGX Prototype 1.7 — nested sub-scores for the new KNOWLEDGE category,
// mirroring exactly how Hallucination/Citation nest inside GENERATION.
export interface KnowledgeRetrievalSubScore {
  recallAt5: number;
  supersessionAwareRecall: number;
  casesScored: number;
}
export interface SupersessionSubScore {
  supersessionAccuracy: number;
  casesScored: number;
}
export interface ApplicabilitySubScore {
  applicabilityPrecision: number;
  applicabilityRecall: number;
  casesScored: number;
}
export interface AuthorityRankingSubScore {
  authorityRankingAccuracy: number;
  casesScored: number;
}
export interface ExpiredRestrictedExclusionSubScore {
  expiredExclusionRate: number;
  restrictedExclusionRate: number;
  casesScored: number;
}
export interface GraphRelationSubScore {
  relationAccuracy: number;
  casesScored: number;
}
export interface StructuredFactExtractionSubScore {
  extractionAccuracy: number;
  unitCorrectnessRate: number;
  casesScored: number;
}

export interface KnowledgeCategoryMetrics {
  retrieval: KnowledgeRetrievalSubScore;
  supersession: SupersessionSubScore;
  applicability: ApplicabilitySubScore;
  authorityRanking: AuthorityRankingSubScore;
  expiredRestrictedExclusion: ExpiredRestrictedExclusionSubScore;
  graphRelation: GraphRelationSubScore;
  structuredFactExtraction: StructuredFactExtractionSubScore;
  casesScored: number;
}

export type CategoryMetrics =
  | { category: 'RETRIEVAL'; metrics: RetrievalCategoryMetrics }
  | { category: 'GENERATION'; metrics: GenerationCategoryMetrics }
  | { category: 'SAFETY'; metrics: SafetyCategoryMetrics }
  | { category: 'SECURITY'; metrics: SecurityCategoryMetrics }
  | { category: 'PERFORMANCE'; metrics: PerformanceCategoryMetrics }
  | { category: 'SWAHILI'; metrics: LanguageCategoryMetrics }
  | { category: 'ENGLISH'; metrics: LanguageCategoryMetrics }
  | { category: 'MIXED_LANGUAGE'; metrics: LanguageCategoryMetrics }
  | { category: 'REASONING'; metrics: ReasoningCategoryMetrics }
  | { category: 'CONFLICT_DETECTION'; metrics: ConflictDetectionCategoryMetrics }
  | { category: 'PERMISSION_ENFORCEMENT'; metrics: PermissionEnforcementCategoryMetrics }
  | { category: 'PROMPT_INJECTION'; metrics: PromptInjectionCategoryMetrics }
  | { category: 'LATENCY'; metrics: LatencyCategoryMetrics }
  | { category: 'RELIABILITY'; metrics: ReliabilityCategoryMetrics }
  | { category: 'REGRESSION'; metrics: RegressionCategoryMetrics }
  | { category: 'PRODUCTION_READINESS'; metrics: ProductionReadinessCategoryMetrics }
  | { category: 'KNOWLEDGE'; metrics: KnowledgeCategoryMetrics };

// The only shape a full benchmark-suite run's metrics may take — a map
// keyed by category, each entry independently scored. No code anywhere in
// src/ai-benchmark/ may reduce this into a single overall number.
export type CategoryMetricsMap = Partial<Record<BenchmarkCategory, CategoryMetrics>>;

// The shape every category's case generator produces, ready to persist
// directly as a BenchmarkCase row (matches its Prisma fields 1:1, so
// persistence is a plain createMany). input/expectedOutput are
// category-specific free-form JSON — see each category-*.ts file's own
// interface for what it puts in them.
export interface BenchmarkCaseDraft {
  externalCaseId: string;
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  language: 'en' | 'sw' | 'mixed';
  status: 'DRAFT' | 'REVIEW_REQUIRED' | 'APPROVED' | 'CONFLICTING' | 'RETIRED';
  provenance?: Record<string, unknown>;
}
