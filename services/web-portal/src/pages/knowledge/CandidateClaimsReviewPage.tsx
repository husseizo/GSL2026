import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface KnowledgeClaim {
  id: string;
  claimText: string;
  claimType: string;
  evidenceQuote: string;
  verificationStatus: string;
}

export function CandidateClaimsReviewPage() {
  const [itemId, setItemId] = useState('');
  const [claims, setClaims] = useState<KnowledgeClaim[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    try {
      setClaims(await api.get<KnowledgeClaim[]>(`/knowledge/claims/by-item/${encodeURIComponent(itemId)}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function verify(claimId: string, status: 'VERIFIED' | 'DISPUTED') {
    await api.post(`/knowledge/claims/${claimId}/verify`, { verifierId: 'portal-reviewer', status });
    load();
  }

  return (
    <div>
      <h1>Candidate Claims Review</h1>
      <form onSubmit={load} style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
        <input placeholder="Item id" value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button type="submit">Load claims</button>
      </form>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Claim</th>
            <th style={headerStyle}>Type</th>
            <th style={headerStyle}>Evidence</th>
            <th style={headerStyle}>Status</th>
            <th style={headerStyle}></th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id}>
              <td style={cellStyle}>{c.claimText}</td>
              <td style={cellStyle}>{c.claimType}</td>
              <td style={cellStyle}>{c.evidenceQuote}</td>
              <td style={cellStyle}>{c.verificationStatus}</td>
              <td style={cellStyle}>
                <button onClick={() => verify(c.id, 'VERIFIED')}>Verify</button>{' '}
                <button onClick={() => verify(c.id, 'DISPUTED')}>Dispute</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
