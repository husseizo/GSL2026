import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface KnowledgeSnapshot {
  id: string;
  versionNumber: number;
  status: string;
  itemVersionsIncluded: number;
  checksum: string | null;
  activatedAt: string | null;
  evaluationMetrics: { trustedKnowledgeGates?: { allPass: boolean } } | null;
}

export function SnapshotStatusPage() {
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<KnowledgeSnapshot>('/knowledge/snapshots/active').then(setSnapshot).catch((err) => setError((err as Error).message));
  }, []);

  return (
    <div>
      <h1>Snapshot Status</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {snapshot ? (
        <div style={{ marginTop: 16, border: '1px solid #ddd', padding: 16, maxWidth: 480 }}>
          <p><strong>Version:</strong> {snapshot.versionNumber}</p>
          <p><strong>Status:</strong> {snapshot.status}</p>
          <p><strong>Real published item versions included:</strong> {snapshot.itemVersionsIncluded}</p>
          <p><strong>Checksum:</strong> {snapshot.checksum ?? '—'}</p>
          <p><strong>Activated:</strong> {snapshot.activatedAt ? new Date(snapshot.activatedAt).toLocaleString() : '—'}</p>
          <p><strong>Trusted-knowledge gates:</strong> {snapshot.evaluationMetrics?.trustedKnowledgeGates ? (snapshot.evaluationMetrics.trustedKnowledgeGates.allPass ? 'All passed' : 'One or more FAILED') : 'Not yet evaluated'}</p>
        </div>
      ) : (
        !error && <p>No active snapshot.</p>
      )}
    </div>
  );
}
