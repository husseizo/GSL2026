import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  afterState: unknown;
  occurredAt: string;
}

export function QuarantineQueuePage() {
  const [events, setEvents] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AuditLogEntry[]>('/knowledge/audit/quarantine').then(setEvents).catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div>
      <h1>Quarantine Queue</h1>
      <p>Real documents blocked at ingestion — injected-instruction patterns or a real malware scan failure. Never silently dropped.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Source</th>
            <th style={headerStyle}>Reason</th>
            <th style={headerStyle}>Occurred At</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td style={cellStyle}>{e.entityId}</td>
              <td style={cellStyle}>{JSON.stringify(e.afterState)}</td>
              <td style={cellStyle}>{new Date(e.occurredAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
