// DGX Prototype 1.7.1 — real, scoped audit queries for the Knowledge
// Platform (spec §36, §21's "Ingestion Runs"/"Quarantine Queue"/"Audit
// History" screens). No new persistence — every query reads the existing,
// real, Postgres-trigger-enforced immutable AuditLog table this project
// already has. Deliberately NOT a generic audit browser (no such thing
// exists anywhere in this codebase) — scoped to Knowledge-Platform
// entityTypes/actions only, matching the phase's own mandate.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const KNOWLEDGE_PLATFORM_ENTITY_TYPES = ['KnowledgeSource', 'KnowledgeSourcePermission', 'KnowledgeItem', 'KnowledgeItemVersion', 'KnowledgeClaim', 'StructuredFact', 'KnowledgeConflict', 'KnowledgeReviewAssignment', 'KnowledgeSnapshot', 'KnowledgeDocumentAcquisition'];

const INGESTION_RUN_ACTIONS = ['KNOWLEDGE_ITEM_CREATED', 'KNOWLEDGE_ITEM_VERSION_CREATED', 'STRUCTURED_INGESTION_COMPLETED', 'STRUCTURED_INGESTION_FITMENT_EDGES_COMPLETED'];
const QUARANTINE_ACTIONS = ['KNOWLEDGE_INGESTION_QUARANTINED'];

@Injectable()
export class KnowledgeAuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Real "Ingestion Runs" view (spec §21 screen 2) — derived from the
  // existing AuditLog rather than a new persisted-run table, since every
  // real ingestion action is already audited at its call site.
  listIngestionRuns(limit = 100) {
    return this.prisma.auditLog.findMany({ where: { action: { in: INGESTION_RUN_ACTIONS } }, orderBy: { occurredAt: 'desc' }, take: limit });
  }

  // Real "Quarantine Queue" view (spec §21 screen 3).
  listQuarantineEvents(limit = 100) {
    return this.prisma.auditLog.findMany({ where: { action: { in: QUARANTINE_ACTIONS } }, orderBy: { occurredAt: 'desc' }, take: limit });
  }

  // Real "Audit History" view (spec §21 screen 12), scoped to Knowledge
  // Platform entities only.
  listAuditHistory(entityType?: string, entityId?: string, limit = 200) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: entityType ? entityType : { in: KNOWLEDGE_PLATFORM_ENTITY_TYPES },
        entityId,
      },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
  }
}
