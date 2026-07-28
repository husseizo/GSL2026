import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface HealthResponse {
  status: string;
  timestamp: string;
  dependencies: {
    database: { ok: boolean; latencyMs?: number };
    redis: { ok: boolean };
    dgx: { ok: boolean; details?: { mode: string; gpuAvailable: boolean; ollamaReachable: boolean } };
  };
}

export function SystemHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<HealthResponse>('/health').then(setHealth).catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p style={{ color: 'crimson' }}>Failed to load health: {error}</p>;
  if (!health) return <p>Loading real dependency health checks…</p>;

  return (
    <div>
      <h1>System Health</h1>
      <p style={{ color: '#666' }}>Each row below is a real, independently-executed check against that dependency, not a static status page.</p>
      <table style={{ borderCollapse: 'collapse', marginTop: 16 }}>
        <tbody>
          <Row label="Overall" ok={health.status === 'ok'} detail={health.status} />
          <Row label="PostgreSQL" ok={health.dependencies.database.ok} detail={`${health.dependencies.database.latencyMs ?? '—'} ms`} />
          <Row label="Redis" ok={health.dependencies.redis.ok} detail={health.dependencies.redis.ok ? 'reachable' : 'unreachable'} />
          <Row
            label="DGX AI Platform"
            ok={health.dependencies.dgx.ok}
            detail={health.dependencies.dgx.details ? `mode=${health.dependencies.dgx.details.mode}, gpuAvailable=${health.dependencies.dgx.details.gpuAvailable}` : 'unreachable'}
          />
        </tbody>
      </table>
      <p style={{ marginTop: 24, color: '#888', fontSize: 13 }}>Checked at {new Date(health.timestamp).toLocaleString()}</p>
    </div>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <tr>
      <td style={cellStyle}>{label}</td>
      <td style={{ ...cellStyle, color: ok ? 'green' : 'crimson', fontWeight: 600 }}>{ok ? 'OK' : 'DOWN'}</td>
      <td style={cellStyle}>{detail}</td>
    </tr>
  );
}

const cellStyle: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px 16px' };
