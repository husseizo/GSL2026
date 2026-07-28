import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface AiConsumerResult {
  retrievedItemIds: string[];
  citations: { itemId: string; versionId: string; title: string; source: string; authorityLevel: string }[];
  conflicts: string[];
  exclusions: { itemId: string; reason: string }[];
  confidence: number;
}

export function PublishedKnowledgeSearchPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AiConsumerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setResult(await api.post<AiConsumerResult>('/knowledge/search', { consumerName: 'portal', consumerVersion: '1.0', purpose: 'portal search', query }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <h1>Published Knowledge Search</h1>
      <p>Real, strict AI-consumer retrieval — expired, restricted, and unapproved content are excluded deterministically.</p>
      <form onSubmit={search} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
        <input placeholder="Search query" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button type="submit">Search</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {result && (
        <>
          <p style={{ marginTop: 16 }}>
            Confidence: {result.confidence.toFixed(2)} · {result.conflicts.length} open conflict(s) · {result.exclusions.length} exclusion(s)
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={headerStyle}>Title</th>
                <th style={headerStyle}>Source</th>
                <th style={headerStyle}>Authority</th>
              </tr>
            </thead>
            <tbody>
              {result.citations.map((c) => (
                <tr key={c.versionId}>
                  <td style={cellStyle}>{c.title}</td>
                  <td style={cellStyle}>{c.source}</td>
                  <td style={cellStyle}>{c.authorityLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
