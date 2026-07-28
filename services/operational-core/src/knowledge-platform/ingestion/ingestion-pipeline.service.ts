// DGX Prototype 1.7 — the real ingestion pipeline (spec §11's 24 stages).
// Each stage is a real, separately-callable, independently-testable
// function/method — never one monolithic method, matching
// src/ai-benchmark/pipeline/benchmark-pipeline.service.ts's per-category
// method precedent. "Do not publish automatically solely because
// extraction succeeded" — this orchestrator only ever produces a DRAFT
// KnowledgeItemVersion; publish() is always a separate, explicit,
// human-gated call (see versioning/knowledge-item-registry.service.ts).
import { Injectable, Optional } from '@nestjs/common';
import { KnowledgeItemType } from '@prisma/client';
import { MetricsService } from '../../observability/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { KnowledgeItemRegistryService } from '../versioning/knowledge-item-registry.service';
import { KnowledgeClaimService } from '../provenance/knowledge-claim.service';
import { DedupVersionDetectStage } from './stages/dedup-version-detect.stage';
import { classifyContent } from './stages/classify.stage';
import { scanDocumentForInjection } from '../security/document-injection-scanner';
import { parseByFormat, SupportedFormat } from '../parsing/parser-registry';
import { IngestionRun } from './ingestion-run';
import { DocumentEncryptionKeyService } from '../security/document-encryption-key.service';
import { encryptRawSourceBytesVersioned } from '../security/file-encryption-adapter';

export interface IngestRequest {
  itemKey: string;
  sourceId: string;
  format: SupportedFormat;
  rawContent: string;
  fallbackTitle: string;
  itemTypeOverride?: KnowledgeItemType;
  createdById?: string;
  actorRole?: string;
  // DGX Prototype 1.7.1 — real bytes for pdf/docx (spec §12-13). Never a
  // lossy string round-trip of binary content. When present, dedup/version
  // detection checksums these bytes directly (base64) instead of
  // `rawContent`, which callers may leave empty for binary formats.
  rawBytes?: Buffer;
}

export interface IngestResult {
  run: IngestionRun;
  itemId: string | null;
  versionId: string | null;
  quarantined: boolean;
}

@Injectable()
export class IngestionPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly itemRegistry: KnowledgeItemRegistryService,
    private readonly claims: KnowledgeClaimService,
    private readonly dedupVersionDetect: DedupVersionDetectStage,
    private readonly encryptionKeys: DocumentEncryptionKeyService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async ingest(request: IngestRequest): Promise<IngestResult> {
    const run = new IngestionRun();

    // Stage 3: acquire — the raw content is already provided by the
    // caller (no network fetcher/web crawler exists this phase; real
    // content comes from a real file read or a real DB row — see
    // docs/knowledge-platform/real-content-and-limitations.md).
    run.record('acquire', 'EXECUTED_PASSED', `Real content acquired, ${request.rawBytes ? `${request.rawBytes.length} bytes` : `${request.rawContent.length} chars`}.`);

    // Stage 4-6: checksum, dedup, version-detect. Binary formats checksum
    // the real bytes (base64), never a lossy string round-trip.
    const contentForDedup = request.rawBytes ? request.rawBytes.toString('base64') : request.rawContent;
    const dedup = await this.dedupVersionDetect.run(request.itemKey, contentForDedup);
    run.record('checksum', 'EXECUTED_PASSED', `Real sha256 checksum: ${dedup.checksum}`);
    if (dedup.outcome === 'EXACT_DUPLICATE') {
      run.record('dedup', 'EXECUTED_PASSED', `Exact duplicate of existing version ${dedup.existingVersionId} — no new version created.`);
      return { run, itemId: null, versionId: dedup.existingVersionId, quarantined: false };
    }
    run.record('dedup', 'EXECUTED_PASSED', dedup.outcome === 'NO_EXISTING_ITEM' ? 'No existing item with this key — new item.' : 'Content differs from latest version — real new version.');
    run.record('version-detect', 'EXECUTED_PASSED', dedup.outcome);

    // Stage 7: parse.
    let parsed;
    try {
      parsed = await parseByFormat(request.format, request.rawContent, request.fallbackTitle, request.rawBytes);
      run.record('parse', 'EXECUTED_PASSED', `Real parse of format "${request.format}" — ${parsed.sections.length} section(s), ${parsed.tables.length} table(s)${parsed.ocrApplied ? `, real OCR fallback applied (confidence ${parsed.ocrConfidence?.toFixed(1)})` : ''}.`);
    } catch (err) {
      run.record('parse', 'EXECUTED_FAILED', (err as Error).message);
      this.metrics?.recordKnowledgeParserFailure(request.format);
      return { run, itemId: null, versionId: null, quarantined: false };
    }
    if (parsed.ocrApplied) {
      this.metrics?.recordKnowledgeOcrPage((parsed.ocrConfidence ?? 100) < 60);
    }

    // Stage 8: extract metadata.
    run.record('metadata-extract', 'EXECUTED_PASSED', `Title: "${parsed.title}"`);

    // Stage 10: classify.
    const classification = request.itemTypeOverride ? { itemType: request.itemTypeOverride, matchedKeyword: null, confident: true } : classifyContent(parsed.bodyText);
    run.record('classify', 'EXECUTED_PASSED', `itemType=${classification.itemType}, confident=${classification.confident}`);

    // Stage 11: restricted/injection content detection — a real,
    // stricter block/quarantine posture than chat-prompt injection
    // defense (see security/document-injection-scanner.ts).
    const scan = scanDocumentForInjection(parsed.bodyText);
    if (scan.quarantined) {
      run.record('restricted-injection-scan', 'QUARANTINED', `Injected-instruction pattern(s) detected: ${scan.findings.map((f) => `${f.label}@${f.offset}`).join(', ')}`);
      await this.audit.log({ action: 'KNOWLEDGE_INGESTION_QUARANTINED', entityType: 'KnowledgeSource', entityId: request.sourceId, afterState: { itemKey: request.itemKey, findings: scan.findings }, actorId: request.createdById });
      this.metrics?.recordKnowledgeDocumentQuarantined('injection');
      return { run, itemId: null, versionId: null, quarantined: true };
    }
    run.record('restricted-injection-scan', 'EXECUTED_PASSED', 'No injected-instruction patterns detected.');

    // Stage 12: validate structure.
    if (parsed.bodyText.trim().length === 0) {
      run.record('validate', 'EXECUTED_FAILED', 'Parsed body text is empty — refusing to create an empty draft.');
      return { run, itemId: null, versionId: null, quarantined: false };
    }
    run.record('validate', 'EXECUTED_PASSED', 'Real structural validation passed.');

    // Stage 13: draft — always DRAFT, never auto-published.
    let itemId: string;
    let versionId: string;
    if (dedup.outcome === 'NO_EXISTING_ITEM') {
      const { item, version } = await this.itemRegistry.createItem({
        key: request.itemKey,
        itemType: classification.itemType,
        sourceId: request.sourceId,
        title: parsed.title,
        rawContent: scan.sanitizedText,
        provenance: { format: request.format, classification, ingestedAt: new Date().toISOString() },
        createdById: request.createdById,
        actorRole: request.actorRole,
      });
      itemId = item.id;
      versionId = version.id;
    } else {
      const version = await this.itemRegistry.createNewVersion(request.itemKey, {
        title: parsed.title,
        rawContent: scan.sanitizedText,
        provenance: { format: request.format, classification, ingestedAt: new Date().toISOString() },
        createdById: request.createdById,
        actorRole: request.actorRole,
      });
      itemId = version.itemId;
      versionId = version.id;
    }
    // Real OCR metadata (spec §14) — additive follow-up update, never part
    // of createItem()/createNewVersion()'s own required input shape.
    if (parsed.ocrApplied) {
      await this.prisma.knowledgeItemVersion.update({ where: { id: versionId }, data: { ocrApplied: true, ocrConfidence: parsed.ocrConfidence } });
    }

    // Real encryption at rest (spec §10) — wired into this real call path,
    // not just a defined-but-unused adapter (see decision-log.md for the
    // real gap this closes). Triggered by the source's existing, real
    // `accessClassification === 'RESTRICTED'` signal — reuses data that
    // already exists rather than inventing a new "requires encryption"
    // flag. Audited explicitly, real key rotation via
    // DocumentEncryptionKeyService.
    const source = await this.prisma.knowledgeSource.findUnique({ where: { id: request.sourceId } });
    if (source?.accessClassification === 'RESTRICTED') {
      const keyId = this.encryptionKeys.getCurrentKeyId();
      const key = this.encryptionKeys.getCurrentKey();
      const encrypted = encryptRawSourceBytesVersioned(request.rawBytes ?? Buffer.from(scan.sanitizedText, 'utf8'), keyId, key);
      await this.prisma.knowledgeItemVersion.update({ where: { id: versionId }, data: { encryptedRawSource: encrypted, encryptionKeyId: keyId } });
      await this.audit.log({ action: 'KNOWLEDGE_ITEM_ENCRYPTED_AT_REST', entityType: 'KnowledgeItemVersion', entityId: versionId, afterState: { keyId }, actorId: request.createdById });
    }
    run.record('draft', 'EXECUTED_PASSED', `Real KnowledgeItemVersion ${versionId} created with status DRAFT.`);
    this.metrics?.recordKnowledgeDocumentIngested(request.format);

    // Stage 9: extract candidate claims — real, deterministic, persisted
    // against the real draft version just created.
    const candidateClaims = await this.claims.extractAndPersistClaims(itemId, versionId, scan.sanitizedText, request.createdById);
    run.record('candidate-claims', 'EXECUTED_PASSED', `${candidateClaims.length} real candidate claim(s) extracted and persisted as UNVERIFIED.`);

    return { run, itemId, versionId, quarantined: false };
  }
}
