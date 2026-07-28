// AI Foundation Certification Sprint — Certification Dashboard (spec §20:
// "official certification view" showing Recall@1/3/5, MRR, nDCG, Identifier
// Accuracy, Latency, Snapshot Status, Current Benchmark Run, Winning
// Configuration, Failed Gates, Regression Status, Trend, Certification
// Readiness). Additive, inside the existing reports/ directory — reuses
// report-generator.ts's exact pattern (pure function of data, inline CSS,
// zero external/CDN references) rather than duplicating a rendering
// framework, per the architecture freeze's scope discipline.
import { CertificationDashboardData } from './certification-data';

function escapeHtml(value: unknown): string {
  return String(value ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(2)}%`;
}

function sparkline(values: number[], width = 240, height = 40): string {
  if (values.length === 0) return '<span class="empty">no data</span>';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];
  const lastX = ((values.length - 1) * step).toFixed(1);
  const lastY = (height - ((last - min) / range) * height).toFixed(1);
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible"><polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="${lastX}" cy="${lastY}" r="3" fill="var(--accent)"/></svg>`;
}

function section(title: string, body: string): string {
  return `<section class="panel"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '<p class="empty">No real data yet for this section.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function pill(status: string): string {
  const color = status === 'PASS' ? '#1f9d55' : status === 'FAIL' ? '#d64545' : status === 'WAIVED' ? '#c98a1f' : '#888';
  return `<span class="pill" style="background:${color}22;color:${color};border:1px solid ${color}55">${escapeHtml(status)}</span>`;
}

// Pure — one function of CertificationDashboardData, so rerunning this
// against the same DB state produces byte-identical output (spec §14:
// "every experiment must be reproducible").
export function generateCertificationDashboardHtml(data: CertificationDashboardData): string {
  const gates = data.latestRun?.gates ?? [];
  const failedGates = gates.filter((g) => g.status === 'FAIL');
  const allPass = gates.length > 0 && gates.every((g) => g.status === 'PASS' || g.status === 'WAIVED');
  const readiness = gates.length === 0 ? 'NOT_READY' : allPass ? 'AI_FOUNDATION_CERTIFIED' : 'NEEDS_MORE_TUNING';
  const readinessColor = readiness === 'AI_FOUNDATION_CERTIFIED' ? '#1f9d55' : readiness === 'NEEDS_MORE_TUNING' ? '#c98a1f' : '#d64545';

  const recallTrend = data.trend.map((t) => t.recallAt1 ?? 0);
  const mrrTrend = data.trend.map((t) => t.mrr ?? 0);
  const identifierTrend = data.trend.map((t) => t.identifierAccuracy ?? 0);

  const gateRows = gates.map((g) => [escapeHtml(g.gate), pill(g.status), escapeHtml(typeof g.actual === 'number' ? (g.actual % 1 === 0 ? g.actual : g.actual.toFixed(4)) : g.actual), escapeHtml(g.threshold), escapeHtml(g.reason)]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>AI Foundation Certification Dashboard</title>
<style>
  :root { color-scheme: light dark; --accent: #4f7df2; --bg: #ffffff; --fg: #1a1a2e; --panel: #f7f8fc; --border: #e2e5ef; --muted: #888; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14151f; --fg: #e8e9f2; --panel: #1c1e2b; --border: #2e3142; --muted: #9a9caa; } }
  :root[data-theme="dark"] { --bg: #14151f; --fg: #e8e9f2; --panel: #1c1e2b; --border: #2e3142; --muted: #9a9caa; }
  :root[data-theme="light"] { --bg: #ffffff; --fg: #1a1a2e; --panel: #f7f8fc; --border: #e2e5ef; --muted: #888; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2rem; background: var(--bg); color: var(--fg); font-family: -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size: 1.6rem; margin: 0 0 0.25rem; }
  .subtitle { color: var(--muted); margin: 0 0 1.5rem; font-size: 0.9rem; }
  .readiness-banner { display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.25rem; border-radius: 10px; font-size: 1.1rem; font-weight: 700; margin-bottom: 1.5rem; }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; }
  .panel h2 { margin: 0 0 1rem; font-size: 1.1rem; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; font-variant-numeric: tabular-nums; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  .empty { color: var(--muted); font-style: italic; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
  @media (max-width: 900px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
  .pill { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
  .stat { font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat-label { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
</style>
</head>
<body>
<h1>AI Foundation Certification Dashboard</h1>
<p class="subtitle">Generated ${escapeHtml(data.generatedAt)}. Every number below is a real query against BenchmarkRun/RetrievalExperiment/KnowledgeSnapshot/RetrievalQueryLog rows for gold benchmark <strong>${escapeHtml(data.goldBenchmarkVersion !== null ? `v${data.goldBenchmarkVersion}` : 'not built yet')}</strong> — nothing here is simulated.</p>

<div class="readiness-banner" style="background:${readinessColor}22;color:${readinessColor};border:1px solid ${readinessColor}55">Certification readiness: ${escapeHtml(readiness)}</div>

${section(
  'Current benchmark run',
  data.latestRun
    ? `<div class="grid-3">
        <div><div class="stat-label">Recall@1</div><div class="stat">${fmtPct(data.latestRun.inputs?.recallAt1 ?? null)}</div></div>
        <div><div class="stat-label">MRR</div><div class="stat">${fmtPct(data.latestRun.inputs?.mrr ?? null)}</div></div>
        <div><div class="stat-label">Identifier accuracy</div><div class="stat">${fmtPct(data.latestRun.inputs?.identifierAccuracy ?? null)}</div></div>
        <div><div class="stat-label">nDCG@5</div><div class="stat">${data.latestRun.inputs?.ndcgAt5 !== null && data.latestRun.inputs?.ndcgAt5 !== undefined ? data.latestRun.inputs.ndcgAt5.toFixed(4) : '—'}</div></div>
        <div><div class="stat-label">p95 latency</div><div class="stat">${data.latestRun.inputs?.p95LatencyMs ?? '—'} ms</div></div>
        <div><div class="stat-label">Cases scored</div><div class="stat">${data.latestRun.casesScored}${data.latestRun.sampleSize ? ` / requested ${data.latestRun.sampleSize}` : ''}</div></div>
      </div>
      <p style="color:var(--muted);font-size:0.85rem;margin-top:1rem">Run ${escapeHtml(data.latestRun.runId.slice(0, 8))} at ${fmtDate(data.latestRun.runAt)} — overall gate status ${pill(data.latestRun.gateStatus ?? 'UNKNOWN')}</p>`
    : '<p class="empty">No real gate-check run has been persisted yet — run scripts/run-real-certification-gate-check.ts.</p>',
)}

${section('Mandatory certification gates (spec §21)', table(['Gate', 'Status', 'Actual', 'Threshold', 'Reason'], gateRows))}

${
  failedGates.length > 0
    ? section('Failed gates (blocking certification)', table(['Gate', 'Status', 'Actual', 'Threshold', 'Reason'], failedGates.map((g) => [escapeHtml(g.gate), pill(g.status), escapeHtml(g.actual), escapeHtml(g.threshold), escapeHtml(g.reason)])))
    : section('Failed gates (blocking certification)', '<p class="empty">None — every mandatory gate is currently PASS or WAIVED.</p>')
}

<div class="grid-3">
${section('Recall@1 trend', sparkline(recallTrend))}
${section('MRR trend', sparkline(mrrTrend))}
${section('Identifier accuracy trend', sparkline(identifierTrend))}
</div>

${section(
  'Benchmark run history',
  table(
    ['Run', 'Run at', 'Sample size', 'Recall@1', 'MRR', 'Identifier accuracy', 'Gate status'],
    data.trend
      .slice()
      .reverse()
      .map((t) => [escapeHtml(t.runId.slice(0, 8)), fmtDate(t.runAt), escapeHtml(t.sampleSize), fmtPct(t.recallAt1), fmtPct(t.mrr), fmtPct(t.identifierAccuracy), pill(t.gateStatus ?? 'UNKNOWN')]),
  ),
)}

${section(
  'Snapshot status',
  data.snapshot
    ? `<p>Snapshot v${escapeHtml(data.snapshot.versionNumber)} (${escapeHtml(data.snapshot.id.slice(0, 8))}) — status ${pill(data.snapshot.status)}. Evaluated: ${fmtDate(data.snapshot.evaluatedAt)}. Activated: ${fmtDate(data.snapshot.activatedAt)}.</p>`
    : '<p class="empty">No real KnowledgeSnapshot exists yet.</p>',
)}

${section(
  'Retrieval Laboratory — recent experiments (spec §14)',
  table(
    ['Experiment', 'Strategy A', 'Strategy B', 'Recorded at'],
    data.experiments.map((e) => [escapeHtml(e.name), escapeHtml(e.strategyModeA), escapeHtml(e.strategyModeB ?? 'n/a'), fmtDate(e.createdAt)]),
  ),
)}

${section(
  'Failure analysis breakdown (spec §15 — every failure classified, never silently removed)',
  table(
    ['Failure type', 'Count'],
    data.failureBreakdown.map((f) => [escapeHtml(f.failureType), escapeHtml(f.count)]),
  ),
)}

${section(
  'Regression history vs. this benchmark\'s own prior runs',
  table(
    ['Run', 'Regressed?', 'Started at'],
    data.regressionHistory.map((r) => [escapeHtml(r.runId.slice(0, 8)), r.regressed ? '<strong style="color:#d64545">YES</strong>' : 'no', fmtDate(r.startedAt)]),
  ),
)}

</body>
</html>
`;
}
