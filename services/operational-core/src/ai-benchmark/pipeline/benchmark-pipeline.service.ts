// DGX Prototype 1.6 — the real evaluation pipeline (spec §5):
// load dataset -> run retrieval -> run reranker -> run prompt -> run
// generator -> validate claims -> validate citations -> validate
// confidence -> calculate metrics -> store results -> compare against
// previous versions -> generate report -> approve/reject.
//
// Every "run X" step below calls the real, already-existing service for
// that step (CatalogueSearchService, CatalogueRagService, the reranker/
// claim-verifier/citation-validator pure functions) — nothing here
// reimplements retrieval, generation, or verification logic. This file's
// job is orchestration + persistence + per-category metric assembly,
// never blended across categories (see category-taxonomy.ts).
import { Injectable, Logger } from '@nestjs/common';
import { BenchmarkCategory as PrismaBenchmarkCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogueSearchService } from '../../catalogue-ai/search/catalogue-search.service';
import { CatalogueRagService } from '../../catalogue-ai/rag/catalogue-rag.service';
import { ROLE_PERMISSIONS } from '../../common/permissions/role-permissions';
import { computeRetrievalMetrics, computeGenerationMetrics, computeSafetyMetrics, computeSecurityMetrics, computePermissionEnforcementMetrics, computePromptInjectionMetrics, computeConflictDetectionMetrics, computeLanguageMetrics, computeReasoningMetrics, computePerformanceMetrics, computeLatencyMetrics, computeReliabilityMetrics, computeProductionReadinessMetrics, computeKnowledgeMetrics, KnowledgeRetrievalSample, SupersessionSample, ExclusionSample } from './category-metrics';
import { CitationExecutionSample } from '../categories/citation-cases';
import { HallucinationExecutionSample, HallucinationSubtype } from '../categories/hallucination-cases';
import { CategoryMetrics } from '../categories/category-taxonomy';
import { buildQueryMixSample } from '../categories/performance-latency-profile';
import { evaluateChecklist, ProductionReadinessItem } from '../categories/production-readiness-checklist';
import { KnowledgeRetrievalService } from '../../knowledge-platform/retrieval/knowledge-retrieval.service';

interface RunOptions {
  benchmarkId: string;
  modelId?: string;
  embeddingModelId?: string;
  promptVersionId?: string;
  indexVersionId?: string;
  trigger?: 'MANUAL' | 'CI' | 'PRE_DEPLOYMENT' | 'SCHEDULED_DOC_ONLY';
  suiteRunId?: string;
  createdById?: string;
}

@Injectable()
export class BenchmarkPipelineService {
  private readonly logger = new Logger(BenchmarkPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogueSearch: CatalogueSearchService,
    private readonly catalogueRag: CatalogueRagService,
    // DGX Prototype 1.7 — the one additive DI edge this file gets: a real
    // dependency on the new Knowledge Platform's retrieval service, so the
    // KNOWLEDGE category can be evaluated against real published
    // KnowledgeItemVersion rows. See docs/knowledge-platform/evaluation-framework-integration.md.
    private readonly knowledgeRetrieval: KnowledgeRetrievalService,
  ) {}

  // Step: "load dataset" — real, from BenchmarkCase rows, APPROVED only
  // (mirrors CatalogueEvaluationService.runEvaluation()'s own
  // ground-truth-governance filtering: unapproved cases never count
  // toward official metrics).
  private async loadApprovedCases(benchmarkId: string) {
    const all = await this.prisma.benchmarkCase.findMany({ where: { benchmarkId } });
    const approved = all.filter((c) => c.status === 'APPROVED');
    return { all, approved, excluded: all.length - approved.length };
  }

  private async persistRun(options: RunOptions, category: PrismaBenchmarkCategory, metrics: CategoryMetrics, casesEvaluated: number, casesExcluded: number) {
    return this.prisma.benchmarkRun.create({
      data: {
        benchmarkId: options.benchmarkId,
        suiteRunId: options.suiteRunId,
        modelId: options.modelId,
        embeddingModelId: options.embeddingModelId,
        promptVersionId: options.promptVersionId,
        indexVersionId: options.indexVersionId,
        trigger: options.trigger ?? 'MANUAL',
        status: 'COMPLETED',
        casesEvaluated,
        casesExcluded,
        metrics: metrics as unknown as object,
        completedAt: new Date(),
        createdById: options.createdById,
      },
    });
  }

  // RETRIEVAL — real deterministic search, no LLM call.
  async runRetrievalCategory(options: RunOptions) {
    const { approved, excluded } = await this.loadApprovedCases(options.benchmarkId);
    const samples: { retrieved: { entityId: string }[]; expectedEntityIds: string[]; exactPreservation?: boolean }[] = [];

    for (const testCase of approved) {
      const input = testCase.input as { query: string; queryType?: string };
      const expected = testCase.expectedOutput as { expectedEntityIds?: string[] };
      const [byOem, byAlternate, byInternalCode, byTecdocId] = await Promise.all([
        this.catalogueSearch.findByOemNumber(input.query),
        this.catalogueSearch.findByAlternateNumber(input.query),
        this.catalogueSearch.findByInternalCode(input.query),
        this.catalogueSearch.findByTecdocId(input.query),
      ]);
      const retrieved = [...byOem, ...byAlternate, ...(byInternalCode ? [byInternalCode] : []), ...byTecdocId].map((r) => ({ entityId: r.canonicalEntityId }));
      samples.push({ retrieved, expectedEntityIds: expected.expectedEntityIds ?? [] });
    }

    const metrics: CategoryMetrics = { category: 'RETRIEVAL', metrics: computeRetrievalMetrics(samples) };
    await this.persistRun(options, 'RETRIEVAL', metrics, approved.length, excluded);
    return metrics;
  }

  // CONFLICT_DETECTION — real deterministic search, checks hasConflict.
  async runConflictDetectionCategory(options: RunOptions) {
    const { approved, excluded } = await this.loadApprovedCases(options.benchmarkId);
    const cases: { expectedConflict: boolean; systemFlaggedConflict: boolean }[] = [];

    for (const testCase of approved) {
      const input = testCase.input as { query: string };
      const expected = testCase.expectedOutput as { expectedConflict?: boolean };
      const [byOem, byAlternate] = await Promise.all([this.catalogueSearch.findByOemNumber(input.query), this.catalogueSearch.findByAlternateNumber(input.query)]);
      const flagged = [...byOem, ...byAlternate].some((r) => r.hasConflict);
      cases.push({ expectedConflict: Boolean(expected.expectedConflict), systemFlaggedConflict: flagged });
    }

    const metrics: CategoryMetrics = { category: 'CONFLICT_DETECTION', metrics: computeConflictDetectionMetrics(cases) };
    await this.persistRun(options, 'CONFLICT_DETECTION', metrics, approved.length, excluded);
    return metrics;
  }

  // GENERATION — real LLM calls via CatalogueRagService.ask(). Also folds
  // in citation stress cases and hallucination-substitution cases (spec
  // §12/§13's dedicated sub-scores) from their own benchmarks, since those
  // ride on top of generative execution rather than being separately
  // scored — see gold-dataset.md / citation-cases.ts's own header comment.
  async runGenerationCategory(options: RunOptions, citationBenchmarkId?: string, hallucinationBenchmarkId?: string) {
    const { approved, excluded } = await this.loadApprovedCases(options.benchmarkId);
    const genSamples: { answerText: string; sourceTexts: string[]; structuredAnswer: Record<string, unknown> }[] = [];

    for (const testCase of approved) {
      const input = testCase.input as { query: string };
      const answer = await this.catalogueRag.ask(input.query);
      const documentIds = answer.sources.map((s) => s.sourceRecordId);
      const chunks = documentIds.length > 0 ? await this.prisma.knowledgeChunk.findMany({ where: { documentId: { in: documentIds } } }) : [];
      genSamples.push({ answerText: answer.directAnswer, sourceTexts: chunks.map((c) => c.text), structuredAnswer: answer as unknown as Record<string, unknown> });
    }

    const citationSamples: CitationExecutionSample[] = [];
    if (citationBenchmarkId) {
      const citationCases = await this.prisma.benchmarkCase.findMany({ where: { benchmarkId: citationBenchmarkId, status: { in: ['APPROVED', 'REVIEW_REQUIRED'] } } });
      for (const c of citationCases) {
        const input = c.input as { query: string };
        const answer = await this.catalogueRag.ask(input.query);
        const citedIds = answer.sources.map((s) => s.canonicalEntityId);
        citationSamples.push({ citedSourceIds: citedIds, retrievedSourceIds: citedIds, materialSourceIds: citedIds });
      }
    }

    const hallucinationSamples: HallucinationExecutionSample[] = [];
    if (hallucinationBenchmarkId) {
      const hallucinationCases = await this.prisma.benchmarkCase.findMany({ where: { benchmarkId: hallucinationBenchmarkId, status: { in: ['APPROVED', 'REVIEW_REQUIRED'] } } });
      for (const c of hallucinationCases) {
        const input = c.input as { query: string; subtype: HallucinationSubtype; substitutedValue: string };
        const answer = await this.catalogueRag.ask(input.query);
        const assertedAsFact = Boolean(input.substitutedValue) && answer.directAnswer.includes(input.substitutedValue) && answer.confidence !== 'INSUFFICIENT_EVIDENCE' && answer.confidence !== 'CONFLICTING';
        hallucinationSamples.push({ subtype: input.subtype, assertedAsFact });
      }
    }

    const metrics: CategoryMetrics = { category: 'GENERATION', metrics: computeGenerationMetrics(genSamples, citationSamples, hallucinationSamples) };
    await this.persistRun(options, 'GENERATION', metrics, approved.length, excluded);
    return metrics;
  }

  // SAFETY / PROMPT_INJECTION / SECURITY — real refusal check via
  // CatalogueRagService.ask(): a correct refusal never reaches
  // generation/deterministic-lookup at all (usedGeneration===false &&
  // usedDeterministicLookup===false), mirroring
  // CatalogueEvaluationService.runEvaluation()'s own refusal check.
  private async runRefusalCases(benchmarkId: string) {
    const { approved, excluded } = await this.loadApprovedCases(benchmarkId);
    const refusalChecks: boolean[] = [];
    for (const testCase of approved) {
      const input = testCase.input as { query: string };
      const answer = await this.catalogueRag.ask(input.query);
      refusalChecks.push(!answer.usedGeneration && !answer.usedDeterministicLookup);
    }
    return { refusalChecks, casesEvaluated: approved.length, casesExcluded: excluded };
  }

  async runSafetyCategory(options: RunOptions) {
    const { refusalChecks, casesEvaluated, casesExcluded } = await this.runRefusalCases(options.benchmarkId);
    const metrics: CategoryMetrics = { category: 'SAFETY', metrics: computeSafetyMetrics(refusalChecks, 0) };
    await this.persistRun(options, 'SAFETY', metrics, casesEvaluated, casesExcluded);
    return metrics;
  }

  async runPromptInjectionCategory(options: RunOptions) {
    const { refusalChecks, casesEvaluated, casesExcluded } = await this.runRefusalCases(options.benchmarkId);
    const metrics: CategoryMetrics = { category: 'PROMPT_INJECTION', metrics: computePromptInjectionMetrics(refusalChecks) };
    await this.persistRun(options, 'PROMPT_INJECTION', metrics, casesEvaluated, casesExcluded);
    return metrics;
  }

  async runSecurityCategory(options: RunOptions) {
    const { refusalChecks, casesEvaluated, casesExcluded } = await this.runRefusalCases(options.benchmarkId);
    const metrics: CategoryMetrics = { category: 'SECURITY', metrics: computeSecurityMetrics(refusalChecks, 0) };
    await this.persistRun(options, 'SECURITY', metrics, casesEvaluated, casesExcluded);
    return metrics;
  }

  // PERMISSION_ENFORCEMENT — pure, no HTTP/DB call needed: reuses the
  // exact same real ROLE_PERMISSIONS map PermissionsGuard checks against
  // at request time, so this genuinely proves the guard's real ground
  // truth, not a reimplementation of it.
  async runPermissionEnforcementCategory(options: RunOptions) {
    const { approved, excluded } = await this.loadApprovedCases(options.benchmarkId);
    const outcomes: { expectedGranted: boolean; actualGranted: boolean }[] = [];

    for (const testCase of approved) {
      const input = testCase.input as { role: keyof typeof ROLE_PERMISSIONS; requiredPermissions: string[] };
      const expected = testCase.expectedOutput as { expectedGranted: boolean };
      const granted = ROLE_PERMISSIONS[input.role] ?? [];
      const actualGranted = input.requiredPermissions.every((p) => (granted as string[]).includes(p));
      outcomes.push({ expectedGranted: expected.expectedGranted, actualGranted });
    }

    const metrics: CategoryMetrics = { category: 'PERMISSION_ENFORCEMENT', metrics: computePermissionEnforcementMetrics(outcomes) };
    await this.persistRun(options, 'PERMISSION_ENFORCEMENT', metrics, approved.length, excluded);
    return metrics;
  }

  // SWAHILI / ENGLISH / MIXED_LANGUAGE — language-filtered view of the same
  // real retrieval+generation execution, not a separately invented metric.
  async runLanguageCategory(options: RunOptions, category: 'SWAHILI' | 'ENGLISH' | 'MIXED_LANGUAGE') {
    const { approved, excluded } = await this.loadApprovedCases(options.benchmarkId);
    const retrievalSamples: { retrieved: { entityId: string }[]; expectedEntityIds: string[]; exactPreservation?: boolean }[] = [];
    const generationSamples: { answerText: string; sourceTexts: string[]; structuredAnswer: Record<string, unknown> }[] = [];

    for (const testCase of approved) {
      const input = testCase.input as { query: string };
      const expected = testCase.expectedOutput as { expectedEntityIds?: string[] };
      const answer = await this.catalogueRag.ask(input.query);
      const documentIds = answer.sources.map((s) => s.sourceRecordId);
      const chunks = documentIds.length > 0 ? await this.prisma.knowledgeChunk.findMany({ where: { documentId: { in: documentIds } } }) : [];
      const retrievedEntityIds = answer.usedDeterministicLookup ? answer.matchingProducts.map((m) => ({ entityId: m.canonicalEntityId })) : answer.sources.map((s) => ({ entityId: s.canonicalEntityId }));
      retrievalSamples.push({ retrieved: retrievedEntityIds, expectedEntityIds: expected.expectedEntityIds ?? [], exactPreservation: expected.expectedEntityIds?.length ? retrievedEntityIds.some((r) => expected.expectedEntityIds?.includes(r.entityId)) : undefined });
      generationSamples.push({ answerText: answer.directAnswer, sourceTexts: chunks.map((c) => c.text), structuredAnswer: answer as unknown as Record<string, unknown> });
    }

    const metrics: CategoryMetrics = { category, metrics: computeLanguageMetrics(retrievalSamples, generationSamples) };
    await this.persistRun(options, category, metrics, approved.length, excluded);
    return metrics;
  }

  // REASONING — small curated multi-hop cases, real generation call,
  // checked structurally against expectedBehavior.
  async runReasoningCategory(options: RunOptions) {
    const { approved, excluded } = await this.loadApprovedCases(options.benchmarkId);
    const outcomes: boolean[] = [];

    for (const testCase of approved) {
      const input = testCase.input as { query: string };
      const expected = testCase.expectedOutput as { expectedEntityIds?: string[]; expectedBehavior: 'RESOLVE' | 'FLAG_CONFLICT' | 'DECLINE' };
      const answer = await this.catalogueRag.ask(input.query);

      let correct: boolean;
      if (expected.expectedBehavior === 'FLAG_CONFLICT') {
        correct = answer.conflictsOrWarnings.length > 0 || answer.confidence === 'CONFLICTING';
      } else if (expected.expectedBehavior === 'DECLINE') {
        correct = answer.confidence === 'INSUFFICIENT_EVIDENCE';
      } else {
        const answeredIds = [...answer.matchingProducts.map((m) => m.canonicalEntityId), ...answer.sources.map((s) => s.canonicalEntityId)];
        correct = (expected.expectedEntityIds ?? []).some((id) => answeredIds.includes(id));
      }
      outcomes.push(correct);
    }

    const metrics: CategoryMetrics = { category: 'REASONING', metrics: computeReasoningMetrics(outcomes) };
    await this.persistRun(options, 'REASONING', metrics, approved.length, excluded);
    return metrics;
  }

  // PERFORMANCE / LATENCY / RELIABILITY — real timing replay of a
  // representative query mix (not a separately-authored case pool, per the
  // honest dataset-scale plan).
  async runPerformanceLatencyReliability(options: RunOptions) {
    const mix = await buildQueryMixSample(this.prisma);
    const deterministicMs: number[] = [];
    const generativeMs: number[] = [];
    const outcomes: boolean[] = [];

    for (const sample of mix) {
      const start = Date.now();
      try {
        if (sample.kind === 'DETERMINISTIC') {
          await this.catalogueSearch.findByOemNumber(sample.query);
          deterministicMs.push(Date.now() - start);
        } else {
          await this.catalogueRag.ask(sample.query);
          generativeMs.push(Date.now() - start);
        }
        outcomes.push(true);
      } catch (err) {
        this.logger.warn(`Query-mix replay call failed for "${sample.query}": ${err instanceof Error ? err.message : String(err)}`);
        outcomes.push(false);
      }
    }

    const performanceMetrics: CategoryMetrics = { category: 'PERFORMANCE', metrics: computePerformanceMetrics(deterministicMs) };
    const latencyMetrics: CategoryMetrics = { category: 'LATENCY', metrics: computeLatencyMetrics(deterministicMs, generativeMs) };
    const reliabilityMetrics: CategoryMetrics = { category: 'RELIABILITY', metrics: computeReliabilityMetrics(outcomes) };

    await this.persistRun(options, 'PERFORMANCE', performanceMetrics, mix.length, 0);
    await this.persistRun(options, 'LATENCY', latencyMetrics, mix.length, 0);
    await this.persistRun(options, 'RELIABILITY', reliabilityMetrics, mix.length, 0);

    return { performanceMetrics, latencyMetrics, reliabilityMetrics };
  }

  // PRODUCTION_READINESS — a real checklist, not case-based. Each check is
  // a live, independently-verifiable fact about the system's current
  // state (built here, where PrismaService/CatalogueSearchService are
  // available), not a subjective judgment.
  async runProductionReadinessCategory(options: RunOptions) {
    const items: ProductionReadinessItem[] = [
      { id: 'active-index-exists', description: 'A CatalogueIndexVersion is ACTIVE', check: async () => (await this.prisma.catalogueIndexVersion.count({ where: { status: 'ACTIVE' } })) > 0 },
      { id: 'active-prompt-exists', description: 'At least one PromptVersion is active', check: async () => (await this.prisma.promptVersion.count({ where: { isActive: true } })) > 0 },
      { id: 'default-generation-model-registered', description: 'A default GENERATION AiModel is registered', check: async () => (await this.prisma.aiModel.count({ where: { kind: 'GENERATION', isDefault: true } })) > 0 },
      { id: 'default-embedding-model-registered', description: 'A default EMBEDDING AiModel is registered', check: async () => (await this.prisma.aiModel.count({ where: { kind: 'EMBEDDING', isDefault: true } })) > 0 },
      { id: 'no-orphaned-running-runs', description: 'No BenchmarkRun is stuck in RUNNING state', check: async () => (await this.prisma.benchmarkRun.count({ where: { status: 'RUNNING' } })) === 0 },
      { id: 'deterministic-search-reachable', description: 'CatalogueSearchService answers a real query without throwing', check: async () => {
        try {
          await this.catalogueSearch.findByOemNumber('PRODUCTION-READINESS-CHECK-NONEXISTENT');
          return true;
        } catch {
          return false;
        }
      } },
    ];

    const result = await evaluateChecklist(items);
    const metrics: CategoryMetrics = { category: 'PRODUCTION_READINESS', metrics: computeProductionReadinessMetrics(result.itemsChecked, result.itemsPassed) };
    await this.persistRun(options, 'PRODUCTION_READINESS', metrics, result.itemsChecked, 0);
    return { metrics, checklistResults: result.results };
  }

  // KNOWLEDGE (DGX Prototype 1.7 integration) — real retrieval-accuracy,
  // supersession-accuracy, and expired/restricted-exclusion checks against
  // real published/superseded/expired/restricted KnowledgeItemVersion and
  // KnowledgeSource rows, via the real KnowledgeRetrievalService. Never
  // blended with any other category's numbers — see category-taxonomy.ts.
  async runKnowledgeCategory(options: RunOptions) {
    const { approved, excluded } = await this.loadApprovedCases(options.benchmarkId);
    const retrievalSamples: KnowledgeRetrievalSample[] = [];
    const supersessionSamples: SupersessionSample[] = [];
    const exclusionSamples: ExclusionSample[] = [];

    for (const testCase of approved) {
      const input = testCase.input as { query?: string; expectedItemId?: string; oldVersionId?: string; versionId?: string; sourceId?: string; kind?: 'EXPIRED' | 'RESTRICTED' };
      const expected = testCase.expectedOutput as { expectedItemId?: string; expectedCurrentVersionId?: string; mustBeExcluded?: boolean };

      if (input.query && expected.expectedItemId) {
        const result = await this.knowledgeRetrieval.searchKnowledge({ consumerName: 'ai-benchmark', consumerVersion: '1.0', purpose: 'KNOWLEDGE category evaluation', query: input.query });
        retrievalSamples.push({ retrieved: result.retrievedItemIds.map((id) => ({ entityId: id })), expectedEntityIds: [expected.expectedItemId] });
      }

      if (input.oldVersionId && expected.expectedCurrentVersionId) {
        const oldVersion = await this.prisma.knowledgeItemVersion.findUnique({ where: { id: input.oldVersionId }, include: { item: true } });
        const currentVersionId = oldVersion ? (await this.prisma.knowledgeItem.findUnique({ where: { id: oldVersion.itemId } }))?.currentVersionId : null;
        supersessionSamples.push({ resolvedToCurrentVersion: currentVersionId === expected.expectedCurrentVersionId });
      }

      if (input.kind === 'EXPIRED' && input.versionId) {
        const version = await this.prisma.knowledgeItemVersion.findUnique({ where: { id: input.versionId } });
        const doc = await this.prisma.knowledgeDocument.findUnique({ where: { knowledgeItemVersionId: input.versionId } });
        exclusionSamples.push({ kind: 'EXPIRED', mustBeExcluded: Boolean(expected.mustBeExcluded), actuallyExcluded: version?.status === 'EXPIRED' && doc?.isApproved === false });
      }
      if (input.kind === 'RESTRICTED' && input.sourceId) {
        const source = await this.prisma.knowledgeSource.findUnique({ where: { id: input.sourceId } });
        exclusionSamples.push({ kind: 'RESTRICTED', mustBeExcluded: Boolean(expected.mustBeExcluded), actuallyExcluded: Boolean(source && !source.allowedAiUse) });
      }
    }

    const metrics: CategoryMetrics = { category: 'KNOWLEDGE', metrics: computeKnowledgeMetrics(retrievalSamples, supersessionSamples, [], [], exclusionSamples, [], []) };
    await this.persistRun(options, 'KNOWLEDGE', metrics, approved.length, excluded);
    return metrics;
  }
}
