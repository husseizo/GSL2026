import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface KnowledgeSource {
  id: string;
  name: string;
  authority: string;
  status: string;
  accessClassification: string | null;
  allowedAiUse: boolean;
}

export function SourceRegistryPage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<KnowledgeSource[]>('/knowledge/sources').then(setSources).catch((err) => setError((err as Error).message));
  }

  useEffect(load, []);

  return (
    <div>
      <h1>Knowledge Source Registry</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Name</th>
            <th style={headerStyle}>Authority</th>
            <th style={headerStyle}>Status</th>
            <th style={headerStyle}>Access Classification</th>
            <th style={headerStyle}>AI Use Allowed</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td style={cellStyle}>{s.name}</td>
              <td style={cellStyle}>{s.authority}</td>
              <td style={cellStyle}>{s.status}</td>
              <td style={cellStyle}>{s.accessClassification ?? '—'}</td>
              <td style={cellStyle}>{s.allowedAiUse ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const tableStyle: React.CSSProperties = { borderCollapse: 'collapse', width: '100%', marginTop: 16 };
export const headerStyle: React.CSSProperties = { textAlign: 'left', borderBottom: '2px solid #ddd', padding: '8px 12px' };
export const cellStyle: React.CSSProperties = { borderBottom: '1px solid #eee', padding: '8px 12px' };
