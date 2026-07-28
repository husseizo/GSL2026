import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/client';

interface KnowledgeItemVersion {
  id: string;
  version: number;
  title: string;
  rawContent: string;
  status: string;
  authorityLevel: string;
  createdAt: string;
}

export function DocumentViewerPage() {
  const [itemKey, setItemKey] = useState('');
  const [versions, setVersions] = useState<KnowledgeItemVersion[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.get<KnowledgeItemVersion[]>(`/knowledge/items/${encodeURIComponent(itemKey)}/versions`);
      setVersions(result);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <h1>Document Viewer</h1>
      <p>Enter a real Knowledge Item key to view its full real, append-only version history.</p>
      <form onSubmit={handleLookup} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
        <input placeholder="Item key" value={itemKey} onChange={(e) => setItemKey(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button type="submit">Look up</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {versions.map((v) => (
        <div key={v.id} style={{ marginTop: 24, border: '1px solid #ddd', padding: 16 }}>
          <h3>
            v{v.version} — {v.title} ({v.status})
          </h3>
          <p style={{ color: '#666' }}>Authority: {v.authorityLevel} · Created: {new Date(v.createdAt).toLocaleString()}</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 12 }}>{v.rawContent}</pre>
        </div>
      ))}
    </div>
  );
}
