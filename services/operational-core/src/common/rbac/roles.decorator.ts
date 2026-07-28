import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Marks which roles may call a handler. Absence of this decorator means
// "no role restriction at the RBAC layer" — branch/warehouse scoping and
// approval workflows are enforced separately per docs/architecture/00-overview.md §4.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
