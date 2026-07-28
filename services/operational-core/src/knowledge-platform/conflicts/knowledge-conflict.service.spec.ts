import { detectConflicts, detectApprovalStatusConflicts, ClaimForComparison } from './knowledge-conflict.service';

const baseClaim: ClaimForComparison = { id: '', claimType: 'torque_value', claimText: '', authorityLevel: 'OEM_OFFICIAL', effectiveFrom: null, effectiveUntil: null };

describe('detectConflicts', () => {
  it('flags a real value mismatch between two claims of the same type', () => {
    const claims: ClaimForComparison[] = [
      { ...baseClaim, id: 'a', claimText: 'Torque to 45 Nm' },
      { ...baseClaim, id: 'b', claimText: 'Torque to 60 Nm' },
    ];
    const conflicts = detectConflicts(claims);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe('VALUE_MISMATCH');
    expect(conflicts[0].severity).toBe('HIGH');
  });

  it('never flags claims of different types against each other', () => {
    const claims: ClaimForComparison[] = [
      { ...baseClaim, id: 'a', claimType: 'torque_value', claimText: 'Torque to 45 Nm' },
      { ...baseClaim, id: 'b', claimType: 'fluid_specification', claimText: 'Fill 4.5 L' },
    ];
    expect(detectConflicts(claims)).toHaveLength(0);
  });

  it('flags an authority mismatch when values agree but authority differs', () => {
    const claims: ClaimForComparison[] = [
      { ...baseClaim, id: 'a', authorityLevel: 'OEM_OFFICIAL', claimText: 'Torque to 45 Nm' },
      { ...baseClaim, id: 'b', authorityLevel: 'COMMUNITY_SOURCED', claimText: 'Torque to 45 Nm' },
    ];
    const conflicts = detectConflicts(claims);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe('AUTHORITY_MISMATCH');
  });

  it('never flags identical claims from the same authority as conflicting', () => {
    const claims: ClaimForComparison[] = [
      { ...baseClaim, id: 'a', claimText: 'Torque to 45 Nm' },
      { ...baseClaim, id: 'b', claimText: 'Torque to 45 Nm' },
    ];
    expect(detectConflicts(claims)).toHaveLength(0);
  });
});

describe('detectApprovalStatusConflicts', () => {
  const approvalClaim = { ...baseClaim, claimType: 'approval_statement' };

  it('flags a real conflict when one source claims official approval and another only a recommendation for the same product', () => {
    const claims: ClaimForComparison[] = [
      { ...approvalClaim, id: 'a', claimText: 'This lubricant has official approval for this engine.' },
      { ...approvalClaim, id: 'b', claimText: 'This lubricant is recommended for this engine.' },
    ];
    const conflicts = detectApprovalStatusConflicts(claims);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].conflictType).toBe('APPROVAL_STATUS_MISMATCH');
    expect(conflicts[0].severity).toBe('HIGH');
  });

  it('never flags two claims that agree on approval status', () => {
    const claims: ClaimForComparison[] = [
      { ...approvalClaim, id: 'a', claimText: 'This lubricant has official approval for this engine.' },
      { ...approvalClaim, id: 'b', claimText: 'This lubricant has official approval for this transmission too.' },
    ];
    expect(detectApprovalStatusConflicts(claims)).toHaveLength(0);
  });

  it('never runs against non-approval claim types', () => {
    const claims: ClaimForComparison[] = [
      { ...baseClaim, id: 'a', claimType: 'torque_value', claimText: 'Approved to 45 Nm.' },
      { ...baseClaim, id: 'b', claimType: 'torque_value', claimText: 'Recommended at 60 Nm.' },
    ];
    expect(detectApprovalStatusConflicts(claims)).toHaveLength(0);
  });
});
