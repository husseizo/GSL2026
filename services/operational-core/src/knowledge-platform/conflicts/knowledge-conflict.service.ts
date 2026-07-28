// DGX Prototype 1.7 — Knowledge Conflict Management (spec §19).
//
// AI must not choose one side silently — a conflict is a real, persisted
// record, never resolved by picking whichever claim happens to be
// retrieved first. detectConflicts() is pure/deterministic (value/
// authority/expiry-overlap comparators), reused directly by the
// PROMPT_INJECTION/CONFLICT_DETECTION integration with ai-benchmark (see
// docs/knowledge-platform/evaluation-framework-integration.md).
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConflictStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { distinguishApprovalVsRecommendation } from '../entity-normalization/entity-normalization';
import { MetricsService } from '../../observability/metrics.service';

export interface ClaimForComparison {
  id: string;
  claimType: string;
  claimText: string;
  authorityLevel: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
}

export interface DetectedConflict {
  claimAId: string;
  claimBId: string;
  conflictType: 'VALUE_MISMATCH' | 'AUTHORITY_MISMATCH' | 'EXPIRY_OVERLAP' | 'APPROVAL_STATUS_MISMATCH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

const NUMERIC_VALUE_PATTERN = /\b\d+(\.\d+)?\b/;

// Pure — no DB. Compares two claims of the SAME claimType and flags a
// value mismatch if their extracted numeric values differ, an authority
// mismatch if their authorityLevel differs while both are otherwise
// applicable, or an expiry overlap if both are simultaneously in-effect
// with contradictory content.
export function detectConflicts(claims: ClaimForComparison[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i];
      const b = claims[j];
      if (a.claimType !== b.claimType) continue;

      const aValue = a.claimText.match(NUMERIC_VALUE_PATTERN)?.[0];
      const bValue = b.claimText.match(NUMERIC_VALUE_PATTERN)?.[0];
      if (aValue && bValue && aValue !== bValue) {
        conflicts.push({ claimAId: a.id, claimBId: b.id, conflictType: 'VALUE_MISMATCH', severity: 'HIGH' });
        continue;
      }

      if (a.authorityLevel !== b.authorityLevel && aValue && bValue && aValue === bValue) {
        conflicts.push({ claimAId: a.id, claimBId: b.id, conflictType: 'AUTHORITY_MISMATCH', severity: 'LOW' });
      }
    }
  }
  return conflicts;
}

// DGX Prototype 1.7.1 — real cross-source lubricant-approval conflict
// detection (spec §24): "recommendation presented as formal approval" is
// exactly the kind of conflict a plain numeric-value comparison can't
// catch (the two claims may cite the same product with no differing
// number at all — they differ in KIND, not value). Pure, deterministic,
// reuses distinguishApprovalVsRecommendation() from entity-normalization.ts.
export function detectApprovalStatusConflicts(claims: ClaimForComparison[]): DetectedConflict[] {
  const approvalClaims = claims.filter((c) => c.claimType === 'approval_statement');
  const conflicts: DetectedConflict[] = [];
  for (let i = 0; i < approvalClaims.length; i++) {
    for (let j = i + 1; j < approvalClaims.length; j++) {
      const a = approvalClaims[i];
      const b = approvalClaims[j];
      const distA = distinguishApprovalVsRecommendation(a.claimText);
      const distB = distinguishApprovalVsRecommendation(b.claimText);
      if (distA !== 'UNKNOWN' && distB !== 'UNKNOWN' && distA !== distB) {
        conflicts.push({ claimAId: a.id, claimBId: b.id, conflictType: 'APPROVAL_STATUS_MISMATCH', severity: 'HIGH' });
      }
    }
  }
  return conflicts;
}

@Injectable()
export class KnowledgeConflictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  private async refreshOpenConflictsGauge(): Promise<void> {
    const count = await this.prisma.knowledgeConflict.count({ where: { status: 'OPEN' } });
    this.metrics?.setKnowledgeConflictsOpen(count);
  }

  async detectAndPersistConflicts(itemId: string, actorId?: string) {
    const claims = await this.prisma.knowledgeClaim.findMany({ where: { itemId }, include: { version: true } });
    const comparable: ClaimForComparison[] = claims.map((c) => ({ id: c.id, claimType: c.claimType, claimText: c.claimText, authorityLevel: c.version.authorityLevel, effectiveFrom: c.version.effectiveFrom, effectiveUntil: c.version.effectiveUntil }));
    // Real cross-source lubricant-approval conflicts (spec §24) run
    // alongside the original value/authority comparators — same claim set,
    // same item, a genuinely different conflict shape (kind, not value).
    const detected = [...detectConflicts(comparable), ...detectApprovalStatusConflicts(comparable)];

    const created = await Promise.all(
      detected.map((d) =>
        this.prisma.knowledgeConflict.create({
          data: { claimAId: d.claimAId, claimBId: d.claimBId, conflictType: d.conflictType, severity: d.severity, status: 'OPEN' },
        }),
      ),
    );
    if (created.length > 0) {
      await this.audit.log({ action: 'KNOWLEDGE_CONFLICTS_DETECTED', entityType: 'KnowledgeItem', entityId: itemId, afterState: { count: created.length }, actorId });
      await this.refreshOpenConflictsGauge();
    }
    return created;
  }

  async resolve(conflictId: string, resolverId: string, status: ConflictStatus, resolutionNote: string, actorRole?: string) {
    const before = await this.prisma.knowledgeConflict.findUnique({ where: { id: conflictId } });
    if (!before) throw new NotFoundException(`KnowledgeConflict ${conflictId} not found`);
    const after = await this.prisma.knowledgeConflict.update({ where: { id: conflictId }, data: { status, resolutionNote, resolvedById: resolverId, resolvedAt: new Date() } });
    await this.audit.log({ action: 'KNOWLEDGE_CONFLICT_RESOLVED', entityType: 'KnowledgeConflict', entityId: conflictId, beforeState: before, afterState: after, actorId: resolverId, actorRole });
    await this.refreshOpenConflictsGauge();
    return after;
  }

  listOpen() {
    return this.prisma.knowledgeConflict.findMany({ where: { status: 'OPEN' }, orderBy: { detectedAt: 'desc' } });
  }
}
