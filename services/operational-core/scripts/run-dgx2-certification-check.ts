// AI Foundation Certification Sprint — Phase II Sprint 3, Workstream 2:
// the DGX 2.0 Certification Runner.
//
// IMPORTANT — this script is written and typechecked as part of Sprint 3,
// but per the Sprint 3 stop condition ("do not execute the certification
// run"), it is deliberately NOT invoked against the real dataset this
// sprint. Its constituent logic (dataset validation, every gate evaluator,
// scorecard construction, verdict calculation) is proven correct via real,
// executed unit and integration tests instead
// (src/dgx2-certification/*.spec.ts). Running this exact script for real
// is the explicit, separate act reserved for the sprint that actually
// executes the first DGX 2.0 certification.
//
// Never hardcodes PASS — every gate result comes from a real Prisma query
// or a real, direct invocation of the actual business-rule functions. See
// DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md §21/§26 and
// docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md §14.
/* eslint-disable no-console */
import 'reflect-metadata';
import 'dotenv/config';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Dgx2CertificationDataset } from '../src/dgx2-certification/dataset-types';
import {
  evaluateSafetyGates,
  computeForecastQualityInputs,
  evaluateForecastQualityGates,
  computeHumanTrustInputs,
  evaluateHumanTrustGates,
  evaluateIntegrationTestCoverage,
  evaluateHistoricalMetricsGate,
  evaluateObservabilityGate,
  evaluateDatasetIntegrityGate,
  GateResult,
} from '../src/dgx2-certification/gate-evaluators';
import { buildCertificationScorecard, RecommendationEvidenceSummary } from '../src/dgx2-certification/scorecard';

const DATASET_VERSION = 'v1';
const repoRoot = '../..';
const datasetPath = `${repoRoot}/docs/certification/datasets/dgx2-certification-dataset-${DATASET_VERSION}.json`;
const reportsDir = `${repoRoot}/docs/certification/reports`;

async function computeRecommendationSummary(prisma: PrismaService): Promise<RecommendationEvidenceSummary> {
  const purchaseRecs = await prisma.purchaseRecommendation.findMany();
  const transferRecs = await prisma.transferRecommendation.findMany();
  const total = purchaseRecs.length + transferRecs.length;
  const accepted = purchaseRecs.filter((r) => r.status === 'APPROVED').length + transferRecs.filter((r) => r.status === 'APPROVED').length;
  const rejected = purchaseRecs.filter((r) => r.status === 'REJECTED').length + transferRecs.filter((r) => r.status === 'REJECTED').length;
  const decided = accepted + rejected;

  const confidenceDistribution: Record<string, number> = {};
  for (const rec of purchaseRecs) {
    confidenceDistribution[rec.confidence] = (confidenceDistribution[rec.confidence] ?? 0) + 1;
  }

  return {
    totalRecommendations: total,
    accepted,
    rejected,
    approvalRatePct: decided > 0 ? (accepted / decided) * 100 : null,
    confidenceDistribution,
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);

  try {
    console.log('=== DGX 2.0 Certification Runner ===');

    if (!existsSync(datasetPath)) {
      throw new Error(`Certification Dataset not found at ${datasetPath} — run scripts/build-dgx2-certification-dataset.ts first.`);
    }
    const dataset: Dgx2CertificationDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));

    const gates: GateResult[] = [];

    const { gate: datasetGate } = evaluateDatasetIntegrityGate(dataset);
    gates.push(datasetGate);
    console.log(`[GATE] ${datasetGate.gate}: ${datasetGate.status}`);

    for (const gate of evaluateSafetyGates()) {
      gates.push(gate);
      console.log(`[GATE] ${gate.gate}: ${gate.status}`);
    }

    const forecastQualityInputs = await computeForecastQualityInputs(prisma);
    for (const gate of evaluateForecastQualityGates(forecastQualityInputs)) {
      gates.push(gate);
      console.log(`[GATE] ${gate.gate}: ${gate.status}`);
    }

    const humanTrustInputs = await computeHumanTrustInputs(prisma);
    for (const gate of evaluateHumanTrustGates(humanTrustInputs)) {
      gates.push(gate);
      console.log(`[GATE] ${gate.gate}: ${gate.status}`);
    }

    const integrationGate = evaluateIntegrationTestCoverage(`${repoRoot}/services/operational-core/src`);
    gates.push(integrationGate);
    console.log(`[GATE] ${integrationGate.gate}: ${integrationGate.status}`);

    // Real, executed full test-suite run — mirrors
    // verify-ai-foundation-certification.ts's own execSync('npx jest ...')
    // pattern. This is the one place this script actually runs the suite;
    // never invoked recursively from inside a Jest process.
    let testSuiteGate: GateResult;
    try {
      const out = execSync('npx jest --runInBand --selectProjects unit integration', { cwd: process.cwd(), timeout: 600_000 }).toString();
      const summary = out.split('\n').filter((l) => l.includes('Tests:') || l.includes('Test Suites:')).join(' | ');
      testSuiteGate = { gate: 'FULL_TEST_SUITE', status: 'PASS', actual: summary, threshold: '0 failed', reason: summary };
    } catch (err) {
      const output = (err as { stdout?: Buffer }).stdout?.toString() ?? (err as Error).message;
      testSuiteGate = { gate: 'FULL_TEST_SUITE', status: 'FAIL', actual: output.slice(0, 1000), threshold: '0 failed', reason: 'The full test suite reported one or more failures.' };
    }
    gates.push(testSuiteGate);
    console.log(`[GATE] ${testSuiteGate.gate}: ${testSuiteGate.status}`);

    const historicalMetricsGate = await evaluateHistoricalMetricsGate(prisma);
    gates.push(historicalMetricsGate);
    console.log(`[GATE] ${historicalMetricsGate.gate}: ${historicalMetricsGate.status}`);

    const observabilityGate = await evaluateObservabilityGate();
    gates.push(observabilityGate);
    console.log(`[GATE] ${observabilityGate.gate}: ${observabilityGate.status}`);

    const recommendationSummary = await computeRecommendationSummary(prisma);
    const decidedTotal = recommendationSummary.accepted + recommendationSummary.rejected;
    const auditCoveragePct = decidedTotal > 0 ? (humanTrustInputs.decidedRecommendationsWithAudit / humanTrustInputs.decidedRecommendations) * 100 : null;

    const scorecard = buildCertificationScorecard({
      datasetVersion: dataset.datasetVersion,
      forecastAccuracy: {
        chosenBestRunCount: forecastQualityInputs.chosenBestRunCount,
        mape: forecastQualityInputs.averageMape,
        wape: forecastQualityInputs.averageWape,
        mase: forecastQualityInputs.averageMase,
        rmse: forecastQualityInputs.averageRmse,
        bias: forecastQualityInputs.averageBias,
      },
      recommendations: recommendationSummary,
      auditCoveragePct,
      integrationCoveragePct: (Number(integrationGate.actual) / Number(integrationGate.threshold)) * 100,
      observabilityCoveragePct: (Number(observabilityGate.actual) / Number(observabilityGate.threshold)) * 100,
      gates,
      // Real, honest fact as of this sprint — see scorecard.ts's own
      // documentation of this field. Not a hardcoded assumption: narrative
      // explanations are explicitly out of scope through Sprint 3.
      explainabilityStandardMet: false,
    });

    console.log('\n=== SCORECARD ===');
    console.log(JSON.stringify(scorecard, null, 2));
    console.log(`\n*** CERTIFICATION VERDICT: ${scorecard.overallVerdict} ***`);
    console.log(scorecard.verdictReason);

    mkdirSync(reportsDir, { recursive: true });
    const reportPath = `${reportsDir}/dgx2-certification-report-${Date.now()}.md`;
    writeFileSync(reportPath, renderCertificationReport(scorecard), 'utf-8');
    console.log(`\nReport written to ${reportPath}`);
  } finally {
    await app.close();
  }
}

function renderHistoricalMetricsAuditSection(scorecard: ReturnType<typeof buildCertificationScorecard>): string {
  const gate = scorecard.gates.find((g) => g.gate === 'HISTORICAL_METRICS_PERSISTED');
  const auditTrail = gate?.auditTrail ?? [];
  if (auditTrail.length === 0) {
    return 'No real ForecastRun rows were missing WAPE or MASE — no exclusion audit applies.';
  }
  return auditTrail
    .map((row) => {
      const conditionLines = row.conditions.map((c) => `  - ${c.condition}: ${c.passed ? 'PASS' : 'FAIL'} — ${c.detail}`).join('\n');
      return `### ForecastRun \`${row.forecastRunId}\` (${row.targetType} / ${row.method})\n\n- Verdict: ${row.excluded ? '**EXCLUDED** (Amendment v1.1 §6A satisfied)' : '**NOT EXCLUDED — counts as a failure**'}\n- ${row.reason}\n\n${conditionLines}`;
    })
    .join('\n\n');
}

function renderCertificationReport(scorecard: ReturnType<typeof buildCertificationScorecard>): string {
  const gateRows = scorecard.gates.map((g) => `| ${g.gate} | ${g.status} | ${JSON.stringify(g.actual)} | ${JSON.stringify(g.threshold)} | ${g.reason} |`).join('\n');
  return `# DGX 2.0 Certification Report

## Executive Summary

Verdict: **${scorecard.overallVerdict}**

${scorecard.verdictReason}

## Dataset Summary

Dataset version: ${scorecard.datasetVersion}

## Metrics Summary

- Forecast Accuracy: MASE=${scorecard.forecastAccuracy.mase}, WAPE=${scorecard.forecastAccuracy.wape}, MAPE=${scorecard.forecastAccuracy.mape}, RMSE=${scorecard.forecastAccuracy.rmse}, Bias=${scorecard.forecastAccuracy.bias} (${scorecard.forecastAccuracy.chosenBestRunCount} real chosen-best runs)
- Recommendations: ${scorecard.recommendations.totalRecommendations} total, ${scorecard.recommendations.accepted} accepted, ${scorecard.recommendations.rejected} rejected (approval rate: ${scorecard.recommendations.approvalRatePct ?? 'n/a'}%)
- Audit coverage: ${scorecard.auditCoveragePct ?? 'n/a'}%
- Integration test coverage: ${scorecard.integrationCoveragePct}%
- Observability coverage: ${scorecard.observabilityCoveragePct}%
- Safety Gate status: ${scorecard.safetyGateStatus}

## Gate Results

| Gate | Status | Actual | Threshold | Reason |
|---|---|---|---|---|
${gateRows}

## HISTORICAL_METRICS_PERSISTED — Exclusion Audit (Amendment v1.1)

Every real ForecastRun row missing WAPE or MASE is listed individually below — an excluded row is never omitted or silently subtracted from a count.

${renderHistoricalMetricsAuditSection(scorecard)}

## Failed Gates

${scorecard.failedGates.length === 0 ? 'None.' : scorecard.failedGates.map((g) => `- ${g.gate}: ${g.reason}`).join('\n')}

## Warnings

${scorecard.overallVerdict === 'NOT_READY' ? '- Certification is not yet achievable — see Failed Gates above.' : '- None beyond what is captured in the verdict reason.'}

## Risks

- Real data volume in this environment is genuinely small (see the Certification Dataset's own known limitations) — real coverage will strengthen as real business volume grows.

## Recommendations

- Address every Failed Gate before attempting a subsequent real certification run.
- Treat this report as one point-in-time real measurement, not a permanent status.

## Next Actions

- If verdict is NOT_READY: fix the failed gates and re-run.
- If verdict is LIMITED_PILOT or above: proceed per \`AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md\` §15 (sign-offs) before any real Pilot begins.
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
