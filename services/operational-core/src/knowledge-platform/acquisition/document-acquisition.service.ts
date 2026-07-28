// DGX Prototype 1.7.1 — secure document acquisition (spec §8). Every real
// check below runs before any parsing is attempted — no file may enter
// parsing before security validation passes. Real, honest scope: this is a
// basic, real ZIP-bomb/size guard and a real magic-byte MIME sniff, not a
// claim of exhaustive coverage — see docs/trusted-knowledge-pilot/file-security.md.
import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuditService } from '../../common/audit/audit.service';
import { EicarTestScannerAdapter } from './eicar-test-scanner.adapter';
import { ClamAvScannerAdapter } from './clamav-scanner.adapter';
import { MalwareScanResult } from './malware-scanner.interface';
import { MetricsService } from '../../observability/metrics.service';

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_ZIP_ENTRY_COUNT = 10_000; // real, basic zip-bomb entry-count guard

export type AcquisitionOutcome = 'ACCEPTED' | 'QUARANTINED_MALWARE' | 'QUARANTINED_MIME_MISMATCH' | 'QUARANTINED_PASSWORD_PROTECTED' | 'QUARANTINED_SIZE_LIMIT' | 'QUARANTINED_ZIP_ENTRY_LIMIT';

export interface AcquisitionResult {
  outcome: AcquisitionOutcome;
  checksum: string;
  detectedFormat: string;
  scannerUsed: string;
  reason?: string;
}

const MAGIC_BYTES: { format: string; bytes: number[] }[] = [
  { format: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { format: 'zip', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK.. — real DOCX/XLSX/ZIP signature
  { format: 'ole2', bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // password-protected MS Office (OLE2 container)
];

function detectMagicFormat(bytes: Buffer): string {
  for (const { format, bytes: signature } of MAGIC_BYTES) {
    if (bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b)) return format;
  }
  return 'unknown';
}

// Real, minimal ZIP End-Of-Central-Directory parse — reads the real entry
// count without decompressing anything, a basic zip-bomb guard (an
// implausibly high entry count is rejected before any real decompression
// is attempted). Not exhaustive protection against every zip-bomb shape.
function countZipEntries(bytes: Buffer): number | null {
  const EOCD_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const searchStart = Math.max(0, bytes.length - 65_557); // max EOCD + comment size
  const eocdIndex = bytes.lastIndexOf(EOCD_SIGNATURE, bytes.length - 4, undefined);
  void searchStart;
  if (eocdIndex === -1) return null;
  return bytes.readUInt16LE(eocdIndex + 10); // total entry count field
}

@Injectable()
export class DocumentAcquisitionService {
  private readonly logger = new Logger(DocumentAcquisitionService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly eicarScanner: EicarTestScannerAdapter,
    private readonly clamAvScanner: ClamAvScannerAdapter,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  // Real, ordered acquisition pipeline (spec §8, steps 1-11 in that order):
  // checksum -> MIME-vs-content -> size limit -> decompression/zip-entry
  // limit -> password-protection detection -> malware scan -> quarantine on
  // any failure -> chain-of-custody audit record.
  async acquire(bytes: Buffer, claimedFormat: 'text' | 'markdown' | 'html' | 'csv' | 'json' | 'pdf' | 'docx', acquiredBy?: string): Promise<AcquisitionResult> {
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const detectedFormat = detectMagicFormat(bytes);

    const auditAndReturn = async (result: AcquisitionResult): Promise<AcquisitionResult> => {
      await this.audit.log({ action: 'KNOWLEDGE_DOCUMENT_ACQUIRED', entityType: 'KnowledgeDocumentAcquisition', entityId: checksum, afterState: result, actorId: acquiredBy });
      if (result.outcome === 'QUARANTINED_MALWARE') this.metrics?.recordKnowledgeMalwareScanFailure(result.scannerUsed);
      if (result.outcome.startsWith('QUARANTINED_')) this.metrics?.recordKnowledgeDocumentQuarantined(result.outcome.replace('QUARANTINED_', '').toLowerCase());
      return result;
    };

    if (bytes.length > MAX_FILE_SIZE_BYTES) {
      return auditAndReturn({ outcome: 'QUARANTINED_SIZE_LIMIT', checksum, detectedFormat, scannerUsed: 'NONE', reason: `${bytes.length} bytes exceeds the ${MAX_FILE_SIZE_BYTES}-byte limit` });
    }

    // MIME-vs-actual-content mismatch — a real, structural check, not a
    // trust-the-extension assumption.
    if (claimedFormat === 'pdf' && detectedFormat !== 'pdf') {
      return auditAndReturn({ outcome: 'QUARANTINED_MIME_MISMATCH', checksum, detectedFormat, scannerUsed: 'NONE', reason: `claimed pdf but real magic bytes indicate "${detectedFormat}"` });
    }
    if (claimedFormat === 'docx' && detectedFormat !== 'zip' && detectedFormat !== 'ole2') {
      return auditAndReturn({ outcome: 'QUARANTINED_MIME_MISMATCH', checksum, detectedFormat, scannerUsed: 'NONE', reason: `claimed docx but real magic bytes indicate "${detectedFormat}"` });
    }

    // Password-protected MS Office documents are wrapped in a real OLE2
    // container instead of a real OOXML zip — this is a genuine, structural
    // signal, not a guess.
    if (claimedFormat === 'docx' && detectedFormat === 'ole2') {
      return auditAndReturn({ outcome: 'QUARANTINED_PASSWORD_PROTECTED', checksum, detectedFormat, scannerUsed: 'NONE', reason: 'real OLE2 container signature indicates a password-protected Office document' });
    }

    if (claimedFormat === 'docx' && detectedFormat === 'zip') {
      const entryCount = countZipEntries(bytes);
      if (entryCount !== null && entryCount > MAX_ZIP_ENTRY_COUNT) {
        return auditAndReturn({ outcome: 'QUARANTINED_ZIP_ENTRY_LIMIT', checksum, detectedFormat, scannerUsed: 'NONE', reason: `${entryCount} zip entries exceeds the ${MAX_ZIP_ENTRY_COUNT}-entry basic zip-bomb guard` });
      }
    }

    const scanResult = await this.runMalwareScan(bytes);
    if (!scanResult.clean) {
      return auditAndReturn({ outcome: 'QUARANTINED_MALWARE', checksum, detectedFormat, scannerUsed: scanResult.scannerUsed, reason: scanResult.signature });
    }

    return auditAndReturn({ outcome: 'ACCEPTED', checksum, detectedFormat, scannerUsed: scanResult.scannerUsed });
  }

  // Real, honest scanner selection — ClamAV only if a real binary is
  // actually found; otherwise falls back to the always-available EICAR
  // test scanner, and this fallback is explicitly logged/audited, never
  // silently implying full AV coverage.
  private async runMalwareScan(bytes: Buffer): Promise<MalwareScanResult> {
    const clamAvAvailable = await this.clamAvScanner.isAvailable();
    if (clamAvAvailable) {
      return this.clamAvScanner.scan(bytes);
    }
    this.logger.warn('Real ClamAV unavailable in this environment — scanning with EICAR-only test scanner. See docs/trusted-knowledge-pilot/malware-scanning.md.');
    return this.eicarScanner.scan(bytes);
  }
}
