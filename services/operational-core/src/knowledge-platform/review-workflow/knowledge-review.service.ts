// DGX Prototype 1.7 — Knowledge Review Workflow (spec §17).
//
// The review WORKFLOW itself reuses KnowledgeItemVersion.status's own
// state machine directly (DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED /
// ...) rather than a separate generic queue table. KnowledgeReviewAssignment
// is the one genuinely new concept: routing a specific version to a
// specific reviewer role, and recording that reviewer's real decision.
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { KnowledgeReviewDecision, KnowledgeReviewerRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { KnowledgeItemRegistryService } from '../versioning/knowledge-item-registry.service';
import { MetricsService } from '../../observability/metrics.service';

@Injectable()
export class KnowledgeReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly itemRegistry: KnowledgeItemRegistryService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async assignReviewer(versionId: string, reviewerRole: KnowledgeReviewerRole, assignedToId: string | undefined, actorId?: string, actorRole?: string) {
    const version = await this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId } });
    if (version.status === 'DRAFT') {
      await this.itemRegistry.transitionStatus(versionId, 'IN_REVIEW', actorId, actorRole);
    }

    const assignment = await this.prisma.knowledgeReviewAssignment.create({
      data: { versionId, reviewerRole, assignedToId },
    });
    await this.audit.log({ action: 'KNOWLEDGE_REVIEW_ASSIGNED', entityType: 'KnowledgeReviewAssignment', entityId: assignment.id, afterState: assignment, actorId, actorRole });
    return assignment;
  }

  // Real review decisions (spec §17): APPROVE / REJECT / REQUEST_CHANGES.
  // APPROVE only transitions the version to APPROVED once every assigned
  // reviewer for that version has independently decided APPROVE — a
  // single reviewer's approval never silently finalizes a multi-reviewer
  // item.
  async decide(assignmentId: string, decision: KnowledgeReviewDecision, decisionNote: string | undefined, actorId?: string, actorRole?: string) {
    const assignment = await this.prisma.knowledgeReviewAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException(`KnowledgeReviewAssignment ${assignmentId} not found`);

    const before = assignment;
    const after = await this.prisma.knowledgeReviewAssignment.update({ where: { id: assignmentId }, data: { decision, decisionNote, decidedAt: new Date() } });
    await this.audit.log({ action: `KNOWLEDGE_REVIEW_${decision}`, entityType: 'KnowledgeReviewAssignment', entityId: assignmentId, beforeState: before, afterState: after, actorId, actorRole });
    if (after.decidedAt) this.metrics?.recordKnowledgeReviewLatency(after.assignedAt, after.decidedAt);
    const backlogCount = await this.prisma.knowledgeReviewAssignment.count({ where: { decision: null } });
    this.metrics?.setKnowledgeReviewBacklog(backlogCount);

    if (decision === 'REJECT') {
      await this.itemRegistry.transitionStatus(assignment.versionId, 'REJECTED', actorId, actorRole);
      return after;
    }
    if (decision === 'REQUEST_CHANGES') {
      // Version stays IN_REVIEW — a real reviewer asked for changes, not a
      // rejection; the author corrects and the same version (or a new one)
      // re-enters review.
      return after;
    }

    const allAssignments = await this.prisma.knowledgeReviewAssignment.findMany({ where: { versionId: assignment.versionId } });
    const allApproved = allAssignments.length > 0 && allAssignments.every((a) => a.decision === 'APPROVE');
    if (allApproved) {
      await this.itemRegistry.transitionStatus(assignment.versionId, 'APPROVED', actorId, actorRole, { approvedById: actorId });
    }
    return after;
  }

  listPendingForVersion(versionId: string) {
    return this.prisma.knowledgeReviewAssignment.findMany({ where: { versionId, decision: null } });
  }

  // The real review queue (spec §41's "Review queue" screen concept,
  // exposed here as a real API/CLI query since the UI itself is deferred
  // this phase — see docs/knowledge-platform/portal-ui-deferred.md).
  reviewQueue() {
    return this.prisma.knowledgeReviewAssignment.findMany({
      where: { decision: null },
      include: { version: { include: { item: true } } },
      orderBy: { assignedAt: 'asc' },
    });
  }

  // DGX Prototype 1.7.1 — real dual review for high-risk fact types (spec
  // §22): torque/safety/lubricant-approval/fitment/VIN/fluid-quantity/
  // diagnostic/warranty. Creates TWO real KnowledgeReviewAssignment rows
  // up front — the existing decide() "every assigned reviewer must
  // APPROVE" loop (unmodified) already requires both before the version
  // can move to APPROVED, so a single reviewer's sign-off can never
  // finalize a high-risk item alone.
  async assignDualReview(versionId: string, reviewerRoles: [KnowledgeReviewerRole, KnowledgeReviewerRole], assignedToIds: [string | undefined, string | undefined], reviewBatchId?: string, actorId?: string, actorRole?: string) {
    const version = await this.prisma.knowledgeItemVersion.findUniqueOrThrow({ where: { id: versionId } });
    if (version.status === 'DRAFT') {
      await this.itemRegistry.transitionStatus(versionId, 'IN_REVIEW', actorId, actorRole);
    }

    const assignments = await Promise.all(
      reviewerRoles.map((reviewerRole, i) =>
        this.prisma.knowledgeReviewAssignment.create({
          data: { versionId, reviewerRole, assignedToId: assignedToIds[i], reviewBatchId, isHighRisk: true, requiresDualReview: true },
        }),
      ),
    );
    await this.audit.log({ action: 'KNOWLEDGE_DUAL_REVIEW_ASSIGNED', entityType: 'KnowledgeItemVersion', entityId: versionId, afterState: { assignmentIds: assignments.map((a) => a.id) }, actorId, actorRole });
    return assignments;
  }

  // Real reviewer-disagreement escalation (spec §22) — a reviewer flags
  // that the assignment needs escalation (e.g. a genuine disagreement with
  // another reviewer's decision), recorded with a real reason, never
  // silently dropped.
  async escalate(assignmentId: string, reason: string, actorId?: string, actorRole?: string) {
    const before = await this.prisma.knowledgeReviewAssignment.findUnique({ where: { id: assignmentId } });
    if (!before) throw new NotFoundException(`KnowledgeReviewAssignment ${assignmentId} not found`);
    const after = await this.prisma.knowledgeReviewAssignment.update({ where: { id: assignmentId }, data: { escalatedAt: new Date(), escalationReason: reason } });
    await this.audit.log({ action: 'KNOWLEDGE_REVIEW_ESCALATED', entityType: 'KnowledgeReviewAssignment', entityId: assignmentId, beforeState: before, afterState: after, actorId, actorRole });
    return after;
  }

  // Real review batches (spec §20) — a named grouping so reviewers can
  // work through a controlled batch (by domain/source/risk/etc.) rather
  // than the full undifferentiated queue.
  async createReviewBatch(label: string, createdById?: string) {
    return this.prisma.knowledgeReviewBatch.create({ data: { label, createdById } });
  }

  listReviewBatch(reviewBatchId: string) {
    return this.prisma.knowledgeReviewAssignment.findMany({ where: { reviewBatchId }, include: { version: { include: { item: true } } }, orderBy: { assignedAt: 'asc' } });
  }

  listEscalated() {
    return this.prisma.knowledgeReviewAssignment.findMany({ where: { escalatedAt: { not: null } }, orderBy: { escalatedAt: 'desc' } });
  }
}
