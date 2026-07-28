import { detectVersionConflict, resolveConflict } from './conflict-detection';

describe('detectVersionConflict', () => {
  it('reports no conflict when the remote version matches what headquarters expected', () => {
    expect(detectVersionConflict(5, 5, 5).hasConflict).toBe(false);
  });

  it('reports a conflict when the remote version diverged from the expected version', () => {
    const result = detectVersionConflict(5, 7, 5);
    expect(result.hasConflict).toBe(true);
    expect(result.reason).toContain('diverged independently');
  });
});

describe('resolveConflict', () => {
  it('HEADQUARTERS_WINS returns the headquarters value', () => {
    expect(resolveConflict('HEADQUARTERS_WINS', 'hq-value', 'branch-value')).toBe('hq-value');
  });

  it('BRANCH_WINS returns the branch value', () => {
    expect(resolveConflict('BRANCH_WINS', 'hq-value', 'branch-value')).toBe('branch-value');
  });

  it('MANUAL_REVIEW returns null — no automatic winner is picked', () => {
    expect(resolveConflict('MANUAL_REVIEW', 'hq-value', 'branch-value')).toBeNull();
  });
});
