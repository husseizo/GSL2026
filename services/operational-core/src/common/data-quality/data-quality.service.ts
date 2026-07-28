import { Injectable } from '@nestjs/common';
import { DataQualitySeverity } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface DataQualityFinding {
  checkName: string;
  severity: DataQualitySeverity;
  entityType: string;
  entityId?: string;
  message: string;
  context?: unknown;
}

// Named checks called from the specific import/posting points where they
// apply (sales import, purchase import, inventory posting, lubricant
// approval import) — see docs/architecture/data-quality-phase-2.md for which
// of the spec's ~20 checks are implemented as DB constraints (duplicates,
// missing FKs — Postgres/Prisma already reject these), which run as explicit
// checks recorded here, and which are deferred.
//
// Severity is the load-bearing distinction the spec asks for:
//   FATAL          -> reject the record (caller must not proceed)
//   RECOVERABLE    -> proceed, but flag for correction (e.g. negative stock)
//   WARNING        -> proceed, informational
//   MANUAL_REVIEW  -> proceed, but a human must look at it before it's trusted
@Injectable()
export class DataQualityService {
  constructor(private readonly prisma: PrismaService) {}

  record(finding: DataQualityFinding) {
    return this.prisma.dataQualityIssue.create({
      data: {
        checkName: finding.checkName,
        severity: finding.severity,
        entityType: finding.entityType,
        entityId: finding.entityId,
        message: finding.message,
        context: finding.context as object | undefined,
      },
    });
  }

  list(filter: { severity?: DataQualitySeverity; entityType?: string; resolved?: boolean }) {
    return this.prisma.dataQualityIssue.findMany({
      where: {
        severity: filter.severity,
        entityType: filter.entityType,
        resolvedAt: filter.resolved === undefined ? undefined : filter.resolved ? { not: null } : null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  resolve(id: string, resolvedById: string) {
    return this.prisma.dataQualityIssue.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedById },
    });
  }

  // Quantity/price sanity checks reused by both sales and purchase line
  // normalization — kept here so the two importers can't drift on what
  // "invalid" means.
  checkQuantityAndPrice(params: {
    entityType: string;
    entityId?: string;
    quantity: number;
    unitPrice?: number;
  }): DataQualityFinding[] {
    const findings: DataQualityFinding[] = [];
    if (!Number.isFinite(params.quantity) || params.quantity <= 0) {
      findings.push({
        checkName: 'invalid_quantity',
        severity: DataQualitySeverity.RECOVERABLE,
        entityType: params.entityType,
        entityId: params.entityId,
        message: `Quantity ${params.quantity} is not a positive number`,
        context: { quantity: params.quantity },
      });
    }
    if (params.unitPrice !== undefined && (!Number.isFinite(params.unitPrice) || params.unitPrice < 0)) {
      findings.push({
        checkName: 'negative_price',
        severity: DataQualitySeverity.RECOVERABLE,
        entityType: params.entityType,
        entityId: params.entityId,
        message: `Unit price ${params.unitPrice} is negative`,
        context: { unitPrice: params.unitPrice },
      });
    }
    return findings;
  }
}
