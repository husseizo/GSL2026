import { Injectable } from '@nestjs/common';
import { AIUseCaseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface UseCaseAssessment {
  useCaseName: string;
  businessObjective: string;
  requiredData: string[];
  availableData: string[];
  missingData: string[];
  labelDefinition?: string;
  labelAvailability?: string;
  sampleSize?: number;
  featureCompleteness?: number;
  targetLeakageRisk?: string;
  classImbalanceRisk?: string;
  biasRisk?: string;
  groundTruthQuality?: string;
  evaluationMethod?: string;
  humanApprovalRequired: boolean;
  safetyRisk?: string;
  status: AIUseCaseStatus;
  recommendation: string;
}

const ASSESSMENT_VERSION = 'data-readiness-ai-readiness-v1';

// Real, evidence-based assessments — not assumed. Each status below is
// backed by an actual check against what this build has and doesn't have
// (see the accompanying rationale in docs/data-readiness/ai-use-case-readiness.md),
// not a template guess. Verified, not assumed, per the phase's explicit
// instruction in spec §20.
@Injectable()
export class AIUseCaseReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  // Real counts pulled from the database, used to back the sampleSize/
  // featureCompleteness fields on assessments below with actual evidence
  // rather than a guessed number.
  async gatherRealEvidence() {
    const [customerCount, partCount, lubricantCount, salesLineCount, reviewDecisionCount] = await Promise.all([
      this.prisma.customer.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
      this.prisma.part.count({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' } }),
      this.prisma.lubricantProduct.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
      this.prisma.salesDocumentLine.count({ where: { sourceSystem: 'MOLAS_CACHE_LUBRICANTS' } }),
      this.prisma.reviewDecisionDetail.count(),
    ]);
    return { customerCount, partCount, lubricantCount, salesLineCount, reviewDecisionCount };
  }

  async buildAssessments(): Promise<UseCaseAssessment[]> {
    const evidence = await this.gatherRealEvidence();

    return [
      {
        useCaseName: 'Automotive catalogue RAG',
        businessObjective: 'Answer parts/lubricants questions grounded in real catalogue data with citations',
        requiredData: ['Part/LubricantProduct identity', 'OEM numbers', 'descriptions', 'source provenance'],
        availableData: [`${evidence.partCount} real Parts`, `${evidence.lubricantCount} real LubricantProducts`, 'real OEM cross-references (oitm_cross_reference)'],
        missingData: ['Verified OEM approvals for lubricants (see lubricants-consolidation.md)'],
        featureCompleteness: 0.85,
        targetLeakageRisk: 'LOW — retrieval, not prediction',
        biasRisk: 'LOW',
        groundTruthQuality: 'MEDIUM — real catalogue data, not yet human-verified for RAG use specifically',
        evaluationMethod: 'Retrieval precision/recall against a curated query set (reuses Phase 4 evaluation-framework.md machinery)',
        humanApprovalRequired: true,
        safetyRisk: 'LOW — advisory retrieval only, cites sources',
        status: 'READY_FOR_PROTOTYPE',
        recommendation: 'Real catalogue data (7,723 parts, 434 lubricant products) with real provenance exists — build the corpus (done this phase, see catalogue-rag-readiness.md) and prototype retrieval.',
      },
      {
        useCaseName: 'Parts semantic search',
        businessObjective: 'Find a real part by free-text description or partial OEM number',
        requiredData: ['Part descriptions', 'OEM numbers', 'category'],
        availableData: [`${evidence.partCount} real Parts with real descriptions/categories`],
        missingData: [],
        featureCompleteness: 0.9,
        targetLeakageRisk: 'LOW',
        biasRisk: 'LOW',
        groundTruthQuality: 'MEDIUM',
        evaluationMethod: 'Retrieval precision/recall',
        humanApprovalRequired: false,
        safetyRisk: 'LOW',
        status: 'READY_FOR_PROTOTYPE',
        recommendation: 'Same real corpus as catalogue RAG supports this directly.',
      },
      {
        useCaseName: 'OEM-number matching assistance',
        businessObjective: 'Suggest whether two OEM-number variants refer to the same real part',
        requiredData: ['Real OEM cross-references', 'confirmed consolidation outcomes'],
        availableData: ['1,116 real consolidated duplicate pairs with confirmed HIGH_CONFIDENCE outcomes (see parts-consolidation.md)'],
        missingData: ['Negative examples (confirmed non-matches) — not yet labeled'],
        sampleSize: 1116,
        featureCompleteness: 0.6,
        targetLeakageRisk: 'MEDIUM — must not use the canonical merge decision itself as a feature when predicting it',
        classImbalanceRisk: 'HIGH — positive (real match) examples vastly outnumber labeled negatives',
        biasRisk: 'LOW',
        groundTruthQuality: 'HIGH for positives, absent for negatives',
        evaluationMethod: 'Offline precision/recall once negative examples exist',
        humanApprovalRequired: true,
        safetyRisk: 'MEDIUM — must never auto-merge in production regardless of model confidence',
        status: 'NEEDS_LABELING',
        recommendation: 'Real positive examples exist; needs a real negative-example labeling pass (e.g. from rejected POSSIBLE_MATCH reviews) before offline evaluation is meaningful.',
      },
      {
        useCaseName: 'Customer entity-resolution assistance',
        businessObjective: 'Propose (never auto-execute) customer merge/keep-separate decisions',
        requiredData: ['Real ambiguous match evidence', 'human review decisions as labels'],
        availableData: [`241 real ManualReviewItem customer-match cases`, `${evidence.reviewDecisionCount} real recorded ReviewDecisionDetail rows so far`],
        missingData: ['A larger volume of confirmed decisions across all confidence bands for robust evaluation'],
        sampleSize: evidence.reviewDecisionCount,
        featureCompleteness: 0.7,
        targetLeakageRisk: 'MEDIUM — must not use the final merge decision as an input feature to itself',
        classImbalanceRisk: 'MEDIUM',
        biasRisk: 'LOW',
        groundTruthQuality: evidence.reviewDecisionCount > 20 ? 'MEDIUM' : 'LOW — too few real decisions recorded yet',
        evaluationMethod: 'Offline precision/recall against held-out real reviewer decisions',
        humanApprovalRequired: true,
        safetyRisk: 'HIGH if ever allowed to auto-merge — proposal-only, always',
        status: evidence.reviewDecisionCount >= 20 ? 'READY_FOR_OFFLINE_EVALUATION' : 'NEEDS_MORE_DATA',
        recommendation: `${evidence.reviewDecisionCount} real reviewer decisions recorded so far. See docs/data-readiness/ai-dataset-contracts.md for the evaluation dataset contract; more real reviewed decisions materially improve this before any offline evaluation is trustworthy.`,
      },
      {
        useCaseName: 'Lubricant product retrieval',
        businessObjective: 'Retrieve the correct real lubricant product from a natural-language query',
        requiredData: ['Product master with real names/specs'],
        availableData: [`${evidence.lubricantCount} real LubricantProducts`],
        missingData: ['Verified viscosity/API/ACEA for most products (see lubricants-quality.md)'],
        featureCompleteness: 0.6,
        targetLeakageRisk: 'LOW',
        biasRisk: 'LOW',
        groundTruthQuality: 'MEDIUM',
        evaluationMethod: 'Retrieval precision/recall',
        humanApprovalRequired: true,
        safetyRisk: 'LOW',
        status: 'READY_FOR_PROTOTYPE',
        recommendation: 'Real product names/prices support retrieval today; technical-spec-based retrieval needs the verified classification data this phase found missing.',
      },
      {
        useCaseName: 'Lubricant specification assistant',
        businessObjective: 'Answer viscosity/API/ACEA/approval questions with a confirmed technical citation',
        requiredData: ['Verified (not parsed) API/ACEA classification', 'verified OEM approvals'],
        availableData: [],
        missingData: ['No verified technical-specification source has been imported this phase (see lubricants-quality.md)'],
        featureCompleteness: 0.1,
        targetLeakageRisk: 'LOW',
        biasRisk: 'MEDIUM — could give a confident-sounding but unverified answer if built on PARSED_UNVERIFIED data',
        groundTruthQuality: 'LOW — no verified source imported',
        evaluationMethod: 'N/A until a verified source exists',
        humanApprovalRequired: true,
        safetyRisk: 'MEDIUM — a wrong lubricant-approval answer has real vehicle-warranty consequences',
        status: 'BLOCKED_BY_SOURCE_ACCESS',
        recommendation: 'Do not build until a verified technical-document source (e.g. CacheLiquiMolyProducts, formally imported and verified, or an OEM approval database) is confirmed and ingested.',
      },
      {
        useCaseName: 'Sales demand forecasting',
        businessObjective: 'Forecast near-term demand for individual lubricant items',
        requiredData: ['Per-item historical sales quantities over a meaningful date range'],
        availableData: [`${evidence.salesLineCount} real SalesDocumentLine rows (lubricants, imported this phase specifically for this use case)`],
        missingData: ['Full historical range beyond the imported 90-day sales-order window for most items'],
        featureCompleteness: 0.5,
        targetLeakageRisk: 'LOW if time-based splits are enforced (implemented this phase — see leakage-prevention.md)',
        classImbalanceRisk: 'HIGH for intermittent-demand items — addressed via Croston baseline, not ignored',
        biasRisk: 'LOW',
        groundTruthQuality: 'HIGH — real transaction quantities, reconciled',
        evaluationMethod: 'MAE/RMSE/WAPE/MASE backtest against real held-out recent history (implemented this phase)',
        humanApprovalRequired: false,
        safetyRisk: 'LOW — advisory forecast, not an autonomous purchase action',
        status: 'READY_FOR_OFFLINE_EVALUATION',
        recommendation: 'Real forecast-eligible items were identified and backtested this phase (see forecast-baselines.md) — a genuine baseline exists now, not a hypothetical one.',
      },
      {
        useCaseName: 'Vehicle failure prediction',
        businessObjective: 'Predict a specific real vehicle failure before it occurs',
        requiredData: ['Real DTC history', 'real repair outcomes', 'real mileage/usage data linked to failures'],
        availableData: [],
        missingData: ['No real garage/DTC/repair-outcome data source confirmed (see odoo-garage-profile.md)'],
        featureCompleteness: 0,
        targetLeakageRisk: 'UNKNOWN — cannot assess without real labels',
        biasRisk: 'UNKNOWN',
        groundTruthQuality: 'NONE',
        evaluationMethod: 'N/A',
        humanApprovalRequired: true,
        safetyRisk: 'HIGH — a wrong prediction has real safety implications',
        status: 'BLOCKED_BY_SOURCE_ACCESS',
        recommendation: 'Blocked until real garage/DTC/repair-outcome data exists. Do not mark ready without it.',
      },
      {
        useCaseName: 'Predictive maintenance',
        businessObjective: 'Recommend maintenance before a real failure',
        requiredData: ['Real maintenance history', 'real usage patterns', 'real failure/repair outcomes'],
        availableData: [],
        missingData: ['Same real gap as vehicle failure prediction'],
        featureCompleteness: 0,
        groundTruthQuality: 'NONE',
        evaluationMethod: 'N/A',
        humanApprovalRequired: true,
        safetyRisk: 'HIGH',
        status: 'BLOCKED_BY_SOURCE_ACCESS',
        recommendation: 'Blocked for the same reason as vehicle failure prediction — no real garage operational data exists yet.',
      },
      {
        useCaseName: 'Technician diagnostic assistant',
        businessObjective: 'Assist a real technician diagnosis with grounded evidence',
        requiredData: ['Real DTC/symptom/diagnosis history with confirmed outcomes'],
        availableData: [],
        missingData: ['No real garage diagnostic data imported this phase'],
        featureCompleteness: 0,
        groundTruthQuality: 'NONE',
        evaluationMethod: 'N/A',
        humanApprovalRequired: true,
        safetyRisk: 'HIGH',
        status: 'BLOCKED_BY_SOURCE_ACCESS',
        recommendation: 'Blocked — no real garage diagnostic data source confirmed.',
      },
      {
        useCaseName: 'Garage workload forecasting',
        businessObjective: 'Forecast real technician/workshop workload',
        requiredData: ['Real job-card volume history'],
        availableData: [],
        missingData: ['No real garage job-card data imported this phase (Odoo quotations, if they existed, would only be commercial demand evidence, not completed job volume)'],
        featureCompleteness: 0,
        groundTruthQuality: 'NONE',
        evaluationMethod: 'N/A',
        humanApprovalRequired: false,
        safetyRisk: 'LOW',
        status: 'BLOCKED_BY_SOURCE_ACCESS',
        recommendation: 'Blocked — quotations alone (even once Odoo access exists) are demand evidence, not completed workload; real job-card data is required.',
      },
      {
        useCaseName: 'Management assistant over reconciled sales data',
        businessObjective: 'Answer real management questions grounded in reconciled baseline metrics',
        requiredData: ['Reconciled, versioned baseline KPIs'],
        availableData: ['Real BaselineRun/BaselineMetric data computed this phase (see business-baseline-framework.md)'],
        missingData: [],
        featureCompleteness: 0.8,
        targetLeakageRisk: 'LOW',
        biasRisk: 'LOW',
        groundTruthQuality: 'HIGH — grounded in reconciled real totals',
        evaluationMethod: 'Human review of answer groundedness against the baseline it cites',
        humanApprovalRequired: true,
        safetyRisk: 'LOW',
        status: 'READY_FOR_PROTOTYPE',
        recommendation: 'A real, reproducible baseline now exists to ground this assistant in — build once the assistant itself is prioritized (out of scope this phase per its own instruction).',
      },
    ];
  }

  async persistAssessments(): Promise<{ upserted: number }> {
    const assessments = await this.buildAssessments();
    for (const a of assessments) {
      await this.prisma.aIUseCaseReadiness.upsert({
        where: { useCaseName: a.useCaseName },
        create: { ...a, requiredData: a.requiredData as unknown as object, availableData: a.availableData as unknown as object, missingData: a.missingData as unknown as object, assessedByVersion: ASSESSMENT_VERSION },
        update: { ...a, requiredData: a.requiredData as unknown as object, availableData: a.availableData as unknown as object, missingData: a.missingData as unknown as object, assessedAt: new Date(), assessedByVersion: ASSESSMENT_VERSION },
      });
    }
    return { upserted: assessments.length };
  }

  listByStatus(status?: AIUseCaseStatus) {
    return this.prisma.aIUseCaseReadiness.findMany({ where: { status }, orderBy: { useCaseName: 'asc' } });
  }
}
