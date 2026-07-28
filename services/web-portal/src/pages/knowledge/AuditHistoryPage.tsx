import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  occurredAt: string;
}

export function AuditHistoryPage() {
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    try {
      const params = new URLSearchParams();
      if (entityType) params.set('entityType', entityType);
      if (entityId) params.set('entityId', entityId);
      setEntries(await api.get<AuditLogEntry[]>(`/knowledge/audit/history?${params.toString()}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <h1>Audit History</h1>
      <p>Every real Knowledge Platform governance decision — scoped to Knowledge Platform entities, backed by the existing immutable audit log.</p>
      <form onSubmit={load} style={{ display: 'flex', gap: 8, maxWidth: 640 }}>
        <input placeholder="Entity type (optional)" value={entityType} onChange={(e) => setEntityType(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <input placeholder="Entity id (optional)" value={entityId} onChange={(e) => setEntityId(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button type="submit">Load</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Action</th>
            <th style={headerStyle}>Entity Type</th>
            <th style={headerStyle}>Entity Id</th>
            <th style={headerStyle}>Actor</th>
            <th style={headerStyle}>Occurred At</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td style={cellStyle}>{entry.action}</td>
              <td style={cellStyle}>{entry.entityType}</td>
              <td style={cellStyle}>{entry.entityId}</td>
              <td style={cellStyle}>{entry.actorId ?? '—'}</td>
              <td style={cellStyle}>{new Date(entry.occurredAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
