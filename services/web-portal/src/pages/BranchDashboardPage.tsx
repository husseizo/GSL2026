import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface BranchHealth {
  isOnline: boolean;
  latencyMs: number | null;
  queueDepth: number | null;
  pingedAt: string;
}

export function BranchDashboardPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [health, setHealth] = useState<Record<string, BranchHealth | null>>({});
  const [queueDepth, setQueueDepth] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Branch[]>('/branches')
      .then(async (list) => {
        setBranches(list);
        for (const branch of list) {
          try {
            const [h, q] = await Promise.all([
              api.get<BranchHealth | null>(`/branch-gateway/${branch.id}/health`),
              api.get<number>(`/branch-gateway/${branch.id}/queue-depth`),
            ]);
            setHealth((prev) => ({ ...prev, [branch.id]: h }));
            setQueueDepth((prev) => ({ ...prev, [branch.id]: q }));
          } catch {
            // A branch with no health ping/queue data yet is a real, valid
            // state (it just hasn't synced), not an error to surface loudly.
          }
        }
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p style={{ color: 'crimson' }}>Failed to load branches: {error}</p>;

  return (
    <div>
      <h1>Branch Dashboard</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%', marginTop: 16 }}>
        <thead>
          <tr>
            <th style={headerStyle}>Branch</th>
            <th style={headerStyle}>Online</th>
            <th style={headerStyle}>Latency (ms)</th>
            <th style={headerStyle}>Outbox queue depth</th>
            <th style={headerStyle}>Last ping</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((branch) => (
            <tr key={branch.id}>
              <td style={cellStyle}>{branch.name} ({branch.code})</td>
              <td style={cellStyle}>{health[branch.id]?.isOnline ?? '—'}</td>
              <td style={cellStyle}>{health[branch.id]?.latencyMs ?? '—'}</td>
              <td style={cellStyle}>{queueDepth[branch.id] ?? 0}</td>
              <td style={cellStyle}>{health[branch.id]?.pingedAt ? new Date(health[branch.id]!.pingedAt).toLocaleString() : 'never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const headerStyle: React.CSSProperties = { textAlign: 'left', borderBottom: '2px solid #ddd', padding: '8px 12px' };
const cellStyle: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px 12px' };
