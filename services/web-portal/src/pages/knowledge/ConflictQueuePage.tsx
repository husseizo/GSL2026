import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface KnowledgeConflict {
  id: string;
  conflictType: string;
  severity: string;
  status: string;
  detectedAt: string;
}

export function ConflictQueuePage() {
  const [conflicts, setConflicts] = useState<KnowledgeConflict[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<KnowledgeConflict[]>('/knowledge/conflicts').then(setConflicts).catch((err) => setError((err as Error).message));
  }

  useEffect(load, []);

  async function resolve(id: string) {
    const note = window.prompt('Resolution note:');
    if (note === null) return;
    await api.post(`/knowledge/conflicts/${id}/resolve`, { resolverId: 'portal-reviewer', status: 'RESOLVED_KEEP_A', resolutionNote: note });
    load();
  }

  return (
    <div>
      <h1>Conflict Queue</h1>
      <p>Every real conflict is preserved and surfaced — never silently resolved by picking whichever claim was retrieved first.</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Type</th>
            <th style={headerStyle}>Severity</th>
            <th style={headerStyle}>Status</th>
            <th style={headerStyle}>Detected</th>
            <th style={headerStyle}></th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((c) => (
            <tr key={c.id}>
              <td style={cellStyle}>{c.conflictType}</td>
              <td style={cellStyle}>{c.severity}</td>
              <td style={cellStyle}>{c.status}</td>
              <td style={cellStyle}>{new Date(c.detectedAt).toLocaleString()}</td>
              <td style={cellStyle}>
                <button onClick={() => resolve(c.id)}>Resolve</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
