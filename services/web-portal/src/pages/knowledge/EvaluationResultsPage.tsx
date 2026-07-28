import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface BenchmarkRun {
  id: string;
  status: string;
  casesEvaluated: number;
  casesExcluded: number;
  gateStatus: string | null;
  startedAt: string;
  benchmark: { name: string; category: string };
}

export function EvaluationResultsPage() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<BenchmarkRun[]>('/knowledge/evaluation-results').then(setRuns).catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div>
      <h1>Evaluation Results</h1>
      <p>Real KNOWLEDGE-category benchmark runs from the existing Automotive AI Evaluation Framework (DGX Prototype 1.6) — never rebuilt here.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Benchmark</th>
            <th style={headerStyle}>Status</th>
            <th style={headerStyle}>Cases Evaluated</th>
            <th style={headerStyle}>Gate Status</th>
            <th style={headerStyle}>Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td style={cellStyle}>{r.benchmark.name}</td>
              <td style={cellStyle}>{r.status}</td>
              <td style={cellStyle}>{r.casesEvaluated} ({r.casesExcluded} excluded)</td>
              <td style={cellStyle}>{r.gateStatus ?? '—'}</td>
              <td style={cellStyle}>{new Date(r.startedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
