// DGX Prototype 1.6 — self-contained static HTML report (spec §22
// "Dashboards"). No Grafana instance exists in this environment (see
// docs/ai-evaluation/leaderboard.md) — this is the real, reproducible
// dashboard deliverable instead: pure function, zero external/CDN
// references, inline CSS, opens correctly from a plain file:// path.
import { DashboardData } from './dashboard-data';

function escapeHtml(value: unknown): string {
  return String(value ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function sparkline(values: number[], width = 200, height = 40): string {
  if (values.length === 0) return '<span style="color:#888">no data</span>';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible"><polyline points="${points}" fill="none" stroke="#4f7df2" stroke-width="2"/></svg>`;
}

function section(title: string, body: string): string {
  return `<section class="panel"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '<p class="empty">No real data yet for this section.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Pure — the entire report is one function of DashboardData, so rerunning
// this against the same DB state produces byte-identical output.
export function generateDashboardHtml(data: DashboardData): string {
  const aiQualityRows = data.aiQuality.map((c) => [escapeHtml(c.category), escapeHtml(c.casesEvaluated), fmtDate(c.runAt), `<pre class="metrics">${escapeHtml(JSON.stringify(c.latestMetrics ?? {}, null, 0))}</pre>`]);

  const retrievalValues = data.retrieval.map((r) => (typeof r.recallAt1 === 'number' ? r.recallAt1 : 0)).reverse();
  const generationValues = data.generation.map((r) => (typeof r.avgGroundedness === 'number' ? r.avgGroundedness : 0)).reverse();

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>AI Evaluation Dashboard — DGX Prototype 1.6</title>
<style>
  :root { color-scheme: light dark; --accent: #4f7df2; --bg: #ffffff; --fg: #1a1a2e; --panel: #f7f8fc; --border: #e2e5ef; }
  @media (prefers-color-scheme: dark) { :root { --bg: #14151f; --fg: #e8e9f2; --panel: #1c1e2b; --border: #2e3142; } }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2rem; background: var(--bg); color: var(--fg); font-family: -apple-system, Segoe UI, Roboto, sans-serif; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  .subtitle { color: #888; margin: 0 0 2rem; font-size: 0.9rem; }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; }
  .panel h2 { margin: 0 0 1rem; font-size: 1.1rem; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: #888; font-weight: 600; }
  pre.metrics { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 0.75rem; max-width: 40ch; }
  .empty { color: #888; font-style: italic; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>AI Evaluation Dashboard</h1>
<p class="subtitle">DGX Prototype 1.6 — generated ${escapeHtml(data.generatedAt)}. Every number below is a real query against BenchmarkRun/PromptExperiment/AiFeedback rows — nothing here is simulated.</p>

${section('AI Quality (one row per category — never blended)', table(['Category', 'Cases evaluated', 'Last run', 'Latest metrics'], aiQualityRows))}

<div class="grid-2">
${section('Retrieval trend (recallAt1)', sparkline(retrievalValues))}
${section('Generation trend (avgGroundedness)', sparkline(generationValues))}
</div>

${section(
  'Retrieval',
  table(
    ['Run', 'recallAt1', 'Run at'],
    data.retrieval.map((r) => [escapeHtml(r.runId.slice(0, 8)), escapeHtml(r.recallAt1), fmtDate(r.runAt)]),
  ),
)}

${section(
  'Generation',
  table(
    ['Run', 'avgGroundedness', 'citation.correctness', 'Run at'],
    data.generation.map((r) => [escapeHtml(r.runId.slice(0, 8)), escapeHtml(r.avgGroundedness), escapeHtml(r.citationCorrectness), fmtDate(r.runAt)]),
  ),
)}

${section(
  'Safety',
  table(
    ['Run', 'refusalAccuracy', 'Run at'],
    data.safety.map((r) => [escapeHtml(r.runId.slice(0, 8)), escapeHtml(r.refusalAccuracy), fmtDate(r.runAt)]),
  ),
)}

${section(
  'Latency',
  table(
    ['Run', 'deterministic P95 (ms)', 'generative P95 (ms)', 'Run at'],
    data.latency.map((r) => [escapeHtml(r.runId.slice(0, 8)), escapeHtml(r.deterministicP95Ms), escapeHtml(r.generativeP95Ms), fmtDate(r.runAt)]),
  ),
)}

${section(
  'Experiments',
  table(
    ['Name', 'Status', 'Arms', 'Winner arm'],
    data.experiments.map((e) => [escapeHtml(e.name), escapeHtml(e.status), escapeHtml(e.armCount), escapeHtml(e.winnerArmId?.slice(0, 8) ?? 'not decided')]),
  ),
)}

${section(
  'Benchmark trends (run counts over time, per category)',
  table(
    ['Category', 'Run count', 'First run', 'Last run'],
    data.benchmarkTrends.map((t) => [escapeHtml(t.category), escapeHtml(t.runCount), fmtDate(t.firstRunAt), fmtDate(t.lastRunAt)]),
  ),
)}

${section(
  'Regression history',
  table(
    ['Run', 'Benchmark', 'Regressed?', 'Started at'],
    data.regressionHistory.map((r) => [escapeHtml(r.runId.slice(0, 8)), escapeHtml(r.benchmarkKey), r.regressed ? '<strong style="color:#d64545">YES</strong>' : 'no', fmtDate(r.startedAt)]),
  ),
)}

${section(
  'Pilot quality (real human feedback, production)',
  `<p>Acceptance rate: <strong>${data.pilotQuality.acceptanceRatePct !== null ? data.pilotQuality.acceptanceRatePct + '%' : 'no feedback recorded yet'}</strong> across ${escapeHtml(data.pilotQuality.totalFeedback)} real AiFeedback rows.</p>`,
)}

</body>
</html>
`;
}
