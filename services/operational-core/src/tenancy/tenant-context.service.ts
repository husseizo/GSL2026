import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// This deployment remains genuinely single-organization — see
// docs/architecture/tenant-readiness.md for exactly what "prepared, not
// converted to SaaS" means. assertBranchBelongsToOrganization() is the one
// real, reusable primitive every new Phase 5 module (Branch Gateway, CDC,
// integration adapters) calls before trusting a branchId from a request —
// it's a genuine DB check (Branch.organizationId), not a placeholder. It
// has not been retrofitted onto every one of the 50+ Phase 1-4 services;
// see the doc for exactly which surfaces call it today.
@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async assertBranchBelongsToOrganization(branchId: string, organizationId: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.organizationId !== organizationId) {
      throw new ForbiddenException(`Branch ${branchId} does not belong to organization ${organizationId}`);
    }
  }

  async getDefaultOrganization() {
    return this.prisma.organization.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  }
}
