import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { tableStyle, headerStyle, cellStyle } from './SourceRegistryPage';

interface KnowledgeReviewAssignment {
  id: string;
  reviewerRole: string;
  assignedToId: string | null;
  isHighRisk: boolean;
  requiresDualReview: boolean;
  assignedAt: string;
  version: { title: string; item: { key: string } };
}

export function ApprovalQueuePage() {
  const [queue, setQueue] = useState<KnowledgeReviewAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<KnowledgeReviewAssignment[]>('/knowledge/review/queue').then(setQueue).catch((err) => setError((err as Error).message));
  }

  useEffect(load, []);

  async function decide(id: string, decision: 'APPROVE' | 'REJECT') {
    await api.post(`/knowledge/review/assignments/${id}/decide`, { decision, decisionNote: `Decided ${decision} via portal`, actorId: 'portal-reviewer' });
    load();
  }

  return (
    <div>
      <h1>Approval Queue</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Item</th>
            <th style={headerStyle}>Reviewer Role</th>
            <th style={headerStyle}>High Risk</th>
            <th style={headerStyle}>Dual Review</th>
            <th style={headerStyle}>Assigned</th>
            <th style={headerStyle}></th>
          </tr>
        </thead>
        <tbody>
          {queue.map((a) => (
            <tr key={a.id}>
              <td style={cellStyle}>{a.version.title} ({a.version.item.key})</td>
              <td style={cellStyle}>{a.reviewerRole}</td>
              <td style={cellStyle}>{a.isHighRisk ? 'Yes' : 'No'}</td>
              <td style={cellStyle}>{a.requiresDualReview ? 'Yes' : 'No'}</td>
              <td style={cellStyle}>{new Date(a.assignedAt).toLocaleString()}</td>
              <td style={cellStyle}>
                <button onClick={() => decide(a.id, 'APPROVE')}>Approve</button>{' '}
                <button onClick={() => decide(a.id, 'REJECT')}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
