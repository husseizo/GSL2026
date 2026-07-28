import { MetricsService } from './metrics.service';

describe('MetricsService (real prom-client registry)', () => {
  it('recordHttpRequest produces real Prometheus-format output for the request', async () => {
    const metrics = new MetricsService();
    metrics.recordHttpRequest('GET', '/health', 200, 0.05);

    const text = await metrics.getMetricsText();
    expect(text).toContain('aios_http_requests_total');
    expect(text).toContain('method="GET"');
    expect(text).toContain('route="/health"');
    expect(text).toContain('status="200"');
  });

  it('recordAiInference records a real histogram observation', async () => {
    const metrics = new MetricsService();
    metrics.recordAiInference('GENERATION', true, 2.5);

    const text = await metrics.getMetricsText();
    expect(text).toContain('aios_ai_inference_duration_seconds');
    expect(text).toContain('kind="GENERATION"');
  });

  it('recordNotificationDispatch increments a real counter', async () => {
    const metrics = new MetricsService();
    metrics.recordNotificationDispatch('WEBHOOK', 'SENT');
    metrics.recordNotificationDispatch('WEBHOOK', 'SENT');

    const text = await metrics.getMetricsText();
    const match = text.match(/aios_notification_dispatch_total\{channel="WEBHOOK",status="SENT"\} (\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(2);
  });

  it('includes real Node.js default process metrics (collectDefaultMetrics)', async () => {
    const metrics = new MetricsService();
    const text = await metrics.getMetricsText();
    expect(text).toContain('process_cpu_user_seconds_total');
  });
});

// AI Foundation Certification Sprint — Phase II Sprint 2 (DGX 2.0
// certification evidence infrastructure).
describe('MetricsService — forecast metrics', () => {
  it('recordForecastExecution increments both execution and method counters', async () => {
    const metrics = new MetricsService();
    metrics.recordForecastExecution('PART', 'MOVING_AVERAGE');

    const text = await metrics.getMetricsText();
    expect(text).toMatch(/forecast_executions_total\{targetType="PART",method="MOVING_AVERAGE"\} 1/);
    expect(text).toMatch(/forecast_method_total\{method="MOVING_AVERAGE"\} 1/);
  });

  it('recordForecastDuration records a real histogram observation', async () => {
    const metrics = new MetricsService();
    metrics.recordForecastDuration(1.25);
    const text = await metrics.getMetricsText();
    expect(text).toContain('forecast_duration_seconds');
  });

  it('recordForecastFailure increments the failure counter with a real reason label', async () => {
    const metrics = new MetricsService();
    metrics.recordForecastFailure('NO_HISTORICAL_DATA');
    const text = await metrics.getMetricsText();
    expect(text).toMatch(/forecast_failures_total\{reason="NO_HISTORICAL_DATA"\} 1/);
  });

  it('recordForecastConfidence tracks the real confidence distribution', async () => {
    const metrics = new MetricsService();
    metrics.recordForecastConfidence('HIGH');
    metrics.recordForecastConfidence('HIGH');
    metrics.recordForecastConfidence('LOW');
    const text = await metrics.getMetricsText();
    expect(text).toMatch(/forecast_confidence_total\{confidence="HIGH"\} 2/);
    expect(text).toMatch(/forecast_confidence_total\{confidence="LOW"\} 1/);
  });

  it('setForecastAccuracyWape sets a real gauge value and ignores non-finite input', async () => {
    const metrics = new MetricsService();
    metrics.setForecastAccuracyWape(12.5);
    let text = await metrics.getMetricsText();
    expect(text).toMatch(/forecast_accuracy_wape 12\.5/);

    metrics.setForecastAccuracyWape(NaN);
    text = await metrics.getMetricsText();
    expect(text).toMatch(/forecast_accuracy_wape 12\.5/); // unchanged — NaN never overwrites a real prior value
  });
});

describe('MetricsService — recommendation metrics', () => {
  it('recordRecommendationExecution increments execution, action, and confidence counters together', async () => {
    const metrics = new MetricsService();
    metrics.recordRecommendationExecution('PURCHASE', 'BUY_NOW', 'HIGH');
    const text = await metrics.getMetricsText();
    expect(text).toMatch(/recommendation_executions_total\{recommendationType="PURCHASE"\} 1/);
    expect(text).toMatch(/recommendation_action_total\{recommendationType="PURCHASE",action="BUY_NOW"\} 1/);
    expect(text).toMatch(/recommendation_confidence_total\{recommendationType="PURCHASE",confidence="HIGH"\} 1/);
  });

  it('recordRecommendationApproval and recordRecommendationRejection track real, distinct counters per recommendation type', async () => {
    const metrics = new MetricsService();
    metrics.recordRecommendationApproval('PURCHASE');
    metrics.recordRecommendationApproval('TRANSFER');
    metrics.recordRecommendationRejection('PURCHASE');

    const text = await metrics.getMetricsText();
    expect(text).toMatch(/recommendation_approvals_total\{recommendationType="PURCHASE"\} 1/);
    expect(text).toMatch(/recommendation_approvals_total\{recommendationType="TRANSFER"\} 1/);
    expect(text).toMatch(/recommendation_rejections_total\{recommendationType="PURCHASE"\} 1/);
  });
});
