import { Role } from '@prisma/client';

// Pure hierarchical scope/ownership logic — no DB, no HTTP. Layered on top
// of (not replacing) the existing static ROLE_PERMISSIONS map: that map
// still answers "can this role do X at all"; this module answers "is this
// specific branch/warehouse/resource within the actor's authority."
// "Every request must be evaluated through permissions rather than role
// names" has been true since Phase 2 — @RequirePermissions() checks a
// capability, never a role literal. What was missing, and what this adds,
// is the hierarchy: an org-wide role's permission grant applies everywhere;
// a branch-scoped role's grant applies only within its own branch. See
// docs/architecture/authorization.md.
export const ORG_WIDE_ROLES: Role[] = [
  Role.SYSTEM_ADMINISTRATOR,
  Role.OWNER,
  Role.GENERAL_MANAGER,
  Role.AUDITOR,
  Role.READ_ONLY_VIEWER,
];

export interface ScopeContext {
  actorRole: Role;
  actorBranchId?: string;
  actorWarehouseId?: string;
}

export interface ResourceScope {
  branchId?: string;
  warehouseId?: string;
}

export function isOrgWideRole(role: Role): boolean {
  return ORG_WIDE_ROLES.includes(role);
}

// Hierarchy: Organization > Branch > Warehouse/Garage > Department.
// An org-wide role always passes. A branch-scoped actor passes only when
// the resource's branch matches theirs (or the resource specifies no
// branch at all, e.g. a global catalogue record). Warehouse is checked the
// same way, one level down, only when the resource actually specifies one.
export function isWithinScope(context: ScopeContext, resource: ResourceScope): boolean {
  if (isOrgWideRole(context.actorRole)) return true;

  if (resource.branchId && context.actorBranchId && resource.branchId !== context.actorBranchId) {
    return false;
  }
  if (resource.branchId && !context.actorBranchId) {
    return false;
  }

  if (resource.warehouseId && context.actorWarehouseId && resource.warehouseId !== context.actorWarehouseId) {
    return false;
  }

  return true;
}

export interface OwnershipContext {
  actorUserId?: string;
  actorCustomerId?: string;
}

export interface OwnedResource {
  ownerUserId?: string | null;
  ownerCustomerId?: string | null;
}

// Document/vehicle ownership: a customer viewing their own vehicle record,
// a technician viewing only jobs assigned to them, etc. Org-wide roles
// bypass this the same way they bypass branch scope — an owner check is a
// restriction for the resource's own party, not a ceiling on management
// oversight.
export function isOwner(role: Role, ownership: OwnershipContext, resource: OwnedResource): boolean {
  if (isOrgWideRole(role)) return true;

  if (resource.ownerUserId && ownership.actorUserId === resource.ownerUserId) return true;
  if (resource.ownerCustomerId && ownership.actorCustomerId === resource.ownerCustomerId) return true;

  // A resource declaring no owner at all isn't an ownership-restricted
  // resource — nothing to check, so it's not a denial.
  if (!resource.ownerUserId && !resource.ownerCustomerId) return true;

  return false;
}
