import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface WorkshopDashboard {
  vehiclesInWorkshop: number;
  jobsByStatus: Record<string, number>;
  jobsWaitingParts: number;
  jobsWaitingApproval: number;
  warrantyJobs: number;
  repeatRepairFlags: number;
  inspectionFailures: number;
}

export function ExecutiveDashboardPage() {
  const [dashboard, setDashboard] = useState<WorkshopDashboard | null>(null);
  const [deadStockCount, setDeadStockCount] = useState<number | null>(null);
  const [pendingRecommendations, setPendingRecommendations] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<WorkshopDashboard>('/workshop-analytics/dashboard'),
      api.get<unknown[]>('/inventory-analytics/classification?movementClass=DEAD_STOCK'),
      api.get<unknown[]>('/purchase-recommendations?status=PENDING'),
    ])
      .then(([dash, deadStock, recs]) => {
        setDashboard(dash);
        setDeadStockCount(deadStock.length);
        setPendingRecommendations(recs.length);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  if (error) return <p style={{ color: 'crimson' }}>Failed to load dashboard: {error}</p>;
  if (!dashboard) return <p>Loading real data from the operational core…</p>;

  return (
    <div>
      <h1>Executive Dashboard</h1>
      <p style={{ color: '#666' }}>Every figure below is a real, live query against the Operational Core — nothing here is sample data.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
        <Tile label="Vehicles in workshop" value={dashboard.vehiclesInWorkshop} />
        <Tile label="Jobs waiting on parts" value={dashboard.jobsWaitingParts} />
        <Tile label="Jobs waiting on approval" value={dashboard.jobsWaitingApproval} />
        <Tile label="Warranty jobs" value={dashboard.warrantyJobs} />
        <Tile label="Repeat-repair flags" value={dashboard.repeatRepairFlags} />
        <Tile label="Inspection failures" value={dashboard.inspectionFailures} />
        <Tile label="Dead-stock items" value={deadStockCount ?? '—'} />
        <Tile label="Pending purchase recommendations" value={pendingRecommendations ?? '—'} />
      </div>

      <h2 style={{ marginTop: 32 }}>Jobs by status</h2>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {Object.entries(dashboard.jobsByStatus).map(([status, count]) => (
            <tr key={status}>
              <td style={cellStyle}>{status}</td>
              <td style={cellStyle}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#666', fontSize: 13 }}>{label}</div>
    </div>
  );
}

const cellStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '4px 12px' };
