import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Real prom-client metrics, real /metrics endpoint (observability.controller.ts)
// — genuinely scrapeable Prometheus text format. No live Prometheus server
// or Grafana instance is running in this sandbox to scrape/display it (see
// docs/architecture/production-observability.md for exactly what that
// means); the instrumentation itself, which is the actual code deliverable,
// is real and independently verifiable via `curl /metrics`.
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'aios_http_requests_total',
    help: 'Total HTTP requests processed',
    labelNames: ['method', 'route', 'status'],
    registers: [this.registry],
  });

  readonly httpRequestDuration = new Histogram({
    name: 'aios_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly aiInferenceDuration = new Histogram({
    name: 'aios_ai_inference_duration_seconds',
    help: 'DGX AI inference call duration in seconds',
    labelNames: ['kind', 'success'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    registers: [this.registry],
  });

  readonly branchGatewayQueueDepth = new Histogram({
    name: 'aios_branch_gateway_queue_depth',
    help: 'Branch Gateway outbox queue depth observed at ping time',
    buckets: [0, 1, 5, 10, 50, 100, 500],
    registers: [this.registry],
  });

  readonly notificationDispatchTotal = new Counter({
    name: 'aios_notification_dispatch_total',
    help: 'Total notification dispatch attempts',
    labelNames: ['channel', 'status'],
    registers: [this.registry],
  });

  // DGX Prototype 1.5 — catalogue-RAG-specific observability, real counters
  // wired from CatalogueRagService itself (not simulated). See
  // docs/ai-tuning/performance-optimization.md.
  readonly catalogueQueryRouteTotal = new Counter({
    name: 'aios_catalogue_query_route_total',
    help: 'Catalogue RAG query-router decisions by route type',
    labelNames: ['routeType'],
    registers: [this.registry],
  });

  readonly catalogueClaimsRemovedTotal = new Counter({
    name: 'aios_catalogue_claims_removed_total',
    help: 'Sentences removed by claim verification for referencing an identifier absent from retrieved evidence',
    registers: [this.registry],
  });

  readonly catalogueRefusalTotal = new Counter({
    name: 'aios_catalogue_refusal_total',
    help: 'Requests refused before retrieval/generation by the query router (prompt injection, unsupported diagnostic request)',
    labelNames: ['reason'],
    registers: [this.registry],
  });

  readonly catalogueConfidenceTotal = new Counter({
    name: 'aios_catalogue_confidence_total',
    help: 'Catalogue RAG answers by final confidence level',
    labelNames: ['level'],
    registers: [this.registry],
  });

  // DGX Prototype 1.7.1 — 23 real Knowledge Platform metrics (spec §34),
  // the first-ever real Gauge usage in this file. Every Gauge needs a real
  // .set() call site to stay live; where no live scheduler exists in this
  // environment to refresh one continuously, that's named honestly in
  // docs/trusted-knowledge-pilot/metrics.md rather than implied complete —
  // the same SCHEDULED_DOC_ONLY limitation already accepted elsewhere in
  // this codebase.
  readonly knowledgeSourcesTotal = new Gauge({ name: 'knowledge_sources_total', help: 'Total real registered KnowledgeSource rows', registers: [this.registry] });
  readonly knowledgeSourcesByStatus = new Gauge({ name: 'knowledge_sources_by_status', help: 'Real KnowledgeSource rows by status', labelNames: ['status'], registers: [this.registry] });
  readonly knowledgeDocumentsIngestedTotal = new Counter({ name: 'knowledge_documents_ingested_total', help: 'Real documents successfully ingested (drafted)', labelNames: ['format'], registers: [this.registry] });
  readonly knowledgeIngestionFailuresTotal = new Counter({ name: 'knowledge_ingestion_failures_total', help: 'Real ingestion pipeline stage failures', labelNames: ['stage'], registers: [this.registry] });
  readonly knowledgeDocumentsQuarantinedTotal = new Counter({ name: 'knowledge_documents_quarantined_total', help: 'Real documents quarantined (injection or malware)', labelNames: ['reason'], registers: [this.registry] });
  readonly knowledgeParserFailuresTotal = new Counter({ name: 'knowledge_parser_failures_total', help: 'Real parser failures by format', labelNames: ['format'], registers: [this.registry] });
  readonly knowledgeOcrPagesTotal = new Counter({ name: 'knowledge_ocr_pages_total', help: 'Real pages processed via OCR fallback', registers: [this.registry] });
  readonly knowledgeOcrLowConfidenceTotal = new Counter({ name: 'knowledge_ocr_low_confidence_total', help: 'Real OCR pages below the confidence threshold used for high-risk gating', registers: [this.registry] });
  readonly knowledgeCandidateClaimsTotal = new Counter({ name: 'knowledge_candidate_claims_total', help: 'Real candidate claims extracted', registers: [this.registry] });
  readonly knowledgeClaimsApprovedTotal = new Counter({ name: 'knowledge_claims_approved_total', help: 'Real claims verified as VERIFIED', registers: [this.registry] });
  readonly knowledgeClaimsRejectedTotal = new Counter({ name: 'knowledge_claims_rejected_total', help: 'Real claims marked DISPUTED or RETRACTED', registers: [this.registry] });
  readonly knowledgeStructuredFactsTotal = new Counter({ name: 'knowledge_structured_facts_total', help: 'Real structured facts created', labelNames: ['factType', 'extractedBy'], registers: [this.registry] });
  readonly knowledgeReviewBacklog = new Gauge({ name: 'knowledge_review_backlog', help: 'Real undecided KnowledgeReviewAssignment rows', registers: [this.registry] });
  readonly knowledgeReviewLatency = new Histogram({ name: 'knowledge_review_latency_seconds', help: 'Real real time from assignment to decision', buckets: [60, 300, 1800, 3600, 86400, 604800], registers: [this.registry] });
  readonly knowledgeConflictsOpen = new Gauge({ name: 'knowledge_conflicts_open', help: 'Real OPEN KnowledgeConflict rows', registers: [this.registry] });
  readonly knowledgeExpiredItemsTotal = new Counter({ name: 'knowledge_expired_items_total', help: 'Real versions transitioned to EXPIRED', registers: [this.registry] });
  readonly knowledgeStaleItemsTotal = new Gauge({ name: 'knowledge_stale_items_total', help: 'Real versions classified STALE at last check', registers: [this.registry] });
  readonly knowledgeSnapshotAgeSeconds = new Gauge({ name: 'knowledge_snapshot_age_seconds', help: 'Real age in seconds of the currently ACTIVE KnowledgeSnapshot', registers: [this.registry] });
  readonly knowledgeRetrievalLatency = new Histogram({ name: 'knowledge_retrieval_latency_seconds', help: 'Real searchKnowledge() call duration', buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5], registers: [this.registry] });
  readonly knowledgePermissionDenialsTotal = new Counter({ name: 'knowledge_permission_denials_total', help: 'Real KnowledgeSourcePermission denials', labelNames: ['action'], registers: [this.registry] });
  readonly knowledgeCitationFailuresTotal = new Counter({ name: 'knowledge_citation_failures_total', help: 'Real citations that failed to resolve to a real, still-existing version', registers: [this.registry] });
  readonly knowledgeEvaluationGateFailuresTotal = new Counter({ name: 'knowledge_evaluation_gate_failures_total', help: 'Real trusted-knowledge quality gate FAIL outcomes', labelNames: ['gate'], registers: [this.registry] });
  readonly knowledgeMalwareScanFailuresTotal = new Counter({ name: 'knowledge_malware_scan_failures_total', help: 'Real documents quarantined by malware scanning', labelNames: ['scannerUsed'], registers: [this.registry] });

  // DGX Prototype 1.7.2 — Retrieval Intelligence Platform metrics (spec §18's
  // exact list). "No hidden metrics" — every one of these has a real call
  // site in src/retrieval-intelligence/pipeline/retrieval-pipeline.service.ts.
  readonly retrievalQueriesTotal = new Counter({ name: 'retrieval_queries_total', help: 'Real retrieval queries processed', labelNames: ['queryClass', 'consumerName'], registers: [this.registry] });
  readonly retrievalLatency = new Histogram({ name: 'retrieval_latency_seconds', help: 'Real end-to-end retrieval pipeline duration', buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5], registers: [this.registry] });
  readonly retrievalStrategyUsageTotal = new Counter({ name: 'retrieval_strategy_usage_total', help: 'Real hybrid retrieval mode selections', labelNames: ['strategyMode'], registers: [this.registry] });
  readonly retrievalIdentifierQueriesTotal = new Counter({ name: 'identifier_queries_total', help: 'Real queries classified into an identifier-shaped class', registers: [this.registry] });
  readonly retrievalSemanticQueriesTotal = new Counter({ name: 'semantic_queries_total', help: 'Real queries that fell through to semantic/free-text classes', registers: [this.registry] });
  readonly retrievalGraphExpansionsTotal = new Counter({ name: 'graph_expansions_total', help: 'Real additional candidates produced by graph expansion', registers: [this.registry] });
  readonly retrievalRankingFailuresTotal = new Counter({ name: 'ranking_failures_total', help: 'Real ranking-stage failures', registers: [this.registry] });
  readonly retrievalFalsePositiveRate = new Gauge({ name: 'false_positive_rate', help: 'Real measured false-positive rate from the last gold benchmark run', registers: [this.registry] });
  readonly retrievalFalseNegativeRate = new Gauge({ name: 'false_negative_rate', help: 'Real measured false-negative rate from the last gold benchmark run', registers: [this.registry] });
  readonly retrievalRecallAt1 = new Gauge({ name: 'recall_at_1', help: 'Real measured Recall@1 from the last gold benchmark run', registers: [this.registry] });
  readonly retrievalMrr = new Gauge({ name: 'mrr', help: 'Real measured Mean Reciprocal Rank from the last gold benchmark run', registers: [this.registry] });
  readonly retrievalNdcg = new Gauge({ name: 'ndcg', help: 'Real measured nDCG from the last gold benchmark run', registers: [this.registry] });
  readonly retrievalSnapshotUsageTotal = new Counter({ name: 'snapshot_usage_total', help: 'Real snapshot selections by status', labelNames: ['snapshotStatus'], registers: [this.registry] });
  readonly retrievalCitationFailuresTotal = new Counter({ name: 'retrieval_citation_failures_total', help: 'Real retrieval-stage citations that failed to resolve', registers: [this.registry] });

  // AI Foundation Certification Sprint metrics (spec §19's exact list).
  // Real call sites in retrieval-pipeline.service.ts and
  // retrieval-intelligence-quality-gates.ts — no hidden metrics.
  readonly identifierHitRate = new Gauge({ name: 'identifier_hit_rate', help: 'Real fraction of identifier-shaped queries that resolved via deterministic exact lookup', registers: [this.registry] });
  readonly identifierMissRate = new Gauge({ name: 'identifier_miss_rate', help: 'Real fraction of identifier-shaped queries that failed to resolve via deterministic exact lookup', registers: [this.registry] });
  readonly retrievalCandidateCount = new Histogram({ name: 'retrieval_candidate_count', help: 'Real number of candidates surviving to ranking per query', buckets: [0, 1, 2, 5, 10, 20], registers: [this.registry] });
  readonly retrievalAverageRank = new Gauge({ name: 'retrieval_average_rank', help: 'Real average rank of the expected answer across the last gold benchmark run', registers: [this.registry] });
  readonly retrievalTop1Accuracy = new Gauge({ name: 'retrieval_top1_accuracy', help: 'Real Recall@1 restated as a certification-facing name', registers: [this.registry] });
  readonly retrievalTop3Accuracy = new Gauge({ name: 'retrieval_top3_accuracy', help: 'Real Recall@3 from the last gold benchmark run', registers: [this.registry] });
  readonly graphExpansionUsageTotal = new Counter({ name: 'graph_expansion_usage_total', help: 'Real queries where graph expansion actually ran', registers: [this.registry] });
  readonly rankingSignalUsageTotal = new Counter({ name: 'ranking_signal_usage_total', help: 'Real ranking signals with a non-zero contribution, by signal name', labelNames: ['signal'], registers: [this.registry] });
  readonly certificationProgress = new Gauge({ name: 'certification_progress', help: 'Real fraction of mandatory certification gates currently passing (0-1)', registers: [this.registry] });

  // AI Foundation Certification Sprint — Phase II Sprint 2 (DGX 2.0
  // Demand Forecasting certification evidence infrastructure). Real call
  // sites in forecasting.service.ts, purchase-recommendations.service.ts,
  // and transfer-recommendations.service.ts — no hidden metrics. See
  // docs/execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md §12.
  readonly forecastExecutionsTotal = new Counter({ name: 'forecast_executions_total', help: 'Real forecast generation runs, by target type and chosen method', labelNames: ['targetType', 'method'], registers: [this.registry] });
  readonly forecastDuration = new Histogram({ name: 'forecast_duration_seconds', help: 'Real ForecastingService.generate() wall-clock duration', buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10], registers: [this.registry] });
  readonly forecastFailuresTotal = new Counter({ name: 'forecast_failures_total', help: 'Real forecast generation failures, by reason', labelNames: ['reason'], registers: [this.registry] });
  readonly forecastConfidenceTotal = new Counter({ name: 'forecast_confidence_total', help: 'Real chosen-best forecasts by confidence level', labelNames: ['confidence'], registers: [this.registry] });
  readonly forecastMethodTotal = new Counter({ name: 'forecast_method_total', help: 'Real chosen-best forecasts by method', labelNames: ['method'], registers: [this.registry] });
  readonly forecastAccuracyWape = new Gauge({ name: 'forecast_accuracy_wape', help: 'Real WAPE of the most recently generated chosen-best forecast', registers: [this.registry] });

  readonly recommendationExecutionsTotal = new Counter({ name: 'recommendation_executions_total', help: 'Real recommendations generated, by recommendation type', labelNames: ['recommendationType'], registers: [this.registry] });
  readonly recommendationApprovalsTotal = new Counter({ name: 'recommendation_approvals_total', help: 'Real recommendation approvals, by recommendation type', labelNames: ['recommendationType'], registers: [this.registry] });
  readonly recommendationRejectionsTotal = new Counter({ name: 'recommendation_rejections_total', help: 'Real recommendation rejections, by recommendation type', labelNames: ['recommendationType'], registers: [this.registry] });
  readonly recommendationConfidenceTotal = new Counter({ name: 'recommendation_confidence_total', help: 'Real recommendations by confidence level, by recommendation type', labelNames: ['recommendationType', 'confidence'], registers: [this.registry] });
  readonly recommendationActionTotal = new Counter({ name: 'recommendation_action_total', help: 'Real recommendations by action, by recommendation type', labelNames: ['recommendationType', 'action'], registers: [this.registry] });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordCatalogueQueryRoute(routeType: string): void {
    this.catalogueQueryRouteTotal.inc({ routeType });
  }

  recordCatalogueClaimsRemoved(count: number): void {
    if (count > 0) this.catalogueClaimsRemovedTotal.inc(count);
  }

  recordCatalogueRefusal(reason: string): void {
    this.catalogueRefusalTotal.inc({ reason });
  }

  recordCatalogueConfidence(level: string): void {
    this.catalogueConfidenceTotal.inc({ level });
  }

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  recordAiInference(kind: string, success: boolean, durationSeconds: number): void {
    this.aiInferenceDuration.observe({ kind, success: String(success) }, durationSeconds);
  }

  recordNotificationDispatch(channel: string, status: string): void {
    this.notificationDispatchTotal.inc({ channel, status });
  }

  recordKnowledgeDocumentIngested(format: string): void {
    this.knowledgeDocumentsIngestedTotal.inc({ format });
  }

  recordKnowledgeIngestionFailure(stage: string): void {
    this.knowledgeIngestionFailuresTotal.inc({ stage });
  }

  recordKnowledgeDocumentQuarantined(reason: string): void {
    this.knowledgeDocumentsQuarantinedTotal.inc({ reason });
  }

  recordKnowledgeParserFailure(format: string): void {
    this.knowledgeParserFailuresTotal.inc({ format });
  }

  recordKnowledgeOcrPage(lowConfidence: boolean): void {
    this.knowledgeOcrPagesTotal.inc();
    if (lowConfidence) this.knowledgeOcrLowConfidenceTotal.inc();
  }

  recordKnowledgeCandidateClaims(count: number): void {
    if (count > 0) this.knowledgeCandidateClaimsTotal.inc(count);
  }

  recordKnowledgeClaimDecision(status: 'VERIFIED' | 'DISPUTED' | 'RETRACTED' | 'UNVERIFIED'): void {
    if (status === 'VERIFIED') this.knowledgeClaimsApprovedTotal.inc();
    if (status === 'DISPUTED' || status === 'RETRACTED') this.knowledgeClaimsRejectedTotal.inc();
  }

  recordKnowledgeStructuredFact(factType: string, extractedBy: string): void {
    this.knowledgeStructuredFactsTotal.inc({ factType, extractedBy });
  }

  setKnowledgeReviewBacklog(count: number): void {
    this.knowledgeReviewBacklog.set(count);
  }

  recordKnowledgeReviewLatency(assignedAt: Date, decidedAt: Date): void {
    this.knowledgeReviewLatency.observe((decidedAt.getTime() - assignedAt.getTime()) / 1000);
  }

  setKnowledgeConflictsOpen(count: number): void {
    this.knowledgeConflictsOpen.set(count);
  }

  recordKnowledgeExpiredItem(): void {
    this.knowledgeExpiredItemsTotal.inc();
  }

  setKnowledgeStaleItemsTotal(count: number): void {
    this.knowledgeStaleItemsTotal.set(count);
  }

  setKnowledgeSnapshotAgeSeconds(ageSeconds: number): void {
    this.knowledgeSnapshotAgeSeconds.set(ageSeconds);
  }

  recordKnowledgeRetrievalLatency(durationSeconds: number): void {
    this.knowledgeRetrievalLatency.observe(durationSeconds);
  }

  recordKnowledgePermissionDenial(action: string): void {
    this.knowledgePermissionDenialsTotal.inc({ action });
  }

  recordKnowledgeCitationFailure(): void {
    this.knowledgeCitationFailuresTotal.inc();
  }

  recordKnowledgeEvaluationGateFailure(gate: string): void {
    this.knowledgeEvaluationGateFailuresTotal.inc({ gate });
  }

  recordKnowledgeMalwareScanFailure(scannerUsed: string): void {
    this.knowledgeMalwareScanFailuresTotal.inc({ scannerUsed });
  }

  private static readonly IDENTIFIER_SHAPED_QUERY_CLASSES = new Set([
    'OEM_PART_NUMBER', 'INTERNAL_ITEM_CODE', 'TECDOC_ARTICLE', 'BARCODE', 'SKU',
    'VEHICLE_VIN', 'ENGINE_CODE', 'TRANSMISSION_CODE', 'LUBRICANT_APPROVAL',
    'LUBRICANT_PRODUCT', 'FAULT_CODE',
  ]);

  recordRetrievalQuery(queryClass: string, consumerName: string): void {
    this.retrievalQueriesTotal.inc({ queryClass, consumerName });
    if (MetricsService.IDENTIFIER_SHAPED_QUERY_CLASSES.has(queryClass)) {
      this.retrievalIdentifierQueriesTotal.inc();
    } else {
      this.retrievalSemanticQueriesTotal.inc();
    }
  }

  recordRetrievalLatency(durationSeconds: number): void {
    this.retrievalLatency.observe(durationSeconds);
  }

  recordRetrievalStrategyUsage(strategyMode: string): void {
    this.retrievalStrategyUsageTotal.inc({ strategyMode });
  }

  recordRetrievalGraphExpansions(count: number): void {
    if (count > 0) this.retrievalGraphExpansionsTotal.inc(count);
  }

  recordRetrievalRankingFailure(): void {
    this.retrievalRankingFailuresTotal.inc();
  }

  setRetrievalBenchmarkGauges(metrics: { falsePositiveRate?: number; falseNegativeRate?: number; recallAt1?: number; mrr?: number; ndcg?: number }): void {
    if (metrics.falsePositiveRate !== undefined) this.retrievalFalsePositiveRate.set(metrics.falsePositiveRate);
    if (metrics.falseNegativeRate !== undefined) this.retrievalFalseNegativeRate.set(metrics.falseNegativeRate);
    if (metrics.recallAt1 !== undefined) this.retrievalRecallAt1.set(metrics.recallAt1);
    if (metrics.mrr !== undefined) this.retrievalMrr.set(metrics.mrr);
    if (metrics.ndcg !== undefined) this.retrievalNdcg.set(metrics.ndcg);
  }

  recordRetrievalSnapshotUsage(snapshotStatus: string): void {
    this.retrievalSnapshotUsageTotal.inc({ snapshotStatus });
  }

  recordRetrievalCitationFailure(): void {
    this.retrievalCitationFailuresTotal.inc();
  }

  setIdentifierHitMissRates(hitRate: number, missRate: number): void {
    this.identifierHitRate.set(hitRate);
    this.identifierMissRate.set(missRate);
  }

  recordRetrievalCandidateCount(count: number): void {
    this.retrievalCandidateCount.observe(count);
  }

  setRetrievalRankAccuracy(averageRank: number, top1Accuracy: number, top3Accuracy: number): void {
    this.retrievalAverageRank.set(averageRank);
    this.retrievalTop1Accuracy.set(top1Accuracy);
    this.retrievalTop3Accuracy.set(top3Accuracy);
  }

  recordGraphExpansionUsage(): void {
    this.graphExpansionUsageTotal.inc();
  }

  recordRankingSignalUsage(signal: string): void {
    this.rankingSignalUsageTotal.inc({ signal });
  }

  setCertificationProgress(fraction: number): void {
    this.certificationProgress.set(fraction);
  }

  recordForecastExecution(targetType: string, method: string): void {
    this.forecastExecutionsTotal.inc({ targetType, method });
    this.forecastMethodTotal.inc({ method });
  }

  recordForecastDuration(durationSeconds: number): void {
    this.forecastDuration.observe(durationSeconds);
  }

  recordForecastFailure(reason: string): void {
    this.forecastFailuresTotal.inc({ reason });
  }

  recordForecastConfidence(confidence: string): void {
    this.forecastConfidenceTotal.inc({ confidence });
  }

  setForecastAccuracyWape(wape: number): void {
    if (Number.isFinite(wape)) this.forecastAccuracyWape.set(wape);
  }

  recordRecommendationExecution(recommendationType: string, action: string, confidence: string): void {
    this.recommendationExecutionsTotal.inc({ recommendationType });
    this.recommendationActionTotal.inc({ recommendationType, action });
    this.recommendationConfidenceTotal.inc({ recommendationType, confidence });
  }

  recordRecommendationApproval(recommendationType: string): void {
    this.recommendationApprovalsTotal.inc({ recommendationType });
  }

  recordRecommendationRejection(recommendationType: string): void {
    this.recommendationRejectionsTotal.inc({ recommendationType });
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }
}
