import { Role } from '@prisma/client';
import { isOrgWideRole, isOwner, isWithinScope } from './policy-engine';

describe('isOrgWideRole', () => {
  it('treats GENERAL_MANAGER/OWNER/SYSTEM_ADMINISTRATOR/AUDITOR/READ_ONLY_VIEWER as org-wide', () => {
    expect(isOrgWideRole(Role.GENERAL_MANAGER)).toBe(true);
    expect(isOrgWideRole(Role.OWNER)).toBe(true);
    expect(isOrgWideRole(Role.SYSTEM_ADMINISTRATOR)).toBe(true);
  });

  it('treats BRANCH_MANAGER/TECHNICIAN as branch-scoped, not org-wide', () => {
    expect(isOrgWideRole(Role.BRANCH_MANAGER)).toBe(false);
    expect(isOrgWideRole(Role.TECHNICIAN)).toBe(false);
  });
});

describe('isWithinScope', () => {
  it('always allows an org-wide role regardless of branch mismatch', () => {
    const result = isWithinScope({ actorRole: Role.GENERAL_MANAGER, actorBranchId: 'branch-a' }, { branchId: 'branch-b' });
    expect(result).toBe(true);
  });

  it('allows a branch-scoped actor when the resource branch matches', () => {
    const result = isWithinScope({ actorRole: Role.BRANCH_MANAGER, actorBranchId: 'branch-a' }, { branchId: 'branch-a' });
    expect(result).toBe(true);
  });

  it('denies a branch-scoped actor when the resource branch differs', () => {
    const result = isWithinScope({ actorRole: Role.BRANCH_MANAGER, actorBranchId: 'branch-a' }, { branchId: 'branch-b' });
    expect(result).toBe(false);
  });

  it('denies a branch-scoped actor with no branch at all against a branch-scoped resource', () => {
    const result = isWithinScope({ actorRole: Role.BRANCH_MANAGER }, { branchId: 'branch-a' });
    expect(result).toBe(false);
  });

  it('allows a branch-scoped actor against a resource with no branch specified', () => {
    const result = isWithinScope({ actorRole: Role.BRANCH_MANAGER, actorBranchId: 'branch-a' }, {});
    expect(result).toBe(true);
  });

  it('checks warehouse scope one level below branch', () => {
    const allowed = isWithinScope({ actorRole: Role.STOREKEEPER, actorBranchId: 'branch-a', actorWarehouseId: 'wh-1' }, { branchId: 'branch-a', warehouseId: 'wh-1' });
    const denied = isWithinScope({ actorRole: Role.STOREKEEPER, actorBranchId: 'branch-a', actorWarehouseId: 'wh-1' }, { branchId: 'branch-a', warehouseId: 'wh-2' });
    expect(allowed).toBe(true);
    expect(denied).toBe(false);
  });
});

describe('isOwner', () => {
  it('allows an org-wide role regardless of ownership', () => {
    expect(isOwner(Role.GENERAL_MANAGER, {}, { ownerUserId: 'user-a' })).toBe(true);
  });

  it('allows the actual owning user', () => {
    expect(isOwner(Role.TECHNICIAN, { actorUserId: 'user-a' }, { ownerUserId: 'user-a' })).toBe(true);
  });

  it('denies a non-owning user', () => {
    expect(isOwner(Role.TECHNICIAN, { actorUserId: 'user-b' }, { ownerUserId: 'user-a' })).toBe(false);
  });

  it('allows the actual owning customer', () => {
    expect(isOwner(Role.TECHNICIAN, { actorCustomerId: 'cust-a' }, { ownerCustomerId: 'cust-a' })).toBe(true);
  });

  it('treats a resource with no declared owner as unrestricted', () => {
    expect(isOwner(Role.TECHNICIAN, {}, {})).toBe(true);
  });
});
