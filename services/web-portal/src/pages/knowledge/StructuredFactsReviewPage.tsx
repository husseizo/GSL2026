import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface StructuredFact {
  id: string;
  factType: string;
  value: unknown;
  unit: string | null;
  extractedBy: string;
  reviewedAt: string | null;
}

export function StructuredFactsReviewPage() {
  const [itemId, setItemId] = useState('');
  const [facts, setFacts] = useState<StructuredFact[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    try {
      setFacts(await api.get<StructuredFact[]>(`/knowledge/structured-facts/by-item/${encodeURIComponent(itemId)}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function review(factId: string) {
    await api.post(`/knowledge/structured-facts/${factId}/review`, { reviewerId: 'portal-reviewer' });
    load();
  }

  return (
    <div>
      <h1>Structured Facts Review</h1>
      <p>An LLM-assisted or low-confidence-OCR fact stays hidden from AI consumers until reviewed here.</p>
      <form onSubmit={load} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
        <input placeholder="Item id" value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button type="submit">Load facts</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Type</th>
            <th style={headerStyle}>Value</th>
            <th style={headerStyle}>Extracted By</th>
            <th style={headerStyle}>Reviewed</th>
            <th style={headerStyle}></th>
          </tr>
        </thead>
        <tbody>
          {facts.map((f) => (
            <tr key={f.id}>
              <td style={cellStyle}>{f.factType}</td>
              <td style={cellStyle}>{JSON.stringify(f.value)}{f.unit ? ` ${f.unit}` : ''}</td>
              <td style={cellStyle}>{f.extractedBy}</td>
              <td style={cellStyle}>{f.reviewedAt ? new Date(f.reviewedAt).toLocaleString() : 'Not reviewed'}</td>
              <td style={cellStyle}>{!f.reviewedAt && <button onClick={() => review(f.id)}>Mark reviewed</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
