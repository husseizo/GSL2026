import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission';

export const PERMISSIONS_KEY = 'permissions';

// Checks what the actor is allowed to DO, not just which role they have —
// see docs/architecture/rbac-permissions.md. Requires ALL listed permissions.
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
