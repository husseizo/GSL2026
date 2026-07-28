// Pure version/timestamp comparison — the same "detect, don't silently
// overwrite" principle as Phase 2's ledger corrections and Phase 5's CDC
// conflict flagging, applied to branch-gateway message delivery: if a
// branch reports back that its local record changed independently after
// headquarters last saw it, that's a genuine conflict to surface, not to
// resolve by guessing which side wins. See docs/architecture/branch-gateway.md.
export interface ConflictCheckResult {
  hasConflict: boolean;
  reason?: string;
}

export function detectVersionConflict(localVersion: number, remoteVersion: number, expectedVersion: number): ConflictCheckResult {
  if (remoteVersion !== expectedVersion) {
    return {
      hasConflict: true,
      reason: `Remote reported version ${remoteVersion}, but headquarters expected version ${expectedVersion} (local: ${localVersion}) — the branch's copy diverged independently`,
    };
  }
  return { hasConflict: false };
}

export type ConflictResolutionStrategy = 'HEADQUARTERS_WINS' | 'BRANCH_WINS' | 'MANUAL_REVIEW';

// The default strategy is MANUAL_REVIEW — a rule-based system has no
// principled way to know which side's change is "correct" for an arbitrary
// business record, so the honest default is to surface it for a human
// rather than silently picking a winner. HEADQUARTERS_WINS/BRANCH_WINS are
// available for record types where an operator has explicitly decided one
// side is authoritative.
export function resolveConflict(strategy: ConflictResolutionStrategy, headquartersValue: unknown, branchValue: unknown): unknown {
  switch (strategy) {
    case 'HEADQUARTERS_WINS':
      return headquartersValue;
    case 'BRANCH_WINS':
      return branchValue;
    case 'MANUAL_REVIEW':
    default:
      return null;
  }
}
