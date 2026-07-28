import { SetMetadata } from '@nestjs/common';

export const SCOPE_FIELD_KEY = 'scopeField';

// Names which request field (route param, query, or body key) carries the
// resource's branchId — e.g. @RequireBranchScope('branchId') on a route
// with :branchId in its path. Defaults to 'branchId' if omitted.
export const RequireBranchScope = (field = 'branchId') => SetMetadata(SCOPE_FIELD_KEY, field);
