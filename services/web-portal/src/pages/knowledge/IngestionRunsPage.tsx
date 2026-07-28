import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
}

export function IngestionRunsPage() {
  const [runs, setRuns] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AuditLogEntry[]>('/knowledge/audit/ingestion-runs').then(setRuns).catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div>
      <h1>Ingestion Runs</h1>
      <p>Derived from the real, immutable audit log — every real ingestion action is recorded at its call site.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Action</th>
            <th style={headerStyle}>Entity Type</th>
            <th style={headerStyle}>Entity Id</th>
            <th style={headerStyle}>Occurred At</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td style={cellStyle}>{r.action}</td>
              <td style={cellStyle}>{r.entityType}</td>
              <td style={cellStyle}>{r.entityId}</td>
              <td style={cellStyle}>{new Date(r.occurredAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
