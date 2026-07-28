import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  actorId?: string;
  actorRole?: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  branchId?: string;
  sourceApplication?: string;
  correlationId?: string;
}

// Called explicitly from the specific mutation points listed in
// docs/architecture/phase-2-commercial-foundation.md §12 — deliberately not a
// global interceptor that "magically" audits every request. Explicit call
// sites are what makes the audit trail traceable and testable; see
// docs/architecture/decision-log.md.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeState: entry.beforeState as object | undefined,
        afterState: entry.afterState as object | undefined,
        branchId: entry.branchId,
        sourceApplication: entry.sourceApplication,
        correlationId: entry.correlationId,
      },
    });
  }

  list(filter: { entityType?: string; entityId?: string; action?: string }) {
    return this.prisma.auditLog.findMany({
      where: filter,
      orderBy: { occurredAt: 'desc' },
    });
  }
}
